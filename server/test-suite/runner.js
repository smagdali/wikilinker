// wikilinker/test-suite/runner.js
import fs from 'fs/promises';
import { readFileSync, createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'node-html-parser';
import { injectWikilinks } from '../lib/injector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES_PATH = path.join(__dirname, 'pages.json');
const ROUNDS_DIR = path.join(__dirname, 'rounds');
const ENTITIES_PATH = path.join(__dirname, '../data/entities.json');

// Maximum HTML size to process (2MB) - larger pages cause memory issues
const MAX_HTML_SIZE = 2 * 1024 * 1024;

// Load entities once at startup to avoid memory issues
let cachedEntities = null;
function getEntities() {
  if (!cachedEntities) {
    console.log('Loading entities...');
    cachedEntities = JSON.parse(readFileSync(ENTITIES_PATH, 'utf-8'));
    console.log(`Loaded ${Object.keys(cachedEntities).length} entities`);
  }
  return cachedEntities;
}

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function getSelectorPath(element) {
  const parts = [];
  let current = element;

  while (current && current.tagName) {
    let selector = current.tagName.toLowerCase();
    const role = current.getAttribute?.('role');
    if (role) selector += `[role="${role}"]`;
    const classAttr = current.getAttribute?.('class');
    if (classAttr) {
      const classes = classAttr.split(/\s+/).slice(0, 2).join('.');
      if (classes) selector += `.${classes}`;
    }
    parts.unshift(selector);
    current = current.parentNode;
    if (parts.length > 5) break;
  }

  return parts.join(' > ');
}

function getTextContext(text, matchStart, matchEnd, contextLength = 30) {
  const before = text.slice(Math.max(0, matchStart - contextLength), matchStart);
  const match = text.slice(matchStart, matchEnd);
  const after = text.slice(matchEnd, matchEnd + contextLength);
  return `...${before}[${match}]${after}...`;
}

function analyzeWikilinks(processedHtml, articleSelector) {
  const processed = parse(processedHtml);
  const wikilinks = processed.querySelectorAll('.wikilink');
  const results = [];

  const articleElements = [];
  if (articleSelector) {
    const selectors = articleSelector.split(',').map(s => s.trim());
    for (const sel of selectors) {
      try {
        const elements = processed.querySelectorAll(sel);
        articleElements.push(...elements);
      } catch { /* Invalid selector */ }
    }
  }

  // Get article content once for checking
  let articleContent = '';
  for (const el of articleElements) {
    articleContent += el.outerHTML || '';
  }

  for (const link of wikilinks) {
    const entity = link.text?.trim();
    const type = 'entity';

    const linkHtml = link.outerHTML;
    let isCorrect = false;

    if (articleElements.length > 0) {
      isCorrect = articleContent.includes(linkHtml);
    } else {
      // No article selector - check if in body
      const body = processed.querySelector('body');
      isCorrect = body?.outerHTML?.includes(linkHtml) || false;
    }

    const selectorPath = getSelectorPath(link.parentNode);
    const parentText = link.parentNode?.text || '';
    const linkText = link.text || entity;
    const matchStart = parentText.indexOf(linkText);
    const textContext = matchStart >= 0
      ? getTextContext(parentText, matchStart, matchStart + linkText.length)
      : linkText;

    results.push({ entity, type, isCorrect, selectorPath, textContext });
  }

  return results;
}

async function processPage(pageInfo, articleSelector, entities) {
  const { url, type } = pageInfo;

  try {
    const html = await fetchPage(url);
    if (!html) {
      return { url, type, error: 'fetch_failed', wikilinks: [], stats: { correct: 0, incorrect: 0 } };
    }

    // Skip pages that are too large to avoid memory issues
    if (html.length > MAX_HTML_SIZE) {
      return { url, type, error: 'page_too_large', wikilinks: [], stats: { correct: 0, incorrect: 0 } };
    }

    const processedHtml = injectWikilinks(html, articleSelector, entities);
    const wikilinks = analyzeWikilinks(processedHtml, articleSelector);

    const correct = wikilinks.filter(w => w.isCorrect).length;
    const incorrect = wikilinks.filter(w => !w.isCorrect).length;

    return { url, type, articleSelector, wikilinks, stats: { correct, incorrect } };
  } catch (err) {
    // Catch any processing errors and continue
    return { url, type, error: err.message || 'processing_error', wikilinks: [], stats: { correct: 0, incorrect: 0 } };
  }
}

async function main() {
  const roundArg = process.argv.find(a => a.startsWith('--round='));
  const round = roundArg ? parseInt(roundArg.split('=')[1]) : 0;

  console.log(`Wikilinker Test Suite - Runner (Round ${round})`);
  console.log('='.repeat(50));

  let pages;
  try {
    pages = JSON.parse(await fs.readFile(PAGES_PATH, 'utf-8'));
  } catch {
    console.error('No pages.json found. Run sampler first: npm run test-suite:sample');
    process.exit(1);
  }

  // Load entities once
  const entities = getEntities();

  await fs.mkdir(ROUNDS_DIR, { recursive: true });
  const resultsPath = path.join(ROUNDS_DIR, `results-round-${round}.json`);

  const results = [];
  let totalCorrect = 0;
  let totalIncorrect = 0;
  let errors = 0;

  for (const site of pages) {
    console.log(`\nProcessing ${site.name}...`);

    for (const pageInfo of site.pages) {
      process.stdout.write(`  ${pageInfo.type}: ${pageInfo.url.slice(0, 60)}...`);

      const result = await processPage(pageInfo, site.articleSelector, entities);
      result.site = site.domain;
      result.siteName = site.name;
      results.push(result);

      totalCorrect += result.stats.correct;
      totalIncorrect += result.stats.incorrect;

      if (result.error) {
        errors++;
        console.log(` ERR: ${result.error}`);
      } else {
        console.log(` ✓${result.stats.correct} ✗${result.stats.incorrect}`);
      }

      // Small delay between requests
      await new Promise(r => setTimeout(r, 300));
    }

    // Write intermediate results after each site (in case of crash)
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Round ${round} complete:`);
  console.log(`  Total pages: ${results.length}`);
  console.log(`  Correct links: ${totalCorrect}`);
  console.log(`  Incorrect links: ${totalIncorrect}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Results saved to: ${resultsPath}`);
}

main().catch(console.error);
