import { build } from 'esbuild';
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

test('invitation API creates and redeems a single-use link with a self-selected name', async () => {
 const bundle=await build({stdin:{contents:"import {initialData} from './src/data'; import {migrate} from './src/store'; export const data=migrate(initialData,'2026-10-16T00:00:00Z');",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
 const {data}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 const server=await startDatabaseServer({filename:':memory:',port:0});
 const url=`http://127.0.0.1:${server.address().port}/api/database/invitations`;
 const post=(path,body,origin=new URL(url).origin)=>fetch(url+path,{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});
 try {
  assert.equal((await post('',{data,viewer:'مرزیه'},'https://attacker.example')).status,403);
  assert.equal((await post('',{data,viewer:'علی'})).status,403);
  const response=await post('',{data,viewer:'مرزیه'});assert.equal(response.status,201);
  const {token}=await response.json();assert.match(token,/^[a-f0-9]{64}$/);
  assert.equal((await post('/join',{token,name:'  '})).status,400);
  const joined=await post('/join',{token,name:' عضو تازه '});assert.equal(joined.status,200);
  const result=await joined.json();assert.equal(result.member.name,'عضو تازه');assert.equal(result.member.role,'editor');
  assert.deepEqual(result.data.transactions,data.transactions);
  assert.equal((await post('/join',{token,name:'دوباره'})).status,400);
 } finally {await new Promise(resolve=>server.close(resolve));}
});
