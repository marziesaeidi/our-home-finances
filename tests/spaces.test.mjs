import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './app-helpers.mjs';

const read = (client, space) => client.post(`/api/spaces/${space.id}/read`);
const write = async (client, space, change) => {
  const { body } = await read(client, space);
  const next = structuredClone(body.data); change(next);
  return client.post(`/api/spaces/${space.id}/write`, { data: next, expected: body.data });
};
async function household(app) {
  const owner = app.client(), member = app.client();
  await owner.signup('Sara', 'sara@example.com');
  await member.signup('Ali', 'ali@example.com');
  const { body: { space } } = await owner.post('/api/spaces', { name: 'خانه ما' });
  const { body: { url } } = await owner.post(`/api/spaces/${space.id}/invitations`);
  const token = url.split('/invite/')[1];
  return { owner, member, space, token };
}

test('users only reach their own personal space', async () => {
  const app = await startTestServer();
  try {
    const sara = app.client(), ali = app.client();
    const [saraSpace] = await sara.signup('Sara', 'sara@example.com');
    const [aliSpace] = await ali.signup('Ali', 'ali@example.com');
    assert.equal((await read(sara, saraSpace)).status, 200);
    assert.equal((await read(ali, saraSpace)).status, 404);
    assert.equal((await write(sara, saraSpace, d => { d.settings.name = 'mine'; })).status, 200);
    const stolen = (await read(ali, aliSpace)).body.data;
    assert.equal((await ali.post(`/api/spaces/${saraSpace.id}/write`, { data: stolen, expected: stolen })).status, 404);
    assert.equal((await app.client().post(`/api/spaces/${saraSpace.id}/read`)).status, 401);
    // Personal spaces never accept members.
    assert.equal((await sara.post(`/api/spaces/${saraSpace.id}/invitations`)).status, 400);
  } finally { await app.close(); }
});

test('invite, owner approval and roles in a household', async () => {
  const app = await startTestServer();
  try {
    const { owner, member, space, token } = await household(app);
    assert.equal((await read(member, space)).status, 404);
    assert.equal((await member.post('/api/invitations/status', { token })).body.status, 'none');
    assert.equal((await member.post('/api/invitations/join', { token })).body.status, 'pending');
    // Joining again is idempotent; the link can't be reused by someone else.
    assert.equal((await member.post('/api/invitations/join', { token })).body.status, 'pending');
    const stranger = app.client(); await stranger.signup('Eve', 'eve@example.com');
    assert.equal((await stranger.post('/api/invitations/join', { token })).status, 400);
    assert.equal((await read(member, space)).status, 404);

    assert.equal((await member.post(`/api/spaces/${space.id}/requests`)).status, 404);
    const { body: { requests } } = await owner.post(`/api/spaces/${space.id}/requests`);
    assert.deepEqual(requests.map(r => r.email), ['ali@example.com']);
    assert.equal((await owner.post(`/api/spaces/${space.id}/decide`, { requestId: requests[0].id, approved: true })).body.status, 'approved');
    assert.equal((await member.post('/api/invitations/status', { token })).body.status, 'approved');

    const seen = await read(member, space);
    assert.equal(seen.status, 200);
    assert.equal(seen.body.member.role, 'editor');
    assert.equal((await member.me()).spaces.filter(s => s.kind === 'household').length, 1);
    assert.equal((await write(member, space, d => { d.settings.theme = 'dark'; })).status, 200);
    assert.equal((await member.post(`/api/spaces/${space.id}/invitations`)).status, 403);
    // Editors can't change roles; the owner can make them read-only.
    assert.equal((await write(member, space, d => { d.settings.members.find(m => m.name === 'Sara').role = 'reader'; d.settings.members.find(m => m.name === 'Ali').role = 'owner'; })).status, 403);
    assert.equal((await write(owner, space, d => { d.settings.members.find(m => m.name === 'Ali').role = 'reader'; })).status, 200);
    assert.equal((await write(member, space, d => { d.settings.theme = 'light'; })).status, 403);
    // Removing the member revokes access.
    assert.equal((await write(owner, space, d => { d.settings.members.find(m => m.name === 'Ali').removed = true; })).status, 200);
    assert.equal((await read(member, space)).status, 403);
    assert.equal((await member.me()).spaces.filter(s => s.kind === 'household').length, 0);
  } finally { await app.close(); }
});

test('rejected requests grant nothing', async () => {
  const app = await startTestServer();
  try {
    const { owner, member, space, token } = await household(app);
    await member.post('/api/invitations/join', { token });
    const { body: { requests } } = await owner.post(`/api/spaces/${space.id}/requests`);
    assert.equal((await owner.post(`/api/spaces/${space.id}/decide`, { requestId: requests[0].id, approved: false })).body.status, 'rejected');
    assert.equal((await member.post('/api/invitations/status', { token })).body.status, 'rejected');
    assert.equal((await read(member, space)).status, 404);
    assert.equal((await owner.post(`/api/spaces/${space.id}/decide`, { requestId: requests[0].id, approved: true })).status, 404);
  } finally { await app.close(); }
});

test('stale writes are rejected with 409 and leave data unchanged', async () => {
  const app = await startTestServer();
  try {
    const sara = app.client();
    const [space] = await sara.signup('Sara', 'sara@example.com');
    const { body: before } = await read(sara, space);
    assert.equal((await write(sara, space, d => { d.settings.name = 'first'; })).status, 200);
    const stale = structuredClone(before.data); stale.settings.name = 'second';
    assert.equal((await sara.post(`/api/spaces/${space.id}/write`, { data: stale, expected: before.data })).status, 409);
    assert.equal((await read(sara, space)).body.data.settings.name, 'first');
    const invalid = structuredClone((await read(sara, space)).body.data);
    assert.equal((await sara.post(`/api/spaces/${space.id}/write`, { data: { ...invalid, accounts: 'nope' }, expected: invalid })).status, 400);
  } finally { await app.close(); }
});
