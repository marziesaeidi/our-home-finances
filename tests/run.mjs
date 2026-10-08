import { build } from 'esbuild';
import { writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const result = await build({ entryPoints: ['tests/finance.test.ts'], bundle: true, packages: 'external', write: false, platform: 'node', format: 'esm', target: 'node24' });
const output = new URL(`./.test-${randomUUID()}.mjs`, import.meta.url);
try {
  await writeFile(output, result.outputFiles[0].text);
  await import(output.href);
} finally {
  await unlink(output).catch(() => {});
}
