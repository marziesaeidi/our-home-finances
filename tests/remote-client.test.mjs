import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export {commitRemote,setActiveSpace} from './src/remote-store';import {initialData} from './src/data';import {migrate} from './src/store';export const data=migrate(initialData,'2026-10-17T10:00:00Z');",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {commitRemote,setActiveSpace,data}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const storage={getItem:()=>null,setItem(){},removeItem(){}};
for(let round=1;round<=3;round++)test(`client confirms durable save and handles lost responses/offline/conflicts round ${round}`,async()=>{
 const originalFetch=globalThis.fetch,originalLocal=globalThis.localStorage,originalSession=globalThis.sessionStorage;
 globalThis.localStorage=storage;globalThis.sessionStorage=storage;setActiveSpace('user',{id:'space',kind:'household',name:'Home',role:'owner',memberId:'user'});
 try{
  const next=structuredClone(data);next.settings.name='durable candidate';
  let resolveWrite;let settled=false;
  globalThis.fetch=async()=>new Promise(resolve=>{resolveWrite=resolve});
  const pending=commitRemote(next,data).then(()=>{settled=true});
  await Promise.resolve();assert.equal(settled,false);
  resolveWrite(response({revision:2}));await pending;assert.equal(settled,true);
  let actions=[];
  globalThis.fetch=async url=>{const action=url.split('/').pop();actions.push(action);if(action==='write')throw new Error('response lost after commit');return response({data:next});};
  await commitRemote(next,data);assert.deepEqual(actions,['write','read']);
  actions=[];
  globalThis.fetch=async url=>{actions.push(url.split('/').pop());throw new Error('offline')};
  await assert.rejects(commitRemote(next,data),/offline/);assert.deepEqual(actions,['write','read']);
  actions=[];
  globalThis.fetch=async url=>{const action=url.split('/').pop();actions.push(action);return action==='write'?response({error:'revision conflict'},409):response({data});};
  await assert.rejects(commitRemote(next,data),/revision conflict/);assert.deepEqual(actions,['write','read']);
  assert.notEqual(data.settings.name,next.settings.name);
 }finally{globalThis.fetch=originalFetch;globalThis.localStorage=originalLocal;globalThis.sessionStorage=originalSession;}
});
