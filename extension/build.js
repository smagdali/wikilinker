// extension/build.js
//
// Bundles extension source files with shared modules into a complete
// extension directory, parameterised by language.
//
// Usage:
//   node extension/build.js                 # English → extension/dist/ (default, back-compat)
//   node extension/build.js --lang fr       # French  → build/wikilinker-fr/
//   node extension/build.js --lang en       # English → build/wikilinker-en/ (for store ZIP)
//   node extension/build.js --debug         # keep DEBUG: labels
//
// For --lang builds, copies the full runtime tree (manifest, popup, icons,
// styles) to the output dir, patches manifest.default_locale, and writes
// _locales/{lang}/messages.json when i18n/{lang}/messages.json exists.

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';

// ── Arg parsing ─────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const debug = args.includes('--debug');
const langArg = args.indexOf('--lang');
const lang = langArg >= 0 ? args[langArg + 1] : null;   // null = English default-path mode

// Validate lang against i18n/languages.json
const langsJson = JSON.parse(readFileSync('i18n/languages.json', 'utf8'));
const langConfig = lang
  ? langsJson.languages.find((l) => l.code === lang)
  : langsJson.languages.find((l) => l.code === 'en');
if (lang && !langConfig) {
  console.error(`Unknown language: ${lang}`);
  console.error(`Known: ${langsJson.languages.map((l) => l.code).join(', ')}`);
  process.exit(1);
}

const buildLang = langConfig.code;  // 'en', 'fr', ...

// ── Output layout ───────────────────────────────────────────

// Default (no --lang): keep the old extension/dist/ path for back-compat
// with sync-safari.sh, deploy.sh, release.sh, etc.
// Any --lang: output a full extension tree to build/wikilinker-<lang>/
const outputToDistOnly = lang === null;
const distDir = outputToDistOnly ? 'extension/dist' : `build/wikilinker-${buildLang}/dist`;
const pkgDir = outputToDistOnly ? null : `build/wikilinker-${buildLang}`;

// ── Language alias plugin ───────────────────────────────────
//
// matcher-core.js and background.js statically import from i18n/en/.
// For non-English builds, redirect those imports to i18n/<lang>/.

const langAliasPlugin = {
  name: 'wikilinker-lang-alias',
  setup(b) {
    if (buildLang === 'en') return;
    b.onResolve({ filter: /i18n\/en\// }, (args) => {
      const redirected = args.path.replace(/i18n\/en\//, `i18n/${buildLang}/`);
      return { path: path.resolve(path.dirname(args.importer), redirected) };
    });
  },
};

// ── esbuild ─────────────────────────────────────────────────

await build({
  entryPoints: {
    content: 'extension/src/content.js',
    background: 'extension/src/background.js',
  },
  bundle: true,
  outdir: distDir,
  format: 'iife',
  target: 'es2020',
  loader: { '.json': 'json', '.bin': 'binary' },
  define: {
    ENTITY_COUNT: '1000000',
    WIKI_LANG: JSON.stringify(buildLang),
  },
  dropLabels: debug ? [] : ['DEBUG'],
  plugins: [langAliasPlugin],
  logLevel: 'info',
});

// ── Default build: keep extension/_locales/en/messages.json in sync ─

if (outputToDistOnly) {
  const messagesSrc = 'i18n/en/messages.json';
  if (existsSync(messagesSrc)) {
    const localesDir = 'extension/_locales/en';
    mkdirSync(localesDir, { recursive: true });
    cpSync(messagesSrc, path.join(localesDir, 'messages.json'));
  }
}

// ── Full extension tree for --lang builds ──────────────────

if (pkgDir) {
  // Copy the static runtime files
  for (const item of ['manifest.json', 'popup.html', 'popup.js', 'styles.css', 'icons']) {
    const src = path.join('extension', item);
    const dst = path.join(pkgDir, item);
    if (existsSync(dst)) rmSync(dst, { recursive: true, force: true });
    cpSync(src, dst, { recursive: true });
  }

  // Patch manifest.json: set default_locale and localised name/description keys
  const manifestPath = path.join(pkgDir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.default_locale = buildLang;

  // Firefox wants a stable per-language add-on ID
  if (buildLang !== 'en') {
    manifest.browser_specific_settings = manifest.browser_specific_settings || {};
    manifest.browser_specific_settings.gecko = manifest.browser_specific_settings.gecko || {};
    manifest.browser_specific_settings.gecko.id = `wikilinker-${buildLang}@whitelabel.org`;
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  // Copy i18n messages into _locales/{lang}/messages.json if available
  const messagesSrc = `i18n/${buildLang}/messages.json`;
  if (existsSync(messagesSrc)) {
    const localesDir = path.join(pkgDir, '_locales', buildLang);
    mkdirSync(localesDir, { recursive: true });
    cpSync(messagesSrc, path.join(localesDir, 'messages.json'));
  }

  console.log(`\nBuilt: ${pkgDir}/  (lang=${buildLang})`);
}
