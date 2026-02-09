// extension/build.js
//
// Bundles extension source files with shared modules into dist/.
// Content scripts can't use ES module imports, so we bundle to IIFE.
//
// Usage: node extension/build.js

import { build } from 'esbuild';

await build({
  entryPoints: [
    'extension/src/content.js',
    'extension/src/background.js',
  ],
  bundle: true,
  outdir: 'extension/dist',
  format: 'iife',
  target: 'chrome120',
  loader: { '.json': 'json' },
  logLevel: 'info',
});
