import { preview } from 'vite';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { startDatabaseServer } from '../server/sqlite.mjs';
import { startRateServer } from '../server/rates.mjs';

const publicOrigin = 'https://herald-aware-antitrust.ngrok-free.dev';
const directory = resolve('data/ngrok');
mkdirSync(directory, { recursive: true });
const policyFile = resolve(directory, 'policy.json');
writeFileSync(policyFile, JSON.stringify({ on_http_request: [
  { actions: [{ type: 'oauth', config: { provider: 'google' } }] },
  { expressions: ["actions.ngrok.oauth.identity.email != 'marzieh.s.miss@gmail.com'"], actions: [{ type: 'deny' }] },
] }, null, 2));

const database = await startDatabaseServer({ publicOrigin });
const rates = startRateServer();
const app = await preview({ preview: {
  host: '127.0.0.1', port: 4173, strictPort: true,
  allowedHosts: [new URL(publicOrigin).hostname],
} });
console.log('Local app: http://127.0.0.1:4173');
let tunnel;
if (!process.argv.includes('--local')) {
  tunnel = spawn(resolve(directory, 'ngrok.exe'), [
    'http', 'http://127.0.0.1:4173', '--url', publicOrigin,
    '--traffic-policy-file', policyFile, '--inspect=false', '--log=stdout',
    ...(existsSync(resolve(directory, 'ngrok.yml')) ? ['--config', resolve(directory, 'ngrok.yml')] : []),
  ], { stdio: 'inherit', windowsHide: true });
  tunnel.on('exit', code => { if (code) console.error(`ngrok exited (${code}); check account authentication.`); shutdown(code ?? 0); });
}
let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  tunnel?.kill();
  database.close(); rates.close(); app.httpServer.close();
  process.exitCode = code;
}
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
