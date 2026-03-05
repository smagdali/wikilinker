// extension/build.js
//
// Bundles extension source files with shared modules into dist/.
// Content scripts can't use ES module imports, so we bundle to IIFE.
//
// Usage: node extension/build.js [--debug] [--bloom]

import { build } from 'esbuild';
import { readFileSync } from 'fs';

const debug = process.argv.includes('--debug');
const bloom = process.argv.includes('--bloom');

const bgEntry = bloom
  ? 'extension/src/background-bloom.js'
  : 'extension/src/background.js';

const entityCount = bloom ? 1_000_000 : JSON.parse(readFileSync('server/shared/entities.json')).length;

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
  define: { ENTITY_COUNT: String(entityCount) },
  dropLabels: debug ? [] : ['DEBUG'],
  logLevel: 'info',
});
