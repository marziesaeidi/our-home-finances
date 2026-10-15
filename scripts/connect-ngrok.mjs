import { emitKeypressEvents } from 'node:readline';
import { mkdirSync, writeFileSync } from 'node:fs';

if (!process.stdin.isTTY) throw new Error('Run this command in an interactive terminal.');
emitKeypressEvents(process.stdin);
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdout.write('Paste your ngrok authtoken (hidden), then press Enter: ');
let token = '';
process.stdin.on('keypress', (text, key) => {
  if (key?.ctrl && key.name === 'c') {
    process.stdin.setRawMode(false);
    process.exit(1);
  }
  if (key?.name === 'return' || key?.name === 'enter') {
    process.stdin.setRawMode(false);
    if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) {
      console.error('\nInvalid token. Paste only the token, not the entire command.');
      process.exit(1);
    }
    const directory = new URL('../data/ngrok/', import.meta.url);
    mkdirSync(directory, { recursive: true });
    writeFileSync(new URL('ngrok.yml', directory), `version: "3"\nagent:\n  authtoken: ${JSON.stringify(token)}\n`, { mode: 0o600 });
    token = '';
    console.log('\nngrok authentication is configured. Return to the chat.');
    process.exit(0);
  }
  if (key?.name === 'backspace') token = token.slice(0, -1);
  else if (text && !key?.ctrl && !key?.meta) token += text.replace(/[\x00-\x1f\x7f]/g, '');
});
