import { createServer, request as httpRequest } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { openDatabase } from './database.mjs';
import { startRateServer } from './rates.mjs';

const scryptAsync = promisify(scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1 };
export async function hashPassword(password) {
  const salt = randomBytes(16), key = await scryptAsync(password.normalize('NFKC'), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}
async function verifyPassword(password, stored) {
  const [scheme, N, r, p, salt, key] = stored.split('$');
  if (scheme !== 'scrypt') return false;
  const expected = Buffer.from(key, 'base64');
  const actual = await scryptAsync(password.normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return timingSafeEqual(actual, expected);
}
// Compared against when the email is unknown, so response time doesn't reveal registered emails.
const unknownUserHash = await hashPassword(randomBytes(16).toString('hex'));

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const errors = {
  TRANSFER_REQUEST_CONFLICT: [409, 'شناسه درخواست قبلاً برای انتقال دیگری استفاده شده است.'],
  EMAIL_TAKEN: [409, 'این ایمیل قبلاً ثبت شده است.'],
  REVISION_CONFLICT: [409, 'اطلاعات دستگاه دیگری تغییر کرده است. تغییر ثبت نشد؛ صفحه را تازه‌سازی کن و دوباره ثبت کن.'],
  INVITATION_INVALID: [400, 'لینک دعوت معتبر نیست، منقضی شده یا قبلاً استفاده شده است.'],
  REQUEST_NOT_FOUND: [404, 'این درخواست قبلاً بررسی شده است.'],
  MEMBER_UNAVAILABLE: [409, 'این عضو در دسترس نیست یا قبلاً به حساب دیگری وصل شده است.'],
};

// Fixed-window limiter for login and signup; enough to stop password guessing on a household app.
function limiter(limit, windowMs) {
  const hits = new Map();
  return key => {
    const now = Date.now(), entry = hits.get(key);
    if (!entry || entry.reset < now) { hits.set(key, { count: 1, reset: now + windowMs }); if (hits.size > 10000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k); return true; }
    return ++entry.count <= limit;
  };
}

export async function startAppServer({ filename, port = 4173, host = '127.0.0.1', publicOrigin = process.env.APP_PUBLIC_ORIGIN, directory = fileURLToPath(new URL('../dist', import.meta.url)), rates = true, trustProxy = process.env.TRUST_PROXY === '1' } = {}) {
  if (publicOrigin && (new URL(publicOrigin).origin !== publicOrigin || !publicOrigin.startsWith('https://'))) {
    throw new Error('APP_PUBLIC_ORIGIN must be an HTTPS origin without a trailing slash');
  }
  // Reuse the application's complete financial validator and member rules on the server.
  const bundle = await build({ stdin: { contents: "export { validate, createSpaceData } from './src/store'; export { assertMemberChange, membersOf } from './src/household-access'; export { transferPlan, moveBetweenSpaces } from './src/space-transfer';", resolveDir: fileURLToPath(new URL('..', import.meta.url)) }, bundle: true, write: false, platform: 'node', format: 'esm' });
  const { validate, createSpaceData, assertMemberChange, membersOf, transferPlan, moveBetweenSpaces } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const database = openDatabase(filename);
  const rateServer = rates ? startRateServer() : null;
  const ratePort = Number(process.env.FX_PORT ?? 8788);
  const root = resolve(directory);
  const secureCookie = !!publicOrigin;
  const allowLogin = limiter(10, 15 * 60 * 1000), allowSignup = limiter(5, 60 * 60 * 1000);
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8' };

  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    // Invitation links carry a secret in the path; never leak it to other sites.
    res.setHeader('Referrer-Policy', 'same-origin');
    const send = (status, value, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(value)); };
    const redirect = location => { res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' }); res.end(); };
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const cookies = Object.fromEntries((req.headers.cookie ?? '').split(';').map(part => part.trim().split('=')).filter(([k, v]) => k && v));
    const user = database.sessionUser(cookies.sid);
    const sessionCookie = (token, maxAge) => `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secureCookie ? '; Secure' : ''}`;
    const clientIp = () => trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',').pop().trim() || req.socket.remoteAddress : req.socket.remoteAddress;

    try {
      if (path.startsWith('/api/')) {
        if (path === '/api/exchange-rates' && req.method === 'GET') {
          if (!user) return send(401, { error: 'ابتدا وارد شو.' });
          const upstream = httpRequest({ hostname: '127.0.0.1', port: ratePort, path: req.url, method: 'GET' }, response => { res.writeHead(response.statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.pipe(res); });
          upstream.on('error', () => { if (!res.headersSent) send(503, { error: 'سرویس نرخ ارز در دسترس نیست؛ نرخ را دستی وارد کن.' }); else res.destroy(); });
          upstream.end();
          return;
        }
        if (path === '/api/auth/me' && req.method === 'GET') {
          if (!user) return send(401, { error: 'وارد نشده‌ای.' });
          return send(200, { user, spaces: database.spaces(user.id) });
        }
        if (req.method !== 'POST') return send(req.method === 'GET' ? 404 : 405, { error: req.method === 'GET' ? 'Not found' : 'Method not allowed' });
        // Cookie-authenticated writes: accept only same-site JSON requests from this app's origin.
        const host = req.headers.host ?? '';
        const allowedOrigins = new Set([publicOrigin, `http://localhost:${server.address().port}`, `http://127.0.0.1:${server.address().port}`, 'http://localhost:5173', 'http://127.0.0.1:5173', ...(publicOrigin ? [] : [`http://${host}`])].filter(Boolean));
        if (!allowedOrigins.has(req.headers.origin)) return send(403, { error: 'Origin rejected' });
        if (!req.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'JSON required' });
        const limit = /^\/api\/spaces\/[^/]+\/write$/.test(path) ? 10_000_000 : 16_384;
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > limit) return send(413, { error: 'Payload too large' }); chunks.push(chunk); }
        let body;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return send(400, { error: 'JSON معتبر نیست.' }); }
        if (!body || typeof body !== 'object') return send(400, { error: 'JSON معتبر نیست.' });

        if (path === '/api/auth/signup' || path === '/api/auth/login') {
          const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
          const password = typeof body.password === 'string' ? body.password : '';
          if (!email || email.length > 254 || !emailPattern.test(email)) return send(400, { error: 'ایمیل معتبر وارد کن.' });
          if (path === '/api/auth/signup') {
            if (!allowSignup('ip:' + clientIp())) return send(429, { error: 'تعداد ثبت‌نام‌ها زیاد است؛ کمی بعد دوباره امتحان کن.' });
            const name = typeof body.name === 'string' ? body.name.trim() : '';
            if (!name || name.length > 60) return send(400, { error: 'نام را وارد کن (حداکثر ۶۰ نویسه).' });
            if (password.length < 8 || password.length > 200) return send(400, { error: 'رمز عبور باید دست‌کم ۸ نویسه باشد.' });
            const created = database.createUser({ name, email, passwordHash: await hashPassword(password) }, id => createSpaceData('فضای شخصی من', { id, name }, new Date().toISOString()));
            const session = database.createSession(created.id);
            return send(201, { user: created }, { 'Set-Cookie': sessionCookie(session.token, session.maxAge) });
          }
          if (!allowLogin('ip:' + clientIp()) || !allowLogin('email:' + email)) return send(429, { error: 'تلاش‌های ورود زیاد بود؛ ۱۵ دقیقه بعد دوباره امتحان کن.' });
          const account = database.credentials(email);
          const valid = await verifyPassword(password, account?.password_hash ?? unknownUserHash);
          if (!account || !valid) return send(401, { error: 'ایمیل یا رمز عبور درست نیست.' });
          const session = database.createSession(account.id);
          return send(200, { user: database.user(account.id) }, { 'Set-Cookie': sessionCookie(session.token, session.maxAge) });
        }
        if (path === '/api/auth/logout') {
          database.deleteSession(cookies.sid);
          return send(200, {}, { 'Set-Cookie': sessionCookie('', 0) });
        }
        if (!user) return send(401, { error: 'ابتدا وارد شو.' });

        if (path === '/api/spaces') {
          const name = typeof body.name === 'string' ? body.name.trim() : '';
          if (!name || name.length > 60) return send(400, { error: 'نام فضای مشترک را وارد کن.' });
          const id = database.createHousehold(user.id, createSpaceData(name, { id: user.id, name: user.name }, new Date().toISOString()));
          return send(201, { space: database.spaces(user.id).find(space => space.id === id) });
        }
        if (path === '/api/invitations/join' || path === '/api/invitations/status') {
          if (typeof body.token !== 'string' || !/^[a-f0-9]{64}$/.test(body.token)) return send(400, { error: errors.INVITATION_INVALID[1] });
          if (path.endsWith('/join')) return send(200, database.joinRequest(body.token, user.id));
          return send(200, database.joinStatus(body.token, user.id) ?? { status: 'none' });
        }

        const transferMatch = path.match(/^\/api\/spaces\/([0-9a-f-]{36})\/(transfer-preview|transfer)$/);
        if (transferMatch) {
          const [, sourceId, action] = transferMatch;
          const spaces = database.spaces(user.id), sourceSpace = spaces.find(s => s.id === sourceId), targetSpace = spaces.find(s => s.id === body.targetId);
          if (!sourceSpace || !targetSpace) return send(404, {error:'فضای مبدأ یا مقصد پیدا نشد.'});
          if (sourceId === targetSpace.id || sourceSpace.kind === targetSpace.kind) return send(400, {error:'یک فضای شخصی و یک فضای مشترک انتخاب کن.'});
          if ([sourceSpace.role,targetSpace.role].includes('reader')) return send(403, {error:'دسترسی ویرایش در هر دو فضا لازم است.'});
          if (!body.selection || typeof body.selection.id !== 'string' || typeof body.selection.kind !== 'string') return send(400,{error:'مورد انتقال را انتخاب کن.'});
          try {
            const sourceRow=database.read(sourceId), targetRow=database.read(targetSpace.id);
            const source=JSON.parse(sourceRow.payload), target=JSON.parse(targetRow.payload);
            if(action==='transfer-preview') { const plan=transferPlan(source,body.selection,sourceSpace.memberId); return send(200,{sourceRevision:sourceRow.revision,targetRevision:targetRow.revision,items:plan.items,requiredAccounts:plan.requiredAccounts.map(a=>({id:a.id,name:a.name,currency:a.currency??'IRT'})),targetAccounts:target.accounts.filter(a=>a.visibility==='shared'||a.owner===targetSpace.memberId).map(a=>({id:a.id,name:a.name,currency:a.currency??'IRT'}))}); }
            if(typeof body.requestId!=='string'||!/^[0-9a-f-]{36}$/.test(body.requestId)||!Number.isSafeInteger(body.sourceRevision)||!Number.isSafeInteger(body.targetRevision)||!body.accountMap||typeof body.accountMap!=='object'||Array.isArray(body.accountMap)||Object.values(body.accountMap).some(v=>typeof v!=='string'))return send(400,{error:'درخواست انتقال معتبر نیست.'});
            const fingerprint=JSON.stringify({sourceId,targetId:targetSpace.id,selection:body.selection,accountMap:Object.entries(body.accountMap).sort(),sourceRevision:body.sourceRevision,targetRevision:body.targetRevision});
            const result=database.transferSpaces(user.id,body.requestId,fingerprint,sourceId,targetSpace.id,body.sourceRevision,body.targetRevision,(before,after)=>moveBetweenSpaces(before,after,{selection:body.selection,accountMap:body.accountMap,requestId:body.requestId,sourceId,targetId:targetSpace.id,sourceMember:sourceSpace.memberId,targetMember:targetSpace.memberId,targetKind:targetSpace.kind,at:new Date().toISOString()}));
            return send(200,result);
          }catch(error){if(errors[error.message])throw error;return send(400,{error:error.message});}
        }

        const match = path.match(/^\/api\/spaces\/([0-9a-f-]{36})\/(read|write|invitations|requests|decide)$/);
        if (!match) return send(404, { error: 'Not found' });
        const [, spaceId, action] = match;
        const memberId = database.memberId(spaceId, user.id);
        const row = memberId && database.read(spaceId);
        // Spaces the user doesn't belong to are indistinguishable from spaces that don't exist.
        if (!row) return send(404, { error: 'این فضا پیدا نشد.' });
        const current = JSON.parse(row.payload);
        const member = membersOf(current).find(m => m.id === memberId && !m.removed);
        if (!member) return send(403, { error: 'دیگر به این فضا دسترسی نداری.' });
        const space = database.spaces(user.id).find(s => s.id === spaceId);

        if (action === 'read') return send(200, { data: current, member, revision: row.revision, space });
        if (action === 'write') {
          if (JSON.stringify(body.data) === JSON.stringify(current)) return send(200, { revision: row.revision });
          if (JSON.stringify(body.expected) !== JSON.stringify(current)) throw new Error('REVISION_CONFLICT');
          try { validate(body.data); } catch (error) { return send(400, { error: error.message }); }
          try { assertMemberChange(current, body.data, member.id); } catch (error) { return send(403, { error: error.message }); }
          return send(200, { revision: database.save(spaceId, body.data, row.revision) });
        }
        if (member.role !== 'owner') return send(403, { error: 'دسترسی مالک لازم است.' });
        if (space.kind !== 'household') return send(400, { error: 'فضای شخصی عضو نمی‌پذیرد.' });
        if (action === 'invitations') {
          const token = database.createInvitation(spaceId, user.id);
          return send(201, { url: `${publicOrigin || `http://${host}`}/invite/${token}` });
        }
        if (action === 'requests') {
          const linked = new Set(database.linkedMembers(spaceId));
          return send(200, { requests: database.requests(spaceId), unlinked: membersOf(current).filter(m => !m.removed && !linked.has(m.id)) });
        }
        if (typeof body.requestId !== 'string' || typeof body.approved !== 'boolean' || (body.memberId !== undefined && typeof body.memberId !== 'string')) return send(400, { error: 'تصمیم معتبر لازم است.' });
        return send(200, database.decide(spaceId, body.requestId, body.approved, body.memberId, validate));
      }

      if (!['GET', 'HEAD'].includes(req.method)) return send(405, { error: 'Method not allowed' });
      if (path === '/' && user) return redirect('/app');
      if (path === '/login' && user) return redirect(safeNext(url.searchParams.get('next')));
      if ((path === '/app' || path.startsWith('/app/') || path === '/welcome') && !user) return redirect('/login?next=' + encodeURIComponent(path));
      if (/[%\\]|(^|\/)\.\.?($|\/)/.test(path)) return send(400, { error: 'Bad path' });
      let filename = resolve(root, '.' + path);
      if (!filename.startsWith(root + sep) || path.endsWith('/')) filename = resolve(root, 'index.html');
      let data;
      try { data = await readFile(filename); }
      catch { filename = resolve(root, 'index.html'); data = await readFile(filename); }
      res.writeHead(200, { 'Content-Type': mime[extname(filename)] || 'application/octet-stream', 'Cache-Control': path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      const [status, message] = errors[error.message] ?? [500, 'خطای سرور'];
      if (status === 500) console.error(error);
      if (!res.headersSent) send(status, { error: message });
    }
  });
  server.on('close', () => { database.close(); rateServer?.close(); });
  await new Promise((resolveListen, reject) => { server.once('error', reject); server.listen(port, host, resolveListen); });
  return server;
}

// Only same-site relative paths are valid post-login destinations.
function safeNext(next) { return typeof next === 'string' && /^\/(app|invite)(\/|$)/.test(next) ? next : '/app'; }

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4173);
  await startAppServer({ port, host: '0.0.0.0' });
  console.log(`App listening on http://localhost:${port}`);
}
