import {build} from 'esbuild';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer,request} from 'node:http';
import {startDatabaseServer} from '../server/sqlite.mjs';
import {startShareGateway} from '../server/share-gateway.mjs';
import {getEmailSession} from '../server/share-session.mjs';
const bundle=await build({stdin:{contents:"export {initialData} from './src/data';export {migrate} from './src/store';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const {initialData,migrate}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const directory=await mkdtemp(join(tmpdir(),'khaneh-browser-test-'));
const filename=join(directory,'test.sqlite');
const secret='test-only-local-fixture-secret';
const ownerEmail='test-owner@example.com';
const database=await startDatabaseServer({filename,port:0,publicOrigin:"https://fixture.ngrok.app",identitySecret:secret,ownerEmail});
const api=async(path,body)=>{const r=await fetch(`http://127.0.0.1:${database.address().port}/api/database${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return r.json()};
const data=migrate(structuredClone(initialData),'2026-10-17T10:00:00Z');
const invite=await api('/invitations',{data,viewer:'مرزیه',revision:0});
const access=await api('/invitations/join',{token:invite.token,name:'عضو آزمایشی',email:'test-member@example.com'});
await api('/access/decide',{ownerKey:invite.ownerKey,token:access.token,approved:true});
const gateway=await startShareGateway({port:0,publicOrigin:"https://fixture.ngrok.app",databasePort:database.address().port,identitySecret:secret,getSession:email=>getEmailSession(email,filename,ownerEmail)});
let offline=false;
for(const [port,email] of [[4190,ownerEmail],[4192,'test-member@example.com']]){
 const front=createServer(async(req,res)=>{
  if(req.url==='/__test__/offline'){offline=true;res.end('offline');return;}
  if(req.url==='/__test__/online'){offline=false;res.end('online');return;}
  if(req.url==='/__test__/race'){const current=await api('/sync',{action:'read',ownerKey:invite.ownerKey});const next=structuredClone(current.data);next.settings.name='تغییر همزمان آزمایشی';await api('/sync',{action:'write',ownerKey:invite.ownerKey,expected:current.data,data:next});res.end('changed');return;}
  if(offline&&req.url==='/api/database/sync'){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'ارتباط آزمایشی قطع شده است.'}));return;}
  const upstream=request({hostname:'127.0.0.1',port:gateway.address().port,path:req.url,method:req.method,headers:{...req.headers,origin:'https://fixture.ngrok.app','x-khaneh-gateway-key':secret,'x-khaneh-google-email':email}},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res)});
  upstream.on('error',()=>{res.writeHead(502);res.end()});req.pipe(upstream);
 });
 await new Promise(r=>front.listen(port,'127.0.0.1',r));
}
console.log('Isolated browser fixtures: owner http://127.0.0.1:4190 / member http://127.0.0.1:4192');
