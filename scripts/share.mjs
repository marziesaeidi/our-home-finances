import { getEmailSession } from '../server/share-session.mjs';
import { preview } from 'vite';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startDatabaseServer } from '../server/sqlite.mjs';
import { databasePath } from '../server/database.mjs';
import { startRateServer } from '../server/rates.mjs';
import { startShareGateway } from '../server/share-gateway.mjs';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';

const publicOrigin = process.env.APP_PUBLIC_ORIGIN || 'https://herald-aware-antitrust.ngrok-free.dev';
const invitationMode = process.argv.includes('--invite');
const ownerEmail = process.env.SHARE_OWNER_EMAIL || 'marzieh.s.miss@gmail.com';
// Preserve access for approved, active members when restarting the tunnel.
// The OAuth allowlist and the application's membership checks both remain enforced.
const memberEmails = [];
if (existsSync(databasePath)) {
  const saved = new DatabaseSync(databasePath, {readOnly:true});
  try {
    const snapshot=saved.prepare('SELECT payload FROM finance_snapshots ORDER BY revision DESC LIMIT 1').get();
    const active=new Set((snapshot?JSON.parse(snapshot.payload).settings.members??[]:[]).filter(m=>!m.removed).map(m=>m.id));
    for(const row of saved.prepare("SELECT email,member_id FROM access_requests WHERE status='approved'").all())if(active.has(row.member_id))memberEmails.push(row.email.toLowerCase());
  } finally { saved.close(); }
}
const allowedEmails = [...new Set([ownerEmail,...memberEmails,...(process.env.SHARE_GUEST_EMAIL?.split(',').map(email=>email.trim().toLowerCase()).filter(Boolean)??[])])];
const directory = resolve('data/ngrok');
mkdirSync(directory, { recursive: true });
const policyFile = resolve(directory, 'policy.json');
const identitySecret = randomBytes(32).toString('hex');
writeFileSync(policyFile, JSON.stringify({ on_http_request: [
  { actions: [{ type: 'oauth', config: { provider: 'google' } }] },
  { expressions: [allowedEmails.map(email => `actions.ngrok.oauth.identity.email != ${JSON.stringify(email)}`).join(' && ')], actions: [{ type: 'deny' }] },
  { actions: [
    {type:'remove-headers',config:{headers:['x-khaneh-google-email','x-khaneh-gateway-key']}},
    {type:'add-headers',config:{headers:{'x-khaneh-google-email':'${actions.ngrok.oauth.identity.email}','x-khaneh-gateway-key':identitySecret}}},
  ] },
] }, null, 2));

const database = await startDatabaseServer({ publicOrigin, identitySecret: invitationMode ? undefined : identitySecret, ownerEmail });
const rates = startRateServer();
const app = await preview({ preview: {
  host: '127.0.0.1', port: 4173, strictPort: true,
  allowedHosts: [new URL(publicOrigin).hostname],
} });
// After OAuth the browser can return to / without its original invitation URL.
// Only available behind the email allowlist; never enable this fallback for an unrestricted tunnel.
const getInvitation = () => {
  if (invitationMode) return null;
  const db = new DatabaseSync(databasePath, {readOnly:true});
  try { return db.prepare('SELECT token FROM household_invitations WHERE used = 0 AND expires_at > ? ORDER BY rowid DESC LIMIT 1').get(Date.now())?.token ?? null; }
  finally { db.close(); }
};
const gateway = await startShareGateway({ publicOrigin, getInvitation, getSession:email=>getEmailSession(email,undefined,ownerEmail), identitySecret: invitationMode ? undefined : identitySecret });
console.log('Local app: http://127.0.0.1:4173');
let tunnel;
if (!process.argv.includes('--local')) {
  tunnel = spawn(resolve(directory, 'ngrok.exe'), [
    'http', 'http://127.0.0.1:4174', '--url', publicOrigin,
    ...(!invitationMode ? ['--traffic-policy-file', policyFile] : []), '--inspect=false', '--log=stdout',
    ...(existsSync(resolve(directory, 'ngrok.yml')) ? ['--config', resolve(directory, 'ngrok.yml')] : []),
  ], { stdio: 'inherit', windowsHide: true });
  tunnel.on('exit', code => { if (code) console.error(`ngrok exited (${code}); check account authentication.`); shutdown(code ?? 0); });
}
let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  tunnel?.kill();
  gateway.close(); database.close(); rates.close(); app.httpServer.close();
  process.exitCode = code;
}
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
