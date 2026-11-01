import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const databasePath = resolve(process.env.DATABASE_PATH || './data/khaneh.sqlite');

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const INVITATION_MS = 7 * 24 * 60 * 60 * 1000;
// Only hashes of bearer secrets are stored, so a copied database file grants no access.
const digest = token => createHash('sha256').update(token).digest('hex');

export function openDatabase(filename = databasePath) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY);`);
  const transaction = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const tableExists = name => !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);

  const read = spaceId => db.prepare('SELECT revision, payload, created_at FROM space_snapshots WHERE space_id = ? ORDER BY revision DESC LIMIT 1').get(spaceId) ?? null;
  const insertSnapshot = (spaceId, data) => Number(db.prepare('INSERT INTO space_snapshots(space_id, payload) VALUES(?, ?)').run(spaceId, JSON.stringify(data)).lastInsertRowid);

  if (!db.prepare('SELECT version FROM schema_migrations WHERE version = 2').get()) transaction(() => {
    db.exec(`
      CREATE TABLE users(
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
        password_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE TABLE sessions(
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL
      );
      CREATE TABLE spaces(
        id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('personal','household')),
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE TABLE space_members(
        space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        member_id TEXT NOT NULL, PRIMARY KEY(space_id, user_id), UNIQUE(space_id, member_id)
      );
      CREATE TABLE space_snapshots(
        revision INTEGER PRIMARY KEY AUTOINCREMENT, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        payload TEXT NOT NULL CHECK(json_valid(payload)), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      );
      CREATE INDEX space_snapshots_latest ON space_snapshots(space_id, revision);
      CREATE TABLE invitations(
        token_hash TEXT PRIMARY KEY, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE join_requests(
        id TEXT PRIMARY KEY, invitation TEXT NOT NULL UNIQUE, space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'pending', member_id TEXT
      );`);
    // Version 1 held one household with no user accounts. Keep its full history as the first household;
    // nobody is linked to it until scripts/link-member.mjs attaches a registered user to a member.
    if (tableExists('finance_snapshots') && db.prepare('SELECT 1 FROM finance_snapshots LIMIT 1').get()) {
      const spaceId = randomUUID();
      db.prepare("INSERT INTO spaces(id, kind) VALUES(?, 'household')").run(spaceId);
      db.prepare('INSERT INTO space_snapshots(revision, space_id, payload, created_at) SELECT revision, ?, payload, created_at FROM finance_snapshots ORDER BY revision').run(spaceId);
      // Older snapshots relied on the client's default member list; make it explicit so accounts can be linked.
      const latest = JSON.parse(read(spaceId).payload);
      if (latest.settings.members === undefined) {
        latest.settings.members = [{ id: 'مرزیه', name: 'مرزیه', role: 'owner' }, { id: 'علی', name: 'علی', role: 'editor' }];
        insertSnapshot(spaceId, latest);
      }
    }
    db.exec(`DROP TABLE IF EXISTS finance_snapshots; DROP TABLE IF EXISTS household_invitations;
      DROP TABLE IF EXISTS access_requests; DROP TABLE IF EXISTS owner_keys;
      INSERT INTO schema_migrations VALUES(2);`);
  });

  if (!db.prepare('SELECT version FROM schema_migrations WHERE version = 3').get()) transaction(() => {
  db.exec(`CREATE TABLE IF NOT EXISTS space_transfer_operations(
    user_id TEXT NOT NULL REFERENCES users(id), request_id TEXT NOT NULL,
    fingerprint TEXT NOT NULL, result TEXT NOT NULL CHECK(json_valid(result)),
    PRIMARY KEY(user_id, request_id)
  ); INSERT INTO schema_migrations VALUES(3);`);
  });

  const createSpace = (kind, data, userId, memberId) => {
    const id = randomUUID();
    db.prepare('INSERT INTO spaces(id, kind) VALUES(?, ?)').run(id, kind);
    insertSnapshot(id, data);
    db.prepare('INSERT INTO space_members(space_id, user_id, member_id) VALUES(?, ?, ?)').run(id, userId, memberId);
    return id;
  };
  const publicUser = row => row ? { id: row.id, email: row.email, name: row.name } : null;

  return {
    // Users and sessions
    createUser({ name, email, passwordHash }, personalData) {
      return transaction(() => {
        if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw new Error('EMAIL_TAKEN');
        const id = randomUUID();
        db.prepare('INSERT INTO users(id, email, name, password_hash) VALUES(?, ?, ?, ?)').run(id, email, name, passwordHash);
        createSpace('personal', personalData(id), id, id);
        return { id, email, name };
      });
    },
    updateEmail(userId, email) {
      return transaction(() => {
        if (db.prepare('SELECT 1 FROM users WHERE email = ? AND id != ?').get(email, userId)) throw new Error('EMAIL_TAKEN');
        db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email, userId);
        return publicUser(db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(userId));
      });
    },
    credentials(email) { return db.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?').get(email) ?? null; },
    user(id) { return publicUser(db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(id)); },
    createSession(userId) {
      const token = randomBytes(32).toString('hex');
      db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
      db.prepare('INSERT INTO sessions(token_hash, user_id, expires_at) VALUES(?, ?, ?)').run(digest(token), userId, Date.now() + SESSION_MS);
      return { token, maxAge: SESSION_MS / 1000 };
    },
    sessionUser(token) {
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
      return publicUser(db.prepare('SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?').get(digest(token), Date.now()));
    },
    deleteSession(token) { if (typeof token === 'string') db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token)); },

    // Spaces. Roles live in each space's own member list, which the shared validator already governs.
    createHousehold(userId, data) { return transaction(() => createSpace('household', data, userId, userId)); },
    spaces(userId) {
      return db.prepare('SELECT s.id, s.kind, m.member_id FROM space_members m JOIN spaces s ON s.id = m.space_id WHERE m.user_id = ? ORDER BY s.kind DESC, s.created_at').all(userId).map(row => {
        const settings = JSON.parse(read(row.id).payload).settings;
        const member = (settings.members ?? []).find(m => m.id === row.member_id && !m.removed);
        return member && { id: row.id, kind: row.kind, name: settings.name, role: member.role, memberId: member.id };
      }).filter(Boolean);
    },
    memberId(spaceId, userId) { return db.prepare('SELECT member_id FROM space_members WHERE space_id = ? AND user_id = ?').get(spaceId, userId)?.member_id ?? null; },
    read,
    save(spaceId, data, expectedRevision) {
      return transaction(() => {
        if ((read(spaceId)?.revision ?? 0) !== expectedRevision) throw new Error('REVISION_CONFLICT');
        return insertSnapshot(spaceId, data);
      });
    },

    transferSpaces(userId, requestId, fingerprint, sourceId, targetId, sourceRevision, targetRevision, transform) {
      return transaction(() => {
        const old = db.prepare('SELECT fingerprint, result FROM space_transfer_operations WHERE user_id=? AND request_id=?').get(userId, requestId);
        if (old) { if (old.fingerprint !== fingerprint) throw new Error('TRANSFER_REQUEST_CONFLICT'); return JSON.parse(old.result); }
        const source = read(sourceId), target = read(targetId);
        if (!source || !target || source.revision !== sourceRevision || target.revision !== targetRevision) throw new Error('REVISION_CONFLICT');
        const next = transform(JSON.parse(source.payload), JSON.parse(target.payload));
        const result = { sourceRevision: insertSnapshot(sourceId, next.source), targetRevision: insertSnapshot(targetId, next.target), items: next.items };
        db.prepare('INSERT INTO space_transfer_operations VALUES(?,?,?,?)').run(userId, requestId, fingerprint, JSON.stringify(result));
        return result;
      });
    },

    // Invitations: single use, owner approval required.
    createInvitation(spaceId, userId) {
      const token = randomBytes(32).toString('hex');
      db.prepare('DELETE FROM invitations WHERE expires_at < ? AND used = 0').run(Date.now());
      db.prepare('INSERT INTO invitations(token_hash, space_id, created_by, expires_at) VALUES(?, ?, ?, ?)').run(digest(token), spaceId, userId, Date.now() + INVITATION_MS);
      return token;
    },
    joinRequest(token, userId) {
      return transaction(() => {
        const invitation = db.prepare('SELECT * FROM invitations WHERE token_hash = ?').get(digest(token));
        if (!invitation) throw new Error('INVITATION_INVALID');
        const existing = db.prepare('SELECT status FROM join_requests WHERE invitation = ?').get(invitation.token_hash);
        if (existing) {
          if (db.prepare('SELECT 1 FROM join_requests WHERE invitation = ? AND user_id = ?').get(invitation.token_hash, userId)) return { status: existing.status, spaceId: invitation.space_id };
          throw new Error('INVITATION_INVALID');
        }
        if (invitation.used || invitation.expires_at < Date.now()) throw new Error('INVITATION_INVALID');
        if (db.prepare('SELECT 1 FROM space_members WHERE space_id = ? AND user_id = ?').get(invitation.space_id, userId)) return { status: 'approved', spaceId: invitation.space_id };
        db.prepare('INSERT INTO join_requests(id, invitation, space_id, user_id) VALUES(?, ?, ?, ?)').run(randomUUID(), invitation.token_hash, invitation.space_id, userId);
        db.prepare('UPDATE invitations SET used = 1 WHERE token_hash = ?').run(invitation.token_hash);
        return { status: 'pending', spaceId: invitation.space_id };
      });
    },
    joinStatus(token, userId) {
      const request = db.prepare('SELECT status, space_id FROM join_requests WHERE invitation = ? AND user_id = ?').get(digest(token), userId);
      return request ? { status: request.status, spaceId: request.space_id } : null;
    },
    requests(spaceId) {
      return db.prepare("SELECT r.id, u.name, u.email FROM join_requests r JOIN users u ON u.id = r.user_id WHERE r.space_id = ? AND r.status = 'pending'").all(spaceId);
    },
    linkedMembers(spaceId) { return db.prepare('SELECT member_id FROM space_members WHERE space_id = ?').all(spaceId).map(row => row.member_id); },
    decide(spaceId, requestId, approved, memberId, validate) {
      return transaction(() => {
        const request = db.prepare("SELECT r.*, u.name FROM join_requests r JOIN users u ON u.id = r.user_id WHERE r.id = ? AND r.space_id = ? AND r.status = 'pending'").get(requestId, spaceId);
        if (!request) throw new Error('REQUEST_NOT_FOUND');
        let member = null;
        if (approved) {
          const data = JSON.parse(read(spaceId).payload);
          const members = data.settings.members ?? [];
          if (memberId) {
            // Attach the account to an existing unlinked member, keeping their history.
            member = members.find(m => m.id === memberId && !m.removed);
            if (!member || db.prepare('SELECT 1 FROM space_members WHERE space_id = ? AND member_id = ?').get(spaceId, memberId)) throw new Error('MEMBER_UNAVAILABLE');
          } else {
            member = { id: request.user_id, name: request.name.slice(0, 60), role: 'editor' };
            if (members.some(m => m.id === member.id)) throw new Error('MEMBER_UNAVAILABLE');
            data.settings.members = [...members, member];
            validate(data);
            insertSnapshot(spaceId, data);
          }
          db.prepare('INSERT INTO space_members(space_id, user_id, member_id) VALUES(?, ?, ?)').run(spaceId, request.user_id, member.id);
        }
        db.prepare('UPDATE join_requests SET status = ?, member_id = ? WHERE id = ?').run(approved ? 'approved' : 'rejected', member?.id ?? null, requestId);
        return { status: approved ? 'approved' : 'rejected', member };
      });
    },

    // Operator tool: attach a registered account to a member of a migrated household.
    linkMember(email, memberId, spaceId) {
      return transaction(() => {
        const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (!user) throw new Error(`No account is registered with ${email}`);
        const households = spaceId ? [{ id: spaceId }] : db.prepare("SELECT id FROM spaces WHERE kind = 'household'").all();
        if (households.length !== 1) throw new Error('Several households exist; pass the space id as well.');
        const target = households[0].id, row = read(target);
        if (!row) throw new Error('Household not found');
        const member = (JSON.parse(row.payload).settings.members ?? []).find(m => m.id === memberId && !m.removed);
        if (!member) throw new Error(`Member ${memberId} does not exist in that household`);
        db.prepare('DELETE FROM space_members WHERE space_id = ? AND member_id = ?').run(target, memberId);
        db.prepare('INSERT OR REPLACE INTO space_members(space_id, user_id, member_id) VALUES(?, ?, ?)').run(target, user.id, memberId);
        return { spaceId: target, member };
      });
    },
    close() { db.close(); },
  };
}
