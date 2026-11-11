import { build } from 'esbuild';
import { copyFileSync } from 'node:fs';
await build({
  entryPoints: ['src/content/index.ts'],
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  outfile: 'dist/content.js',
  minify: true,
});
copyFileSync('manifest.json', 'dist/manifest.json');
