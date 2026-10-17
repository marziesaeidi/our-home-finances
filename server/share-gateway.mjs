import { createServer, request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';

// A separate public listener: the owner's local API never goes through this gateway.
export async function startShareGateway({ publicOrigin, port = 4174, databasePort = 8789, directory = resolve('dist'), getInvitation = () => null, identitySecret, getSession = () => ({status:'unknown'}) }) {
  const root = resolve(directory);
  const allowed = new Set(['/api/database/invitations/join', '/api/database/access/status', '/api/database/sync']);
  const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.ttf':'font/ttf', '.webmanifest':'application/manifest+json', '.ico':'image/x-icon' };
  const server = createServer(async (req, res) => {
    const deny = (status = 403) => { res.writeHead(status, {'Content-Type':'application/json', 'Cache-Control':'no-store'}); res.end(JSON.stringify({error:'این عملیات از لینک عمومی در دسترس نیست.'})); };
    // Reject noncanonical paths rather than forwarding parser ambiguities upstream.
    const path = req.url?.split('?')[0];
    if (!path || !path.startsWith('/') || /[%\\]|(^|\/)\.\.?($|\/)/.test(path)) return deny();
    if (path === '/api/share/session') {
      if (req.method !== 'GET' || !identitySecret || req.headers['x-khaneh-gateway-key'] !== identitySecret || typeof req.headers['x-khaneh-google-email'] !== 'string') return deny(401);
      if (req.headers.origin && req.headers.origin !== publicOrigin) return deny();
      try {
        const session = getSession(req.headers['x-khaneh-google-email'].trim().toLowerCase());
        res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
        res.end(JSON.stringify(session));
      } catch { deny(503); }
      return;
    }
    if (path.startsWith('/api/')) {
      if (!allowed.has(path) || req.method !== 'POST' || req.url !== path) return deny();
      if (req.headers.origin && req.headers.origin !== publicOrigin) return deny();
      if (!req.headers['content-type']?.startsWith('application/json')) return deny(415);
      const chunks = []; let size = 0;
      try {
        for await (const chunk of req) { size += chunk.length; if (size > (path === '/api/database/sync' ? 10_000_000 : 4096)) return deny(413); chunks.push(chunk); }
      } catch { return deny(400); }
      const identityHeaders = identitySecret && req.headers['x-khaneh-gateway-key'] === identitySecret && typeof req.headers['x-khaneh-google-email'] === 'string'
        ? {'x-khaneh-gateway-key':identitySecret,'x-khaneh-google-email':req.headers['x-khaneh-google-email']} : {};
      const upstream = request({hostname:'127.0.0.1', port:databasePort, path, method:'POST', headers:{'Content-Type':'application/json', 'Content-Length':size, ...identityHeaders}}, response => {
        res.writeHead(response.statusCode, {'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store'});
        response.pipe(res);
      });
      upstream.on('error', () => { if (!res.headersSent) deny(502); else res.destroy(); });
      upstream.setTimeout(15000, () => upstream.destroy());
      upstream.end(Buffer.concat(chunks));
      return;
    }
    if (!['GET','HEAD'].includes(req.method)) return deny(405);
    const filename = resolve(root, '.' + (path === '/' ? '/index.html' : path));
    if (!filename.startsWith(root + sep)) return deny();
    try {
      let data = await readFile(filename);
      if (extname(filename) === '.html') {
        const invitation = getInvitation();
        const inviteMeta = typeof invitation === 'string' && /^[a-f0-9]{64}$/.test(invitation) ? `<meta name="khaneh-invitation" content="${invitation}">` : '';
        data = Buffer.from(data.toString('utf8').replace('<head>', '<head><meta name="khaneh-public-share" content="true">' + inviteMeta));
      }
      res.writeHead(200, {'Content-Type':mime[extname(filename)] || 'application/octet-stream', 'Cache-Control':'no-cache'});
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { deny(404); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return server;
}
