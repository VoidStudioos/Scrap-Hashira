import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Use Node.js 24.x (tested: 24.22.1).');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
for (const step of [['ci'], ['run', 'lint'], ['test'], ['run', 'build'], ['run', 'package'], ['run', 'verify:package']]) {
  const result = spawnSync(npm, step, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error || result.status !== 0) {
    console.error(result.error || `Failed: npm ${step.join(' ')}`);
    process.exit(result.status || 1);
  }
}
console.log('Release verified. Install dist/ or distribute artifacts/*.zip. Native browser acceptance is a separate test.');
