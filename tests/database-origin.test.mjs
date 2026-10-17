import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startDatabaseServer } from '../server/sqlite.mjs';

test('proxied local app origin reaches invitation validation; unrelated origins are rejected', async () => {
  const server = await startDatabaseServer({filename:':memory:',port:0});
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/database/invitations`;
    for (const origin of ['http://127.0.0.1:4173','http://localhost:4173']) {
      const response = await fetch(url,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
      assert.equal(response.status,400);
      assert.notEqual((await response.json()).error,'Origin rejected');
    }
    const response = await fetch(url,{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});
    assert.equal(response.status,403);
    assert.equal((await response.json()).error,'Origin rejected');
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
