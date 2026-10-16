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

test('invitations expire, are single use, and join atomically without changing financial records', () => {
 const db=openDatabase(':memory:');
 try {
  const data={settings:{members:[{id:'owner',name:'Owner',role:'owner'}]},transactions:[{id:'historical',amount:42}]};
  db.save(data,0);
  db.createInvitation('expired',Date.now()-1000);
  assert.throws(()=>db.joinInvitation('expired','New',()=>{}));
  db.createInvitation('valid',Date.now()+10000);
  assert.throws(()=>db.joinInvitation('valid','New',()=>{throw new Error('validation');}),/validation/);
  assert.equal(db.read().revision,1);
  const joined=db.joinInvitation('valid','Chosen name',()=>{});
  assert.equal(joined.member.name,'Chosen name');assert.equal(joined.member.role,'editor');
  assert.deepEqual(joined.data.transactions,data.transactions);
  assert.equal(joined.data.settings.members.length,2);
  assert.throws(()=>db.joinInvitation('valid','Again',()=>{}));
  assert.equal(db.read().revision,2);
 } finally {db.close();}
});
