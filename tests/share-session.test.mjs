import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {openDatabase} from '../server/database.mjs';
import {getEmailSession} from '../server/share-session.mjs';

test('verified email recovers pending and approved membership without browser tokens and respects removal',()=>{
 const directory=mkdtempSync(join(tmpdir(),'share-session-')),filename=join(directory,'test.sqlite');
 const db=openDatabase(filename);
 try {
  db.save({settings:{members:[{id:'owner',name:'Owner',role:'owner'}]},transactions:[]},0);
  assert.equal(getEmailSession('owner@example.com',filename,'owner@example.com').member.id,'owner');
  assert.deepEqual(getEmailSession('owner@example.com',filename),{status:'unknown'});
  assert.deepEqual(getEmailSession('stranger@example.com',filename,'owner@example.com'),{status:'unknown'});
  db.createInvitation('invite',Date.now()+10000);db.requestAccess('invite','Member','member@example.com','request');
  assert.deepEqual(getEmailSession('unknown@example.com',filename),{status:'unknown'});
  assert.deepEqual(getEmailSession('member@example.com',filename),{status:'pending',token:'request'});
  db.decideAccess('request',true,()=>{});
  const session=getEmailSession('MEMBER@example.com',filename);
  assert.equal(session.status,'approved');assert.equal(session.member.name,'Member');
  assert.equal('token' in session,false);
  const data=JSON.parse(db.read().payload);data.settings.members.find(m=>m.id===session.member.id).removed=true;db.save(data,db.read().revision);
  assert.deepEqual(getEmailSession('member@example.com',filename),{status:'rejected'});
  db.createInvitation('new-invite',Date.now()+10000);db.requestAccess('new-invite','Member','member@example.com','new-request');
  assert.deepEqual(getEmailSession('member@example.com',filename),{status:'pending',token:'new-request'});
  db.decideAccess('new-request',true,()=>{});
  const renewed=getEmailSession('member@example.com',filename);
  assert.equal(renewed.status,'approved');assert.notEqual(renewed.member.id,session.member.id);
 }finally{db.close();rmSync(directory,{recursive:true,force:true})}
});
