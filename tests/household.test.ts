import test from 'node:test';
import { initialData } from '../src/data';
import assert from 'node:assert/strict';
import { migrate,validate,saveStore,loadStore } from '../src/store';
import { assertMemberChange,membersOf } from '../src/household-access';
import type { FinanceData } from '../src/types';
const fixture=()=>migrate(initialData,'2026-10-16T00:00:00Z');
test('member removal preserves financial records and membership survives storage reload',()=>{
 const data=fixture(); const next:FinanceData={...data,settings:{...data.settings,members:[...membersOf(data).map(m=>m.id==='علی'?{...m,removed:true}:m),{id:'سارا',name:'سارا',role:'reader'}]}};
 assertMemberChange(data,next,'مرزیه');validate(next);
 const memory=new Map<string,string>();const storage={getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>{memory.set(k,v)}};
 saveStore(storage,data);saveStore(storage,next,data);const restored=loadStore(storage,data,'2026-10-16T00:00:00Z');assert.deepEqual(restored,next);assert.deepEqual(restored.transactions,data.transactions);assert.throws(()=>assertMemberChange(next,next,'علی'));
});
test('reader cannot save financial changes or escalate access, but can select own profile image',()=>{
 const data=fixture();data.settings.members=membersOf(data).map(m=>m.id==='علی'?{...m,role:'reader'}:m);
 assert.throws(()=>assertMemberChange(data,{...data,settings:{...data.settings,name:'تغییر'}},'علی'));
 const elevated:FinanceData={...data,settings:{...data.settings,members:membersOf(data).map(m=>({...m,role:m.id==='علی'?'editor':m.role}))}};
 assert.throws(()=>assertMemberChange(data,elevated,'علی'));
 const photo:FinanceData={...data,settings:{...data.settings,members:membersOf(data).map(m=>m.id==='علی'?{...m,avatar:'data:image/png;base64,YQ=='}:m)}};
 assert.doesNotThrow(()=>assertMemberChange(data,photo,'علی'));validate(photo);
});
test('member validation rejects duplicate identities, missing owner and invalid avatars',()=>{
 for(const members of [[...membersOf(fixture()),membersOf(fixture())[0]],[{id:'a',name:'عضو',role:'reader'}],[{id:'a',name:'مالک',role:'owner',avatar:'javascript:invalid'}]]) {
  const data=fixture();data.settings.members=members as FinanceData['settings']['members'];assert.throws(()=>validate(data));
 }
});

test('every member can rename only their own profile without changing identity or access',()=>{
 for(const role of ['owner','editor','reader'] as const) {
  const data=fixture(); const viewer=role==='owner'?'مرزیه':'علی';
  data.settings.members=membersOf(data).map(m=>m.id===viewer?{...m,role}:m);
  const renamed:FinanceData={...data,settings:{...data.settings,members:membersOf(data).map(m=>m.id===viewer?{...m,name:'نام جدید'}:m)}};
  assert.doesNotThrow(()=>assertMemberChange(data,renamed,viewer));validate(renamed);
  assert.deepEqual(renamed.transactions,data.transactions);
  if(role!=='owner') {
   const other:FinanceData={...data,settings:{...data.settings,members:membersOf(data).map(m=>m.id!==viewer?{...m,name:'تغییر غیرمجاز'}:m)}};
   assert.throws(()=>assertMemberChange(data,other,viewer));
   const changedId:FinanceData={...renamed,settings:{...renamed.settings,members:membersOf(renamed).map(m=>m.id===viewer?{...m,id:'new-id'}:m)}};
   assert.throws(()=>assertMemberChange(data,changedId,viewer));
  }
 }
});
