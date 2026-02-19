// extension/build.js
//
// Bundles extension source files with shared modules into dist/.
// Content scripts can't use ES module imports, so we bundle to IIFE.
//
// Usage: node extension/build.js [--debug] [--bloom]

import { build } from 'esbuild';

const debug = process.argv.includes('--debug');
const bloom = process.argv.includes('--bloom');

const bgEntry = bloom
  ? 'extension/src/background-bloom.js'
  : 'extension/src/background.js';

await build({
  entryPoints: {
    content: 'extension/src/content.js',
    background: bgEntry,
  },
  bundle: true,
  outdir: 'extension/dist',
  format: 'iife',
  target: 'es2020',
  loader: { '.json': 'json', '.bin': 'binary' },
  dropLabels: debug ? [] : ['DEBUG'],
  logLevel: 'info',
});
