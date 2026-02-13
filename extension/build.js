// extension/build.js
//
// Bundles extension source files with shared modules into dist/.
// Content scripts can't use ES module imports, so we bundle to IIFE.
//
// Usage: node extension/build.js [--debug]

import { build } from 'esbuild';

const debug = process.argv.includes('--debug');

await build({
  entryPoints: [
    'extension/src/content.js',
    'extension/src/background.js',
  ],
  bundle: true,
  outdir: 'extension/dist',
  format: 'iife',
  target: 'es2020',
  loader: { '.json': 'json' },
  dropLabels: debug ? [] : ['DEBUG'],
  logLevel: 'info',
});
