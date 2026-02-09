// wikilinker/test-suite/screenshotter.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUNDS_DIR = path.join(__dirname, 'rounds');
const SCREENSHOTS_DIR = path.join(ROUNDS_DIR, 'screenshots');

const PROXY_BASE = 'http://localhost:3000/wikilinker';

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function slugify(url) {
  return new URL(url).hostname.replace(/^www\./, '').split('.')[0];
}

function getPageId(url, type) {
  const site = slugify(url);
  const hash = Buffer.from(url).toString('base64').slice(0, 8);
  return `${site}-${type}-${hash}`;
}

async function captureScreenshots(browser, pageInfo, round) {
  const { url, type } = pageInfo;
  const pageId = getPageId(url, type);

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // Capture original (only on round 0)
    if (round === 0) {
      console.log(`  Capturing original: ${url.slice(0, 50)}...`);
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await page.screenshot({
          path: path.join(SCREENSHOTS_DIR, `${pageId}-original.png`),
          fullPage: false,
        });
      } catch (e) {
        console.log(`    Failed to capture original: ${e.message}`);
      }
    }

    // Capture wikilinked version
    const proxyUrl = `${PROXY_BASE}?url=${encodeURIComponent(url)}`;
    console.log(`  Capturing round ${round}: ${url.slice(0, 50)}...`);
    try {
      await page.goto(proxyUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `${pageId}-round-${round}.png`),
        fullPage: false,
      });
      return true;
    } catch (e) {
      console.log(`    Failed to capture wikilinked: ${e.message}`);
      return false;
    }
  } finally {
    await page.close();
  }
}

async function main() {
  const roundArg = process.argv.find(a => a.startsWith('--round='));
  const round = roundArg ? parseInt(roundArg.split('=')[1]) : 0;

  console.log(`Wikilinker Test Suite - Screenshotter (Round ${round})`);
  console.log('='.repeat(60));

  await ensureDir(SCREENSHOTS_DIR);

  const resultsPath = path.join(ROUNDS_DIR, `results-round-${round}.json`);
  let results;
  try {
    results = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
  } catch {
    console.error('No results found. Run runner first.');
    process.exit(1);
  }

  let worstPages;
  const worstPagesPath = path.join(ROUNDS_DIR, 'worst-pages.json');

  if (round === 0) {
    // Find 2-3 worst pages per site
    const bySite = new Map();
    for (const page of results) {
      const site = page.site;
      if (!bySite.has(site)) bySite.set(site, []);
      bySite.get(site).push(page);
    }

    worstPages = [];
    for (const [site, pages] of bySite) {
      const sorted = pages.sort((a, b) =>
        (b.stats?.incorrect || 0) - (a.stats?.incorrect || 0)
      );
      worstPages.push(...sorted.slice(0, 3).map(p => ({
        url: p.url,
        type: p.type,
        site,
        incorrectCount: p.stats?.incorrect || 0,
      })));
    }

    await fs.writeFile(worstPagesPath, JSON.stringify(worstPages, null, 2));
    console.log(`Identified ${worstPages.length} worst pages for tracking\n`);
  } else {
    try {
      worstPages = JSON.parse(await fs.readFile(worstPagesPath, 'utf-8'));
    } catch {
      console.error('No worst-pages.json found. Run round 0 first.');
      process.exit(1);
    }
  }

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  });

  let captured = 0;
  for (const pageInfo of worstPages) {
    const success = await captureScreenshots(browser, pageInfo, round);
    if (success) captured++;
    await new Promise(r => setTimeout(r, 1000));
  }

  await browser.close();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Captured ${captured} screenshots for round ${round}`);
  console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);
}

main().catch(console.error);
