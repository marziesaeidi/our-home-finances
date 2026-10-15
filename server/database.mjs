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
    close() { db.close(); },
  };
}
