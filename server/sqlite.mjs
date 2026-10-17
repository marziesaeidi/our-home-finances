import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { openDatabase } from './database.mjs';

export async function startDatabaseServer({ filename, port = 8789, publicOrigin = process.env.APP_PUBLIC_ORIGIN, identitySecret, ownerEmail } = {}) {
  // Explicit deployment origin only; never trust client-supplied forwarding headers.
  if (publicOrigin && (new URL(publicOrigin).origin !== publicOrigin || !publicOrigin.startsWith('https://'))) {
    throw new Error('APP_PUBLIC_ORIGIN must be an HTTPS origin without a trailing slash');
  }
  // Reuse the application's complete financial validator on the server.
  const bundle = await build({ entryPoints: [fileURLToPath(new URL('../src/store.ts', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm' });
  const { validate } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const accessBundle = await build({ entryPoints: [fileURLToPath(new URL('../src/household-access.ts', import.meta.url))], bundle:true, write:false, platform:'node', format:'esm' });
  const { assertMemberChange, membersOf } = await import('data:text/javascript;base64,' + Buffer.from(accessBundle.outputFiles[0].text).toString('base64'));
  const database = openDatabase(filename);
  // Vite's proxy can replace Host with the API target while retaining browser Origin.
  const localAppOrigins = new Set(['http://127.0.0.1:4173', 'http://localhost:4173', 'http://127.0.0.1:5173', 'http://localhost:5173']);
  const acceptsOrigin = req => !req.headers.origin || req.headers.origin === `http://${req.headers.host}` || req.headers.origin === publicOrigin || localAppOrigins.has(req.headers.origin);
  const server = createServer(async (req, res) => {
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    // The owner console is loopback-only and this route is never exposed by the public gateway.
    if(req.url==='/api/database/local-session') {
      if(req.method!=='POST')return send(405,{error:'Method not allowed'});
      if(!localAppOrigins.has(req.headers.origin))return send(403,{error:'Local owner console required'});
      if(!req.headers['content-type']?.startsWith('application/json'))return send(415,{error:'JSON required'});
      const row=database.read();if(!row)return send(200,{data:null});
      const data=JSON.parse(row.payload),member=membersOf(data).find(m=>m.role==='owner'&&!m.removed);
      if(!member)return send(409,{error:'مالک فعال پیدا نشد.'});
      const ownerKey=randomBytes(32).toString('hex');database.addOwnerKey(ownerKey);
      return send(200,{data,member,ownerKey});
    }
    if (req.url === '/api/database/sync') {
      if (req.method !== 'POST') return send(405,{error:'Method not allowed'});
      if (!acceptsOrigin(req)) return send(403,{error:'Origin rejected'});
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415,{error:'JSON required'});
      try {
        const chunks=[];let size=0;
        for await(const chunk of req){size+=chunk.length;if(size>10_000_000)return send(413,{error:'Payload too large'});chunks.push(chunk);}
        const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const row=database.read();
        if(!row)return send(409,{error:'فضای مشترک هنوز ایجاد نشده است.'});
        const current=JSON.parse(row.payload);
        let member;
        // Identity comes from a bearer credential or the signed OAuth gateway, never body.viewer.
        if(identitySecret && req.headers['x-khaneh-gateway-key']===identitySecret && typeof req.headers['x-khaneh-google-email']==='string') {
          member=database.emailMember(req.headers['x-khaneh-google-email'],ownerEmail);
        } else if(typeof body.ownerKey==='string' && database.isOwnerKey(body.ownerKey)) {
          member=membersOf(current).find(m=>m.role==='owner'&&!m.removed);
        } else if(typeof body.token==='string') {
          const access=database.accessStatus(body.token);if(access.status==='approved')member=access.member;
        }
        if(!member)return send(403,{error:'دسترسی فعال لازم است؛ دوباره وارد شو.'});
        if(body.action==='read')return send(200,{data:current,member,revision:row.revision});
        if(['invite','requests','decide'].includes(body.action)) {
          if(member.role!=='owner')return send(403,{error:'دسترسی مالک لازم است.'});
          if(body.action==='requests')return send(200,{requests:database.requests()});
          if(body.action==='decide') {
            if(typeof body.approved!=='boolean')return send(400,{error:'تصمیم معتبر لازم است.'});
            return send(200,database.decideAccess(body.requestToken,body.approved,validate));
          }
          const token=randomBytes(32).toString('hex');
          database.createInvitation(token,Date.now()+7*24*60*60*1000);
          return send(201,{token,publicOrigin,members:membersOf(current)});
        }
        if(body.action!=='write')return send(400,{error:'عملیات معتبر نیست.'});
        if(JSON.stringify(body.data)===JSON.stringify(current))return send(200,{revision:row.revision});
        if(JSON.stringify(body.expected)!==JSON.stringify(current))return send(409,{error:'اطلاعات دستگاه دیگری تغییر کرده است. تغییر ثبت نشد؛ صفحه را تازه‌سازی کن و دوباره ثبت کن.'});
        validate(body.data);
        try{assertMemberChange(current,body.data,member.id);}catch(error){return send(403,{error:error.message});}
        // A response lost after commit can safely be checked using the exact candidate snapshot.
        const revision=database.save(body.data,row.revision);
        return send(200,{revision});
      }catch(error){return send(error.message==='REVISION_CONFLICT'?409:400,{error:error.message});}
    }
    const invitationRoute = req.url === '/api/database/invitations';
    const joinRoute = req.url === '/api/database/invitations/join';
    const accessRoute = ['/api/database/access/status','/api/database/access/list','/api/database/access/decide'].includes(req.url);
    if (invitationRoute || joinRoute || accessRoute) {
      if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });
      if (!acceptsOrigin(req)) return send(403, { error: 'Origin rejected' });
      if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required' });
      try {
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > (joinRoute ? 4096 : 10_000_000)) return send(413, { error: 'Payload too large' }); chunks.push(chunk); }
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (accessRoute) {
          if (req.url.endsWith('/status')) return send(200,database.accessStatus(body.token));
          if (!database.isOwnerKey(body.ownerKey)) return send(403,{error:'دسترسی مالک لازم است. در مرورگر مالک یک لینک دعوت بساز.'});
          if (req.url.endsWith('/list')) return send(200,{requests:database.requests()});
          if (typeof body.approved !== 'boolean') throw new Error('تصمیم معتبر لازم است.');
          return send(200,database.decideAccess(body.token,body.approved,validate));
        }
        if (joinRoute) {
          if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token) || typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 60) throw new Error('لینک دعوت و نام معتبر لازم است.');
          if(typeof body.email !== 'string' || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new Error('ایمیل معتبر وارد کن.');
          return send(202, database.requestAccess(body.token, body.name.trim(), body.email.trim().toLowerCase(), randomBytes(32).toString('hex')));
        }
        validate(body.data);
        const members = body.data.settings.members ?? [{id:'مرزیه',name:'مرزیه',role:'owner'},{id:'علی',name:'علی',role:'editor'}];
        if (!members.some(m => m.id === body.viewer && m.role === 'owner' && !m.removed)) return send(403, { error: 'فقط مالک می‌تواند لینک دعوت بسازد.' });
        const current = database.read();
        if (!Number.isSafeInteger(body.revision) || body.revision !== (current?.revision ?? 0)) return send(409, { error: 'اطلاعات هم‌زمان تغییر کرد؛ دوباره ساخت لینک را بزن.' });
        const remoteMembers = current ? JSON.parse(current.payload).settings.members ?? [] : [];
        if (current && !remoteMembers.some(m=>m.id===body.viewer&&m.role==='owner'&&!m.removed)) return send(403,{error:'فضای سرور با مالک این مرورگر یکسان نیست.'});
        // Existing local rows include deliberate edits/removal tombstones. Preserve server-only approvals.
        const mergedMembers = [...members,...remoteMembers.filter(m=>!members.some(local=>local.id===m.id))];
        const data = {...body.data, settings:{...body.data.settings,members:mergedMembers}};
        validate(data);
        if (!current || JSON.stringify(JSON.parse(current.payload)) !== JSON.stringify(data)) database.save(data, current?.revision ?? 0);
        const token = randomBytes(32).toString('hex');
        database.createInvitation(token, Date.now() + 7 * 24 * 60 * 60 * 1000);
        const ownerKey = randomBytes(32).toString('hex'); database.addOwnerKey(ownerKey);
        return send(201, { token, ownerKey, publicOrigin, members:mergedMembers });
      } catch (error) { return send(400, { error: error.message }); }
    }
    if (req.url !== '/api/database') return send(404, { error: 'Not found' });
    if (req.method === 'GET') {
      const row = database.read();
      return send(200, row ? { revision: row.revision, data: JSON.parse(row.payload) } : { revision: 0, data: null });
    }
    if (req.method !== 'PUT') return send(405, { error: 'Method not allowed' });
    // Require JSON and reject cross-origin browser writes. Never enable CORS here.
    if (!acceptsOrigin(req)) return send(403, { error: 'Origin rejected' });
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required' });
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 10_000_000) return send(413, { error: 'Payload too large' });
        chunks.push(chunk);
      }
      const { data, revision } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Invalid revision');
      validate(data);
      send(200, { revision: database.save(data, revision) });
    } catch (error) {
      send(error.message === 'REVISION_CONFLICT' ? 409 : 400, { error: error.message });
    }
  });
  server.on('close', () => database.close());
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startDatabaseServer();
  console.log('SQLite API: http://127.0.0.1:8789/api/database');
}
