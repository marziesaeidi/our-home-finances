import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { startTestServer } from './app-helpers.mjs';

test('sign up, log in, log out and reject bad credentials', async () => {
  const app = await startTestServer();
  try {
    const sara = app.client();
    assert.equal((await sara.post('/api/auth/signup', { name: 'Sara', email: 'sara@example.com', password: 'short' })).status, 400);
    assert.equal((await sara.post('/api/auth/signup', { name: '', email: 'sara@example.com', password: 'long enough' })).status, 400);
    assert.equal((await sara.post('/api/auth/signup', { name: 'Sara', email: 'not-an-email', password: 'long enough' })).status, 400);
    const spaces = await sara.signup('Sara', 'Sara@Example.com');
    assert.equal(spaces.length, 1);
    assert.equal(spaces[0].kind, 'personal');
    assert.equal(spaces[0].role, 'owner');
    assert.match(sara.cookie, /^sid=[a-f0-9]{64}$/);
    assert.equal((await app.client().post('/api/auth/signup', { name: 'Other', email: 'sara@example.com', password: 'long enough' })).status, 409);

    const fresh = app.client();
    assert.equal((await fresh.get('/api/auth/me')).status, 401);
    assert.equal((await fresh.post('/api/auth/login', { email: 'sara@example.com', password: 'wrong password' })).status, 401);
    assert.equal((await fresh.post('/api/auth/login', { email: 'nobody@example.com', password: 'wrong password' })).status, 401);
    assert.equal((await fresh.post('/api/auth/login', { email: 'SARA@example.com', password: 'correct horse' })).status, 200);
    assert.equal((await fresh.me()).user.email, 'sara@example.com');

    assert.equal((await fresh.post('/api/auth/logout')).status, 200);
    assert.equal((await fresh.get('/api/auth/me')).status, 401);
    // Logging out one device leaves the other session intact.
    assert.equal((await sara.get('/api/auth/me')).status, 200);
  } finally { await app.close(); }
});

test('login attempts are rate limited per email', async () => {
  const app = await startTestServer();
  try {
    await app.client().signup('Sara', 'sara@example.com');
    const attacker = app.client();
    for (let i = 0; i < 10; i++) assert.equal((await attacker.post('/api/auth/login', { email: 'sara@example.com', password: 'guess ' + i })).status, 401);
    assert.equal((await attacker.post('/api/auth/login', { email: 'sara@example.com', password: 'correct horse' })).status, 429);
  } finally { await app.close(); }
});

test('cookie requests from other origins or without JSON are rejected', async () => {
  const app = await startTestServer();
  try {
    const sara = app.client();
    const [personal] = await sara.signup('Sara', 'sara@example.com');
    assert.equal((await sara.post(`/api/spaces/${personal.id}/read`, {}, { Origin: 'https://evil.example' })).status, 403);
    const noOrigin = await fetch(app.base + `/api/spaces/${personal.id}/read`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: sara.cookie }, body: '{}' });
    assert.equal(noOrigin.status, 403);
    const form = await fetch(app.base + `/api/spaces/${personal.id}/read`, { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: app.base, Cookie: sara.cookie }, body: '{}' });
    assert.equal(form.status, 415);
  } finally { await app.close(); }
});

test('pages redirect by session; unknown and removed API routes answer JSON 404', async () => {
  const app = await startTestServer({ directory: fileURLToPath(new URL('../dist', import.meta.url)) });
  try {
    const visitor = app.client();
    const landing = await visitor.get('/');
    assert.equal(landing.status, 200);
    assert.match(landing.type, /text\/html/);
    assert.deepEqual([(await visitor.get('/app')).status, (await visitor.get('/app')).location], [302, '/login?next=%2Fapp']);
    assert.equal((await visitor.get('/login')).status, 200);
    assert.equal((await visitor.get('/welcome')).location, '/login?next=%2Fwelcome');
    assert.equal((await visitor.get('/invite/' + 'a'.repeat(64))).status, 200);

    const sara = app.client();
    await sara.signup('Sara', 'sara@example.com');
    assert.deepEqual([(await sara.get('/')).status, (await sara.get('/')).location], [302, '/app']);
    assert.equal((await sara.get('/login?next=/invite/' + 'b'.repeat(64))).location, '/invite/' + 'b'.repeat(64));
    assert.equal((await sara.get('/login?next=//evil.example')).location, '/app');
    assert.equal((await sara.get('/app')).status, 200);

    for (const path of ['/api/database', '/api/share/session', '/api/nothing']) {
      const response = await visitor.get(path);
      assert.equal(response.status, 404, path);
      assert.match(response.type, /application\/json/);
    }
    assert.equal((await sara.post('/api/database/local-session')).status, 404);
    assert.equal((await visitor.post('/api/database/local-session')).status, 401);
  } finally { await app.close(); }
});

test('change own login email with password confirmation and preserve membership', async () => {
  const app = await startTestServer();
  try {
    const sara = app.client(), other = app.client();
    const spaces = await sara.signup('Sara', 'sara@example.com');
    await other.signup('Other', 'other@example.com');
    assert.equal((await app.client().post('/api/auth/email', {email:'new@example.com',password:'correct horse'})).status,401);
    assert.equal((await sara.post('/api/auth/email', {email:'bad',password:'correct horse'})).status,400);
    assert.equal((await sara.post('/api/auth/email', {email:'new@example.com',password:'wrong'})).status,403);
    assert.equal((await sara.post('/api/auth/email', {email:'OTHER@example.com',password:'correct horse'})).status,409);
    assert.equal((await sara.me()).user.email,'sara@example.com');
    const changed = await sara.post('/api/auth/email', {email:' New@Example.com ',password:'correct horse',userId:(await other.me()).user.id});
    assert.equal(changed.status,200);
    assert.equal(changed.body.user.email,'new@example.com');
    assert.deepEqual((await sara.me()).spaces,spaces);
    assert.equal((await other.me()).user.email,'other@example.com');
    assert.equal((await app.client().post('/api/auth/login',{email:'sara@example.com',password:'correct horse'})).status,401);
    assert.equal((await app.client().post('/api/auth/login',{email:'new@example.com',password:'correct horse'})).status,200);
  } finally { await app.close(); }
});
