import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {startDatabaseServer} from '../server/sqlite.mjs';

test('one invitation action saves browser changes, retains new approvals and removal tombstones, and rejects races',async()=>{
 const bundle=await build({stdin:{contents:"import {initialData} from './src/data';import {migrate} from './src/store';export const data=migrate(initialData,'2026-10-16T12:00:00Z');",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
 const {data}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
 const server=await startDatabaseServer({filename:':memory:',port:0});
 const base=`http://127.0.0.1:${server.address().port}/api/database`;
 const post=async(path,body)=>{const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {httpStatus:response.status,...await response.json()}};
 try {
  const first=await post('/invitations',{data,viewer:'مرزیه',revision:0});assert.equal(first.httpStatus,201);
  const request=await post('/invitations/join',{token:first.token,name:'New member',email:'member@example.com'});assert.equal(request.httpStatus,202);
  const approved=await post('/access/decide',{ownerKey:first.ownerKey,token:request.token,approved:true});assert.equal(approved.status,'approved');
  const snapshot=await (await fetch(base)).json();
  const local=structuredClone(data);local.settings.name='Updated in browser';
  const next=await post('/invitations',{data:local,viewer:'مرزیه',revision:snapshot.revision});assert.equal(next.httpStatus,201);
  assert.ok(next.members.some(m=>m.id===approved.member.id));
  const saved=await (await fetch(base)).json();assert.equal(saved.data.settings.name,local.settings.name);
  assert.deepEqual(saved.data.transactions,local.transactions);assert.deepEqual(saved.data.accountEntries,local.accountEntries);
  const stale=await post('/invitations',{data:local,viewer:'مرزیه',revision:snapshot.revision});assert.equal(stale.httpStatus,409);
  local.settings.members=next.members.map(m=>m.id===approved.member.id?{...m,removed:true}:m);
  const removed=await post('/invitations',{data:local,viewer:'مرزیه',revision:saved.revision});assert.equal(removed.httpStatus,201);
  assert.equal(removed.members.find(m=>m.id===approved.member.id).removed,true);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
