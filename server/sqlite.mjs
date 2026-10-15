import { createServer } from 'node:http';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { openDatabase } from './database.mjs';

export async function startDatabaseServer({ filename, port = 8789 } = {}) {
  // Reuse the application's complete financial validator on the server.
  const bundle = await build({ entryPoints: [fileURLToPath(new URL('../src/store.ts', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm' });
  const { validate } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const database = openDatabase(filename);
  const server = createServer(async (req, res) => {
    const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
    if (req.url !== '/api/database') return send(404, { error: 'Not found' });
    if (req.method === 'GET') {
      const row = database.read();
      return send(200, row ? { revision: row.revision, data: JSON.parse(row.payload) } : { revision: 0, data: null });
    }
    if (req.method !== 'PUT') return send(405, { error: 'Method not allowed' });
    // Require JSON and reject cross-origin browser writes. Never enable CORS here.
    const origin = req.headers.origin;
    if (origin && origin !== `http://${req.headers.host}`) return send(403, { error: 'Origin rejected' });
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
