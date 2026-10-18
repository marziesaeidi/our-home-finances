import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startAppServer } from '../server/app.mjs';

// Starts the real app server on a temporary database; `client()` keeps one account's session cookie.
export async function startTestServer(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'khaneh-app-'));
  const filename = join(directory, 'test.sqlite');
  const server = await startAppServer({ filename, port: 0, rates: false, ...options });
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = () => {
    let cookie = '';
    const remember = response => { const set = response.headers.get('set-cookie'); if (set) cookie = set.split(';')[0]; return response; };
    return {
      get cookie() { return cookie; },
      async post(path, body = {}, headers = {}) {
        const response = remember(await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie, ...headers }, body: JSON.stringify(body) }));
        return { status: response.status, body: await response.json() };
      },
      async get(path) {
        const response = await fetch(base + path, { headers: { Cookie: cookie }, redirect: 'manual' });
        return { status: response.status, location: response.headers.get('location'), type: response.headers.get('content-type'), body: await response.text() };
      },
      async signup(name, email, password = 'correct horse') {
        const result = await this.post('/api/auth/signup', { name, email, password });
        if (result.status !== 201) throw new Error(JSON.stringify(result.body));
        return (await this.me()).spaces;
      },
      async me() { return JSON.parse((await this.get('/api/auth/me')).body); },
    };
  };
  return { base, filename, client, close: async () => { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); } };
}
