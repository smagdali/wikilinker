#!/usr/bin/env node
//
// Generate store-listing screenshots for Wikilinker, per language, from a
// synthetic news-article template. No external URLs involved — content is
// deterministic and renders identically every run.
//
// Usage:
//   node scripts/generate-screenshots.mjs --lang fr
//   node scripts/generate-screenshots.mjs --all-langs
//
// Requires: playwright, a per-language extension built to build/wikilinker-<lang>/
// (run `node extension/build.js --lang <lang>` first), and per-language
// article content at i18n/<lang>/article-content/voyager.json.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  ROOT_DIR,
  resolveTargetLangs, printUsageAndExit, loadLanguagesConfig,
} from './lib/i18n-translate.mjs';

// ── CLI ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const targets = args.includes('--all-langs')
  ? loadLanguagesConfig()  // include English too for a full set
  : resolveTargetLangs(args);

if (!targets) printUsageAndExit('generate-screenshots.mjs');

// ── Shot dimensions ──────────────────────────────────────────────────────

const SHOTS = [
  { name: 'desktop',  width: 1280, height: 800,  scale: 1 },
  { name: 'iphone',   width: 1284, height: 2778, scale: 3 },
  { name: 'ipad',     width: 2048, height: 2732, scale: 2 },
];

const TEMPLATE = readFileSync(
  join(ROOT_DIR, 'i18n/article-templates/voyager.html'),
  'utf8',
);

// ── Template render ──────────────────────────────────────────────────────

function render(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key in data) return data[key];
    console.warn(`  WARN: missing template key {{${key}}}`);
    return '';
  });
}

// ── Per-language run ─────────────────────────────────────────────────────

async function generateFor(lang) {
  console.log(`\n=== ${lang.code} (${lang.nativeName}) ===`);

  const extDir = lang.code === 'en'
    ? join(ROOT_DIR, 'extension')  // English default path
    : join(ROOT_DIR, `build/wikilinker-${lang.code}`);
  if (!existsSync(join(extDir, 'manifest.json'))) {
    console.warn(`  SKIP: no built extension at ${extDir}`);
    return;
  }

  const contentPath = join(ROOT_DIR, 'i18n', lang.code, 'article-content/voyager.json');
  if (!existsSync(contentPath)) {
    console.warn(`  SKIP: no article content at i18n/${lang.code}/article-content/voyager.json`);
    return;
  }
  const content = JSON.parse(readFileSync(contentPath, 'utf8'));

  const rendered = render(TEMPLATE, {
    LANG: lang.code,
    DIR: lang.dir,
    TITLE: content.title,
    SITE_NAME: content.siteName,
    NAV_WORLD: content.navWorld,
    NAV_SCIENCE: content.navScience,
    NAV_CULTURE: content.navCulture,
    NAV_TECH: content.navTech,
    KICKER: content.kicker,
    HEADLINE: content.headline,
    SUBHEAD: content.subhead,
    AUTHOR: content.author,
    DATE: content.date,
    BODY: content.body,
    FOOTER: content.footer,
  });

  const outDir = join(ROOT_DIR, 'i18n', lang.code, 'screenshots');
  const workDir = join(ROOT_DIR, `build/screenshots/${lang.code}`);
  mkdirSync(outDir, { recursive: true });
  mkdirSync(workDir, { recursive: true });

  const htmlPath = join(workDir, 'voyager.html');
  writeFileSync(htmlPath, rendered);

  // Launch a persistent Chromium context with the extension loaded.
  // Extensions only work in non-headless Chromium, or with the new headless
  // mode (--headless=new). Use channel: 'chromium' to get a full browser
  // with extension support.
  const userDataDir = join(workDir, 'chromium-profile');
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: false,
    args: [
      `--headless=new`,
      `--disable-extensions-except=${extDir}`,
      `--load-extension=${extDir}`,
    ],
  });

  try {
    for (const shot of SHOTS) {
      const page = await context.newPage();
      await page.setViewportSize({
        width: Math.round(shot.width / shot.scale),
        height: Math.round(shot.height / shot.scale),
      });
      await page.goto(`file://${htmlPath}`);
      // Give the extension time to inject wikilinks.
      await page.waitForTimeout(2500);

      const outPath = join(outDir, `voyager-${shot.name}.png`);
      await page.screenshot({
        path: outPath,
        fullPage: false,
      });
      console.log(`  wrote ${outPath}`);
      await page.close();
    }
  } finally {
    await context.close();
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

for (const lang of targets) {
  await generateFor(lang);
}

console.log('\nDone.');
