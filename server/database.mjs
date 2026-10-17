import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function openDatabase(filename = resolve('data/khaneh.sqlite')) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS finance_snapshots(
      revision INTEGER PRIMARY KEY AUTOINCREMENT,
      payload TEXT NOT NULL CHECK(json_valid(payload)),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS household_invitations(
      token TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS access_requests(
      token TEXT PRIMARY KEY, invitation TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      email TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', member_id TEXT
    );
    CREATE TABLE IF NOT EXISTS owner_keys(token TEXT PRIMARY KEY);
    INSERT OR IGNORE INTO schema_migrations VALUES(1);`);
  return {
    read() { return db.prepare('SELECT revision, payload, created_at FROM finance_snapshots ORDER BY revision DESC LIMIT 1').get() ?? null; },
    save(data, expectedRevision) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const current = this.read();
        if ((current?.revision ?? 0) !== expectedRevision) throw new Error('REVISION_CONFLICT');
        const result = db.prepare('INSERT INTO finance_snapshots(payload) VALUES(?)').run(JSON.stringify(data));
        db.exec('COMMIT');
        return Number(result.lastInsertRowid);
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    createInvitation(token, expiresAt) {
      db.prepare('DELETE FROM household_invitations WHERE expires_at < ? OR used = 1').run(Date.now());
      db.prepare('INSERT INTO household_invitations(token, expires_at) VALUES(?, ?)').run(token, expiresAt);
    },
    addOwnerKey(token) { db.prepare('INSERT INTO owner_keys VALUES(?)').run(token); },
    isOwnerKey(token) { return !!db.prepare('SELECT token FROM owner_keys WHERE token = ?').get(token); },
    emailMember(email, ownerEmail) {
      const current=this.read();if(!current)return null;
      const members=JSON.parse(current.payload).settings.members ?? [];
      const normalized=email.trim().toLowerCase();
      if(ownerEmail && normalized===ownerEmail.trim().toLowerCase())return members.find(m=>m.role==='owner'&&!m.removed);
      const request=db.prepare("SELECT member_id FROM access_requests WHERE lower(email)=? AND status='approved' ORDER BY rowid DESC LIMIT 1").get(normalized);
      return request ? members.find(m=>m.id===request.member_id&&!m.removed) : null;
    },
    requestAccess(invitation, name, email, token) {
      const invite = db.prepare('SELECT * FROM household_invitations WHERE token = ?').get(invitation);
      if (!invite || invite.used || invite.expires_at < Date.now()) throw new Error('لینک دعوت معتبر نیست یا قبلاً استفاده شده است.');
      db.prepare('INSERT INTO access_requests(token, invitation, name, email) VALUES(?,?,?,?)').run(token, invitation, name, email);
      return {token, status:'pending'};
    },
    requests() { return db.prepare("SELECT token, name, email, status FROM access_requests WHERE status = 'pending'").all(); },
    accessStatus(token) {
      const request = db.prepare('SELECT * FROM access_requests WHERE token = ?').get(token);
      if (!request) throw new Error('درخواست پیدا نشد.');
      if (request.status !== 'approved') return {status:request.status};
      const data = JSON.parse(this.read().payload);
      const member = data.settings.members.find(m=>m.id===request.member_id && !m.removed);
      if (!member) return {status:'rejected'};
      return {status:'approved', data, member};
    },
    decideAccess(token, approved, validate) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const request = db.prepare("SELECT * FROM access_requests WHERE token = ? AND status = 'pending'").get(token);
        if (!request) throw new Error('این درخواست قبلاً بررسی شده است.');
        let member;
        if (approved) {
          const data = JSON.parse(this.read().payload);
          member = {id:crypto.randomUUID(),name:request.name,role:'editor'};
          data.settings.members.push(member); validate(data);
          db.prepare('INSERT INTO finance_snapshots(payload) VALUES(?)').run(JSON.stringify(data));
        }
        db.prepare('UPDATE household_invitations SET used = 1 WHERE token = ?').run(request.invitation);
        db.prepare('UPDATE access_requests SET status = ?, member_id = ? WHERE token = ?').run(approved?'approved':'rejected',member?.id??null,token);
        db.exec('COMMIT'); return {status:approved?'approved':'rejected', member};
      } catch(error) { db.exec('ROLLBACK'); throw error; }
    },
    joinInvitation(token, name, validate) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const invitation = db.prepare('SELECT * FROM household_invitations WHERE token = ?').get(token);
        if (!invitation || invitation.used || invitation.expires_at < Date.now()) throw new Error('دعوت نامعتبر، منقضی یا قبلاً استفاده شده است.');
        const row = this.read();
        if (!row) throw new Error('فضای مشترک در دسترس نیست.');
        const data = JSON.parse(row.payload);
        const member = { id: crypto.randomUUID(), name, role: 'editor' };
        data.settings.members.push(member);
        validate(data);
        db.prepare('INSERT INTO finance_snapshots(payload) VALUES(?)').run(JSON.stringify(data));
        db.prepare('UPDATE household_invitations SET used = 1 WHERE token = ?').run(token);
        db.exec('COMMIT');
        return { data, member };
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close() { db.close(); },
  };
}
