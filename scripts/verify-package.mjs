import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const sums = await readFile('artifacts/SHA256SUMS.txt', 'utf8');
const hash = b => createHash('sha256').update(b).digest('hex');
for (const kind of ['Chrome', 'Complete']) {
  const name = `Hashira_Scraper_v${version}_${kind}.zip`;
  const bytes = await readFile(`artifacts/${name}`);
  assert(sums.includes(`${hash(bytes)}  ${name}`), `Checksum mismatch: ${name}`);
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
  const prefix = kind === 'Chrome' ? 'hashira-scraper-chrome/' : 'hashira-scraper/dist/';
  const manifest = JSON.parse(await zip.file(prefix + 'manifest.json').async('string'));
  assert.equal(manifest.version, version);
  assert.equal(manifest.manifest_version, 3);
  for (const file of ['content.js', manifest.background.service_worker, manifest.action.default_popup, manifest.side_panel.default_path, ...Object.values(manifest.icons)])
    assert(zip.file(prefix + file), `Missing runtime file: ${file}`);
  const inventoryPath = kind === 'Chrome' ? 'docs/BUILD_MANIFEST.json' : 'hashira-scraper/docs/BUILD_MANIFEST.json';
  const inventory = JSON.parse(await zip.file(inventoryPath).async('string'));
  for (const item of inventory.files) {
    const entry = zip.file(prefix + item.path);
    assert(entry, `Missing ${item.path}`);
    assert.equal(hash(await entry.async('nodebuffer')), item.sha256, item.path);
  }
  for (const file of Object.keys(zip.files)) assert(!/(^|\/)(node_modules|\.git|\.env[^/]*|test-results)(\/|$)/.test(file), `Unexpected private/generated path: ${file}`);
  if (kind === 'Complete') for (const file of ['package-lock.json', 'scripts/release.mjs', 'DEPLOYMENT_FA.md']) assert(zip.file('hashira-scraper/' + file));
  console.log(`${name}: checksum, CRC, version and runtime inventory passed`);
}
