import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startDatabaseServer } from '../server/sqlite.mjs';

test('database accepts only the configured HTTPS origin and rejects arbitrary origins', async () => {
  const server = await startDatabaseServer({ filename: ':memory:', port: 0, publicOrigin: 'https://example.ngrok-free.dev' });
  const url = `http://127.0.0.1:${server.address().port}/api/database`;
  try {
    const request = origin => fetch(url, { method: 'PUT', headers: { origin, 'content-type': 'application/json' }, body: '{}' });
    assert.equal((await request('https://attacker.example')).status, 403);
    assert.equal((await request('https://example.ngrok-free.dev.attacker.example')).status, 403);
    // Invalid payload reaches validation only after the configured origin is accepted.
    assert.equal((await request('https://example.ngrok-free.dev')).status, 400);
    assert.equal((await request(new URL(url).origin)).status, 400);
    assert.deepEqual(await (await fetch(url)).json(), { revision: 0, data: null });
  } finally { await new Promise(resolve => server.close(resolve)); }
});
