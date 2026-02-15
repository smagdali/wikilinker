#!/usr/bin/env node
//
// Take store listing screenshots via the live proxy.
// Uses the example articles from the about page.
//
// Usage: node scripts/store-screenshots.mjs
//
// Outputs 1280x800 PNGs to extension/screenshots/

import puppeteer from '../server/node_modules/puppeteer/lib/esm/puppeteer/puppeteer.js';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'extension', 'screenshots');
mkdirSync(outDir, { recursive: true });

const PROXY = 'https://whitelabel.org/wikilinker';

const articles = [
  {
    name: 'npr-tariffs',
    label: 'NPR',
    url: 'https://www.npr.org/2026/01/28/nx-s1-5688905/longtime-u-s-allies-are-shifting-trade-to-asia-due-to-trumps-tariffs-and-rhetoric',
    scroll: 1100,
  },
  {
    name: 'aljazeera-iran',
    label: 'Al Jazeera',
    url: 'https://www.aljazeera.com/news/2026/2/6/trumps-maximalist-demands-for-iran-put-talks-in-oman-on-uncertain-ground',
    scroll: 600,
  },
  {
    name: 'bbc-iran',
    label: 'BBC News',
    url: 'https://www.bbc.co.uk/news/articles/c0mgndkklvmo',
    scroll: 160,
  },
  {
    name: 'guardian-epstein',
    label: 'The Guardian',
    url: 'https://www.theguardian.com/uk-news/2026/feb/09/prince-princess-wales-deeply-concerned-epstein-revelations-andrew',
    scroll: 160,
  },
  {
    name: 'nbc-organizations',
    label: 'NBC News',
    url: 'https://www.nbcnews.com/world/north-america/us-will-exit-66-international-organizations-retreats-global-cooperatio-rcna252914',
    scroll: 1100,
  },
];

async function main() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--window-size=1280,800'],
  });

  for (const article of articles) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const proxyUrl = `${PROXY}?url=${encodeURIComponent(article.url)}`;
    console.log(`[${article.label}] Loading...`);

    try {
      await page.goto(proxyUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Scroll down to get past the proxy header bar into the article body
      await page.evaluate((y) => window.scrollBy(0, y), article.scroll || 160);
      await new Promise(r => setTimeout(r, 500));

      const outPath = join(outDir, `${article.name}.png`);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log(`  Saved: ${outPath}`);
    } catch (e) {
      console.log(`  Failed: ${e.message}`);
    }

    await page.close();
    await new Promise(r => setTimeout(r, 1000));
  }

  await browser.close();
  console.log(`\nDone. Screenshots in: ${outDir}`);
}

main().catch(console.error);
