import { build } from 'esbuild';
await build({
  entryPoints: ['tests/harness.ts'],
  bundle: true,
  format: 'iife',
  outfile: 'tests/fixtures/.generated/harness.js',
  target: 'chrome120',
});
