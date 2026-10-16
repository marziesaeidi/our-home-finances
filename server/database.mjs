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
