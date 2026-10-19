import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { startTestServer } from './app-helpers.mjs';
import { openDatabase } from '../server/database.mjs';
const read=(c,id)=>c.post(`/api/spaces/${id}/read`);
async function setup(app){
 const c=app.client();const [personal]=await c.signup('Sara','move@example.com');const {body:{space:shared}}=await c.post('/api/spaces',{name:'خانه'});
 const old=(await read(c,personal.id)).body.data;const data=structuredClone(old);data.assets.push({id:'gold',name:'طلا',kind:'gold',unit:'گرم',quantity:'2.50',openingQuantity:'2.50',cost:200,openingCost:200,custody:'خانه',owner:personal.memberId,visibility:'private'});
 assert.equal((await c.post(`/api/spaces/${personal.id}/write`,{data,expected:old})).status,200);
 return {c,personal,shared};
}
test('real API atomically moves one asset, retries after a lost response, and moves back',async()=>{
 const app=await startTestServer();try{const {c,personal,shared}=await setup(app);const selection={kind:'assets',id:'gold'};
 const preview=await c.post(`/api/spaces/${personal.id}/transfer-preview`,{targetId:shared.id,selection});assert.equal(preview.status,200);
 const body={targetId:shared.id,selection,accountMap:{},requestId:randomUUID(),sourceRevision:preview.body.sourceRevision,targetRevision:preview.body.targetRevision};
 const moved=await c.post(`/api/spaces/${personal.id}/transfer`,body);assert.equal(moved.status,200,JSON.stringify(moved.body));
 assert.equal((await c.post(`/api/spaces/${personal.id}/transfer`,body)).status,200);
 const source=(await read(c,personal.id)).body.data,target=(await read(c,shared.id)).body.data;assert.equal(source.assets.length,0);assert.equal(target.assets.length,1);assert.equal(target.spaceTransfers.length,1);assert.equal(target.assets[0].visibility,'shared');
 assert.equal((await c.post(`/api/spaces/${personal.id}/transfer`,{...body,selection:{kind:'goals',id:'x'}})).status,409);
 const backSelection={kind:'assets',id:target.assets[0].id};const back=(await c.post(`/api/spaces/${shared.id}/transfer-preview`,{targetId:personal.id,selection:backSelection})).body;
 assert.equal((await c.post(`/api/spaces/${shared.id}/transfer`,{targetId:personal.id,selection:backSelection,accountMap:{},requestId:randomUUID(),sourceRevision:back.sourceRevision,targetRevision:back.targetRevision})).status,200);
 assert.equal((await read(c,shared.id)).body.data.assets.length,0);assert.equal((await read(c,personal.id)).body.data.assets[0].quantity,'2.50');
 }finally{await app.close()}
});
test('stale revisions and unauthorized targets never remove the source',async()=>{
 const app=await startTestServer();try{const {c,personal,shared}=await setup(app),selection={kind:'assets',id:'gold'};
 const preview=(await c.post(`/api/spaces/${personal.id}/transfer-preview`,{targetId:shared.id,selection})).body;
 const old=(await read(c,shared.id)).body.data;const next=structuredClone(old);next.settings.name='تغییر';await c.post(`/api/spaces/${shared.id}/write`,{data:next,expected:old});
 assert.equal((await c.post(`/api/spaces/${personal.id}/transfer`,{targetId:shared.id,selection,accountMap:{},requestId:randomUUID(),sourceRevision:preview.sourceRevision,targetRevision:preview.targetRevision})).status,409);
 const other=app.client();const [foreign]=await other.signup('Ali','not-yours@example.com');assert.equal((await c.post(`/api/spaces/${personal.id}/transfer-preview`,{targetId:foreign.id,selection})).status,404);
 assert.equal((await read(c,personal.id)).body.data.assets.length,1);assert.equal((await read(c,shared.id)).body.data.assets.length,0);
 }finally{await app.close()}
});
test('database rolls back both snapshots when preparation fails',()=>{
 const db=openDatabase(':memory:');try{const data=id=>({settings:{name:id,members:[{id,name:id,role:'owner'}]}});const user=db.createUser({name:'u',email:'a@b.c',passwordHash:'x'},data);const source=db.spaces(user.id)[0],target=db.createHousehold(user.id,data(user.id));const a=db.read(source.id),b=db.read(target);
 assert.throws(()=>db.transferSpaces(user.id,'request','fingerprint',source.id,target,a.revision,b.revision,()=>{throw new Error('reject')}),/reject/);assert.equal(db.read(source.id).revision,a.revision);assert.equal(db.read(target).revision,b.revision);
 }finally{db.close()}
});

test('failure while inserting destination snapshot rolls back the already inserted source snapshot',async()=>{
 const app=await startTestServer();try{const {c,personal,shared}=await setup(app),selection={kind:'assets',id:'gold'};const preview=(await c.post(`/api/spaces/${personal.id}/transfer-preview`,{targetId:shared.id,selection})).body;
 const db=new DatabaseSync(app.filename);db.exec(`CREATE TRIGGER fail_target BEFORE INSERT ON space_snapshots WHEN NEW.space_id='${shared.id}' BEGIN SELECT RAISE(ABORT,'test target failure'); END;`);db.close();
 const result=await c.post(`/api/spaces/${personal.id}/transfer`,{targetId:shared.id,selection,accountMap:{},requestId:randomUUID(),sourceRevision:preview.sourceRevision,targetRevision:preview.targetRevision});assert.equal(result.status,400);
 assert.equal((await read(c,personal.id)).body.revision,preview.sourceRevision);assert.equal((await read(c,personal.id)).body.data.assets.length,1);assert.equal((await read(c,shared.id)).body.revision,preview.targetRevision);
 }finally{await app.close()}
});
test('a read-only membership cannot receive or send transfers through the API',async()=>{
 const app=await startTestServer();try{const {c,personal,shared}=await setup(app);const old=(await read(c,shared.id)).body.data,next=structuredClone(old);next.settings.members[0].role='reader';next.settings.members.push({id:'other-owner',name:'Owner',role:'owner'});assert.equal((await c.post(`/api/spaces/${shared.id}/write`,{data:next,expected:old})).status,200);
 assert.equal((await c.post(`/api/spaces/${personal.id}/transfer-preview`,{targetId:shared.id,selection:{kind:'assets',id:'gold'}})).status,403);assert.equal((await c.post(`/api/spaces/${shared.id}/transfer-preview`,{targetId:personal.id,selection:{kind:'assets',id:'gold'}})).status,403);
 }finally{await app.close()}
});
