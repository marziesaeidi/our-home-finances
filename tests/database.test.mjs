import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../server/database.mjs';

test('SQLite preserves exact snapshots, detects conflicts and survives reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'khaneh-sqlite-'));
  const filename = join(directory, 'test.sqlite');
  let db = openDatabase(filename);
  try {
    assert.equal(db.read(), null);
    const original = { amount: 9007199254740991, currency: 'IRT', historicalRate: '123.456', ids: ['a', 'b'] };
    assert.equal(db.save(original, 0), 1);
    assert.throws(() => db.save({ amount: 0 }, 0), /REVISION_CONFLICT/);
    assert.deepEqual(JSON.parse(db.read().payload), original);
    db.close(); db = openDatabase(filename);
    assert.deepEqual(JSON.parse(db.read().payload), original);
    assert.equal(db.save({ ...original, amount: 10 }, 1), 2);
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
