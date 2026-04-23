#!/usr/bin/env node
//
// Render Wikilinker promo tiles for a language using Playwright.
// Produces i18n/{lang}/promo-440x280.png and promo-1400x560.png from the
// HTML templates at i18n/{lang}/promo-440x280.html / 1400x560.html.
//
// Usage:
//   node scripts/render-promos.mjs --lang fr
//   node scripts/render-promos.mjs --all-langs
//
// Promo HTML files must exist first. They mirror the English templates
// at extension/promo-440x280.html and extension/promo-1400x560.html.

import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT_DIR,
  resolveTargetLangs, printUsageAndExit, loadLanguagesConfig,
} from './lib/i18n-translate.mjs';

const args = process.argv.slice(2);
const targets = args.includes('--all-langs')
  ? loadLanguagesConfig()
  : resolveTargetLangs(args);
if (!targets) printUsageAndExit('render-promos.mjs');

const SIZES = [
  { name: '440x280',  width: 440,  height: 280  },
  { name: '1400x560', width: 1400, height: 560 },
];

const browser = await chromium.launch({ headless: true });

for (const lang of targets) {
  console.log(`\n=== ${lang.code} (${lang.nativeName}) ===`);

  for (const size of SIZES) {
    const htmlPath = join(ROOT_DIR, 'i18n', lang.code, `promo-${size.name}.html`);
    const pngPath  = join(ROOT_DIR, 'i18n', lang.code, `promo-${size.name}.png`);

    if (!existsSync(htmlPath)) {
      console.warn(`  skip ${size.name}: no ${htmlPath}`);
      continue;
    }

    const page = await browser.newPage({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 1,
    });
    await page.goto(`file://${htmlPath}`);
    await page.screenshot({ path: pngPath, type: 'png', omitBackground: false });
    await page.close();
    console.log(`  wrote ${pngPath}`);
  }
}

await browser.close();
console.log('\nDone.');
