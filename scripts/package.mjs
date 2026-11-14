import JSZip from 'jszip';
import { readFile, writeFile, readdir, mkdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
const root = process.cwd();
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const artifacts = join(root, 'artifacts');
await mkdir(artifacts, { recursive: true });
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (
      [
        'node_modules',
        'artifacts',
        'test-results',
        'playwright-report',
        'coverage',
        '.git',
        '.generated',
      ].includes(entry.name)
    )
      continue;
    if (/^\.env(?:\.|$)/.test(entry.name) || /\.(pem|key)$/i.test(entry.name)) throw new Error('Refusing to package potential secret file: ' + entry.name);
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else if (entry.isFile()) out.push(p);
  }
  return out.sort();
}
const runtimePackages = ['react', 'react-dom', 'scheduler', 'zustand', 'dexie', 'jszip', 'xlsx'];
let notices = 'Hashira Scraper — third-party runtime notices\n\n';
for (const name of runtimePackages) {
  const base = join(root, 'node_modules', name);
  const pkg = JSON.parse(await readFile(join(base, 'package.json'), 'utf8'));
  notices += `\n===== ${name} ${pkg.version} =====\n`;
  let found = false;
  for (const file of [
    'LICENSE',
    'LICENSE.txt',
    'LICENSE.md',
    'LICENSE.markdown',
    'license',
    'license.md',
  ]) {
    try {
      notices += await readFile(join(base, file), 'utf8');
      found = true;
      break;
    } catch {
      /* next license filename */
    }
  }
  if (!found) notices += `License: ${JSON.stringify(pkg.license)}\n`;
  notices += '\n';
}
await writeFile(join(root, 'THIRD_PARTY_NOTICES.txt'), notices);
await writeFile(join(root, 'dist', 'THIRD_PARTY_NOTICES.txt'), notices);
const distFiles = await walk(join(root, 'dist'));
const manifest = {
  version,
  files: await Promise.all(
    distFiles.map(async (file) => ({
      path: relative(join(root, 'dist'), file).replaceAll('\\', '/'),
      bytes: (await stat(file)).size,
      sha256: sha(await readFile(file)),
    })),
  ),
};
await writeFile(
  join(root, 'docs', 'BUILD_MANIFEST.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
const zipOptions = { date: new Date('2020-01-01T00:00:00Z'), createFolders: false, unixPermissions: 0o100644 };
const chrome = new JSZip();
for (const file of distFiles)
  chrome.file(
    'hashira-scraper-chrome/' + relative(join(root, 'dist'), file).replaceAll('\\', '/'),
    await readFile(file),
    zipOptions,
  );
for (const file of [
  'INSTALLATION.md',
  'DEPLOYMENT_FA.md',
  'docs/WINDOWS_FA.txt',
  'docs/LIMITATIONS.md',
  'docs/MEDIA_0.3.0.md',
  'docs/TEST_RESULTS.md',
  'docs/OPTION_RECHECK_FA.md',
  'docs/BUILD_MANIFEST.json',
])
  chrome.file(relative(root, join(root, file)), await readFile(join(root, file)), zipOptions);
const chromeName = 'Hashira_Scraper_v' + version + '_Chrome.zip';
await writeFile(
  join(artifacts, chromeName),
  await chrome.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  }),
);
const complete = new JSZip();
const sourceRoots = ['src', 'public', 'scripts', 'tests', 'docs', 'dist'];
const rootFiles = ['.gitignore', '.prettierignore', '.prettierrc.json', '.nvmrc', 'package.json', 'package-lock.json', 'manifest.json', 'tsconfig.json', 'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts', 'eslint.config.js', 'popup.html', 'sidepanel.html', 'offscreen.html', 'README.md', 'ARCHITECTURE.md', 'INSTALLATION.md', 'TESTING.md', 'SECURITY.md', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.txt', 'DEPLOYMENT_FA.md'];
const sourceFiles = [...rootFiles.map(file => join(root, file)), ...(await Promise.all(sourceRoots.map(dir => walk(join(root, dir))))).flat()].sort();
for (const file of sourceFiles)
  complete.file(
    'hashira-scraper/' + relative(root, file).replaceAll('\\', '/'),
    await readFile(file),
    zipOptions,
  );
const sourceName = 'Hashira_Scraper_v' + version + '_Complete.zip';
await writeFile(
  join(artifacts, sourceName),
  await complete.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  }),
);
const sums = [];
for (const filename of [sourceName, chromeName])
  sums.push(`${sha(await readFile(join(artifacts, filename)))}  ${filename}`);
await writeFile(join(artifacts, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
for (const filename of [sourceName, chromeName])
  console.log(`${filename}: ${(await stat(join(artifacts, filename))).size} bytes`);
