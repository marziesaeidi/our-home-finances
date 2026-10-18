import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../server/database.mjs';

const personal = id => ({ settings: { name: 'personal', members: [{ id, name: 'x', role: 'owner' }] } });

// Builds a database exactly as the single-household version (schema 1) left it.
function legacyDatabase(filename, snapshots) {
  const db = new DatabaseSync(filename);
  db.exec(`CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY);
    CREATE TABLE finance_snapshots(revision INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL CHECK(json_valid(payload)), created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')));
    CREATE TABLE household_invitations(token TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE access_requests(token TEXT PRIMARY KEY, invitation TEXT NOT NULL UNIQUE, name TEXT NOT NULL, email TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', member_id TEXT);
    CREATE TABLE owner_keys(token TEXT PRIMARY KEY);
    INSERT INTO schema_migrations VALUES(1);
    INSERT INTO owner_keys VALUES('legacy-owner-key');`);
  for (const snapshot of snapshots) db.prepare('INSERT INTO finance_snapshots(payload) VALUES(?)').run(JSON.stringify(snapshot));
  db.close();
}

test('the single-household database migrates with full history, unlinked, and old credentials are dropped', () => {
  const directory = mkdtempSync(join(tmpdir(), 'khaneh-migrate-'));
  const filename = join(directory, 'legacy.sqlite');
  try {
    legacyDatabase(filename, [{ settings: { name: 'v1' }, transactions: [] }, { settings: { name: 'v2' }, transactions: [{ id: 'kept', amount: 42 }] }]);
    let db = openDatabase(filename);
    const raw = new DatabaseSync(filename);
    const tables = raw.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);
    for (const old of ['finance_snapshots', 'owner_keys', 'access_requests', 'household_invitations']) assert.ok(!tables.includes(old), old);
    const [space] = raw.prepare('SELECT id, kind FROM spaces').all();
    assert.equal(space.kind, 'household');
    assert.equal(raw.prepare('SELECT count(*) n FROM space_members').get().n, 0);
    const history = raw.prepare('SELECT revision, payload FROM space_snapshots ORDER BY revision').all();
    assert.deepEqual(history.slice(0, 2).map(row => JSON.parse(row.payload).settings.name), ['v1', 'v2']);
    const latest = JSON.parse(db.read(space.id).payload);
    assert.deepEqual(latest.transactions, [{ id: 'kept', amount: 42 }]);
    assert.deepEqual(latest.settings.members.map(m => m.id), ['مرزیه', 'علی']);
    raw.close();

    // Migration runs once; reopening keeps the same space and history.
    db.close(); db = openDatabase(filename);
    assert.equal(db.read(space.id).revision, history.at(-1).revision);

    db.createUser({ name: 'Marzieh', email: 'owner@example.com', passwordHash: 'x' }, personal);
    db.close();
    const output = execFileSync(process.execPath, ['scripts/link-member.mjs', 'owner@example.com', 'مرزیه'], { env: { ...process.env, DATABASE_PATH: filename }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    assert.match(output, /Linked owner@example.com/);
    db = openDatabase(filename);
    const user = db.credentials('owner@example.com');
    const household = db.spaces(user.id).find(s => s.kind === 'household');
    assert.deepEqual([household.id, household.role, household.memberId], [space.id, 'owner', 'مرزیه']);
    assert.throws(() => db.linkMember('owner@example.com', 'nobody'), /does not exist/);
    assert.throws(() => db.linkMember('missing@example.com', 'علی'), /No account/);
    db.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('snapshots are scoped per space, conflict-checked and survive reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'khaneh-db-'));
  const filename = join(directory, 'test.sqlite');
  try {
    let db = openDatabase(filename);
    const sara = db.createUser({ name: 'Sara', email: 'sara@example.com', passwordHash: 'x' }, personal);
    const ali = db.createUser({ name: 'Ali', email: 'ali@example.com', passwordHash: 'x' }, personal);
    assert.throws(() => db.createUser({ name: 'Sara', email: 'SARA@example.com', passwordHash: 'x' }, personal), /EMAIL_TAKEN/);
    const [saraSpace] = db.spaces(sara.id), [aliSpace] = db.spaces(ali.id);
    assert.notEqual(saraSpace.id, aliSpace.id);
    assert.equal(db.memberId(saraSpace.id, ali.id), null);
    const revision = db.read(saraSpace.id).revision;
    const next = { ...personal(sara.id), changed: true };
    assert.equal(db.save(saraSpace.id, next, revision) > revision, true);
    assert.throws(() => db.save(saraSpace.id, next, revision), /REVISION_CONFLICT/);
    assert.equal(JSON.parse(db.read(aliSpace.id).payload).changed, undefined);

    const session = db.createSession(sara.id);
    assert.equal(db.sessionUser(session.token).id, sara.id);
    assert.equal(db.sessionUser('f'.repeat(64)), null);
    db.close(); db = openDatabase(filename);
    assert.deepEqual(JSON.parse(db.read(saraSpace.id).payload), next);
    assert.equal(db.sessionUser(session.token).id, sara.id);
    db.deleteSession(session.token);
    assert.equal(db.sessionUser(session.token), null);
    db.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('approving a request can attach the account to an existing unlinked member', () => {
  const db = openDatabase(':memory:');
  try {
    const owner = db.createUser({ name: 'Sara', email: 'sara@example.com', passwordHash: 'x' }, personal);
    const ali = db.createUser({ name: 'Ali', email: 'ali@example.com', passwordHash: 'x' }, personal);
    const spaceId = db.createHousehold(owner.id, { settings: { name: 'home', members: [{ id: owner.id, name: 'Sara', role: 'owner' }, { id: 'legacy-ali', name: 'علی', role: 'editor' }] } });
    const token = db.createInvitation(spaceId, owner.id);
    db.joinRequest(token, ali.id);
    const [request] = db.requests(spaceId);
    assert.throws(() => db.decide(spaceId, request.id, true, owner.id, () => {}), /MEMBER_UNAVAILABLE/);
    assert.equal(db.decide(spaceId, request.id, true, 'legacy-ali', () => {}).member.id, 'legacy-ali');
    assert.equal(db.memberId(spaceId, ali.id), 'legacy-ali');
    assert.equal(JSON.parse(db.read(spaceId).payload).settings.members.length, 2);
  } finally { db.close(); }
});
