import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { startShareGateway } from '../server/share-gateway.mjs';

test('public gateway blocks owner and snapshot routes, and only forwards invitation requests', async () => {
  let calls = 0;
  const upstream = createServer((req,res) => { calls++; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({status:'pending',path:req.url})); });
  await new Promise(resolve => upstream.listen(0,'127.0.0.1',resolve));
  const invitation = 'a'.repeat(64);
  const gateway = await startShareGateway({publicOrigin:'https://example.ngrok.app',port:0,databasePort:upstream.address().port,getInvitation:()=>invitation,identitySecret:'test-only-key',getSession:email=>email==='member@example.com'?{status:'approved',member:{id:'guest'}}:{status:'unknown'}});
  const base = `http://127.0.0.1:${gateway.address().port}`;
  try {
    const page = await fetch(base+'/');
    const html = await page.text();
    assert.match(html, /name="khaneh-public-share"/);
    assert.ok(html.includes(`name="khaneh-invitation" content="${invitation}"`), 'root without query recovers invitation after OAuth');
    assert.equal((await fetch(base+'/api/share/session',{headers:{'x-khaneh-google-email':'member@example.com'}})).status,401);
    const signed = {'x-khaneh-google-email':'member@example.com','x-khaneh-gateway-key':'test-only-key'};
    assert.equal((await (await fetch(base+'/api/share/session',{headers:signed})).json()).status,'approved');
    assert.equal((await (await fetch(base+'/api/share/session',{headers:{...signed,'x-khaneh-google-email':'other@example.com'}})).json()).status,'unknown');
    for (const path of ['/api/database','/api/database/invitations','/api/database/access/list','/api/database/access/decide','/api/database/access/status?extra=1','/api%2fdatabase','/api/database/access/%73tatus']) {
      assert.equal((await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403,path);
    }
    assert.equal((await fetch(base+'/api/database')).status,403);
    assert.equal(calls,0);
    for (const path of ['/api/database/invitations/join','/api/database/access/status']) {
      assert.equal((await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:'{}'})).status,403);
      const result = await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.ngrok.app'},body:'{}'});
      assert.equal(result.status,200); assert.equal((await result.json()).status,'pending');
    }
    assert.equal((await fetch(base+'/api/database/access/status',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(4097)})).status,413);
    assert.equal(calls,2);
  } finally { await Promise.all([new Promise(r=>gateway.close(r)),new Promise(r=>upstream.close(r))]); }
});
