# Wikilinker Testing Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a test suite that samples 480 pages across 24 news sites, detects incorrect wikilink placement, clusters errors by pattern, and tracks regressions across fix iterations.

**Architecture:** Sampler crawls sites to build page list, runner processes pages and detects correct/incorrect links, analyzer clusters errors, reporter compares rounds, screenshotter captures visual progression.

**Tech Stack:** Node.js, Puppeteer (screenshots), node-html-parser, shared skip-rules module portable to Chrome extension.

---

### Task 1: Add Puppeteer dependency and create test-suite directory structure

**Files:**
- Modify: `wikilinker/package.json`
- Create: `wikilinker/test-suite/` directory structure

**Step 1: Add puppeteer to package.json**

```json
{
  "name": "wikilinker-server",
  "version": "1.0.0",
  "description": "Web proxy demo for Wikilinker",
  "main": "server.js",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "node --test",
    "test-suite": "node test-suite/runner.js",
    "test-suite:sample": "node test-suite/sampler.js",
    "test-suite:analyze": "node test-suite/analyzer.js",
    "test-suite:report": "node test-suite/reporter.js",
    "test-suite:screenshot": "node test-suite/screenshotter.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "node-html-parser": "^6.1.12",
    "jsdom": "^24.0.0",
    "dompurify": "^3.0.8",
    "puppeteer": "^22.0.0"
  }
}
```

**Step 2: Create directory structure**

Run: `mkdir -p wikilinker/test-suite/rounds/screenshots`

**Step 3: Install dependencies**

Run: `cd wikilinker && npm install`
Expected: puppeteer installs successfully

**Step 4: Commit**

```bash
git add wikilinker/package.json
git commit -m "feat(test-suite): add puppeteer dependency and npm scripts"
```

---

### Task 2: Create shared skip-rules module

**Files:**
- Create: `wikilinker/shared/skip-rules.js`
- Test: `wikilinker/test/skip-rules.test.js`

**Step 1: Write the failing test**

```javascript
// wikilinker/test/skip-rules.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SKIP_TAGS, SKIP_SELECTORS, shouldSkipElement } from '../shared/skip-rules.js';

describe('SKIP_TAGS', () => {
  it('includes navigation-related tags', () => {
    assert.ok(SKIP_TAGS.has('NAV'));
    assert.ok(SKIP_TAGS.has('HEADER'));
    assert.ok(SKIP_TAGS.has('FOOTER'));
    assert.ok(SKIP_TAGS.has('ASIDE'));
  });

  it('includes interactive elements', () => {
    assert.ok(SKIP_TAGS.has('A'));
    assert.ok(SKIP_TAGS.has('BUTTON'));
    assert.ok(SKIP_TAGS.has('INPUT'));
  });

  it('includes code/preformatted elements', () => {
    assert.ok(SKIP_TAGS.has('CODE'));
    assert.ok(SKIP_TAGS.has('PRE'));
    assert.ok(SKIP_TAGS.has('SCRIPT'));
    assert.ok(SKIP_TAGS.has('STYLE'));
  });
});

describe('shouldSkipElement', () => {
  it('skips elements with skip tags', () => {
    const element = { tagName: 'NAV' };
    const closestFn = () => false;
    assert.strictEqual(shouldSkipElement(element, closestFn), true);
  });

  it('skips elements inside navigation role', () => {
    const element = { tagName: 'DIV' };
    const closestFn = (el, sel) => sel === '[role="navigation"]';
    assert.strictEqual(shouldSkipElement(element, closestFn), true);
  });

  it('allows normal paragraph elements', () => {
    const element = { tagName: 'P' };
    const closestFn = () => false;
    assert.strictEqual(shouldSkipElement(element, closestFn), false);
  });

  it('returns true on error (defensive)', () => {
    const element = null;
    const closestFn = () => { throw new Error('test'); };
    assert.strictEqual(shouldSkipElement(element, closestFn), true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd wikilinker && npm test`
Expected: FAIL - Cannot find module '../shared/skip-rules.js'

**Step 3: Write minimal implementation**

```javascript
// wikilinker/shared/skip-rules.js

/**
 * Shared skip rules for wikilink injection.
 * Portable between Node.js server and Chrome extension.
 *
 * Principle: When in doubt, don't link.
 */

export const SKIP_TAGS = new Set([
  // Script/style
  'SCRIPT', 'STYLE', 'NOSCRIPT',
  // Interactive elements
  'A', 'BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'LABEL',
  // Navigation/chrome
  'NAV', 'HEADER', 'FOOTER', 'ASIDE',
  // Code/preformatted
  'CODE', 'PRE', 'KBD', 'SAMP',
  // Media/embedded
  'SVG', 'MATH', 'IFRAME', 'OBJECT', 'EMBED', 'CANVAS',
  // Document structure (non-content)
  'HEAD', 'TITLE', 'META', 'LINK',
]);

export const SKIP_SELECTORS = [
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="complementary"]',
  '[role="search"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="toolbar"]',
  '[aria-hidden="true"]',
  '[data-component="nav"]',
  '[data-component="navigation"]',
];

/**
 * Determine if an element should be skipped for wikilink injection.
 *
 * @param {Object} element - DOM element (or node-html-parser element)
 * @param {Function} closestFn - Function(element, selector) => boolean
 * @returns {boolean} - true if element should be skipped
 */
export function shouldSkipElement(element, closestFn) {
  try {
    // Skip by tag name
    const tagName = element?.tagName?.toUpperCase?.() || element?.tagName;
    if (tagName && SKIP_TAGS.has(tagName)) {
      return true;
    }

    // Skip by selector (uses closest function for compatibility)
    for (const selector of SKIP_SELECTORS) {
      if (closestFn(element, selector)) {
        return true;
      }
    }

    return false;
  } catch {
    // Defensive: on any error, skip the element
    return true;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd wikilinker && npm test`
Expected: All tests pass

**Step 5: Commit**

```bash
git add wikilinker/shared/skip-rules.js wikilinker/test/skip-rules.test.js
git commit -m "feat(shared): add portable skip-rules module"
```

---

### Task 3: Refactor injector.js to use shared skip-rules

**Files:**
- Modify: `wikilinker/lib/injector.js`

**Step 1: Run existing tests to establish baseline**

Run: `cd wikilinker && npm test`
Expected: All tests pass (baseline)

**Step 2: Refactor injector to use shared skip-rules**

```javascript
// wikilinker/lib/injector.js
import { parse } from 'node-html-parser';
import { EntityMatcher } from './matcher.js';
import { shouldSkipElement, SKIP_TAGS } from '../shared/skip-rules.js';

export function injectWikilinks(html, articleSelector, entities = null) {
  const matcher = new EntityMatcher(entities);
  const root = parse(html, {
    comment: true,
    blockTextElements: {
      script: true,
      noscript: true,
      style: true,
      pre: true
    }
  });

  // Find article content elements
  let contentElements;
  if (articleSelector) {
    const selectors = articleSelector.split(',').map(s => s.trim());
    for (const sel of selectors) {
      contentElements = root.querySelectorAll(sel);
      if (contentElements.length > 0) break;
    }
  }

  if (!contentElements || contentElements.length === 0) {
    contentElements = [root.querySelector('body') || root];
  }

  // Process each content element
  for (const element of contentElements) {
    processElement(element, matcher);
  }

  return root.toString();
}

// Adapter for node-html-parser's closest
function closestAdapter(element, selector) {
  try {
    return !!element?.closest?.(selector);
  } catch {
    return false;
  }
}

function processElement(element, matcher, insideLink = false) {
  if (!element) return;

  const tagName = element.tagName?.toUpperCase();

  // Use shared skip rules
  if (shouldSkipElement(element, closestAdapter)) {
    return;
  }

  // Skip if already a wikilink
  if (element.classNames?.includes('wikilink')) {
    return;
  }

  // Track if we're inside a link (including this element)
  const isLink = tagName === 'A';
  const nowInsideLink = insideLink || isLink;

  // Get all text nodes
  const childNodes = element.childNodes || [];

  for (let i = 0; i < childNodes.length; i++) {
    const node = childNodes[i];

    if (node.nodeType === 3) { // Text node
      // Skip text inside links
      if (nowInsideLink) continue;

      const text = node.rawText || node.text || '';
      if (text.trim().length < 3) continue;

      const matches = matcher.findMatches(text);
      if (matches.length === 0) continue;

      // Build replacement HTML
      let newHtml = '';
      let lastIndex = 0;

      for (const match of matches) {
        // Add text before this match
        if (match.index > lastIndex) {
          newHtml += escapeHtml(text.slice(lastIndex, match.index));
        }

        // Add the wikilink
        const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(match.text.replace(/ /g, '_'))}`;
        newHtml += `<a href="${wikiUrl}" class="wikilink wikilink-${match.type}" target="_blank" rel="noopener" data-wikidata-id="${match.wikidataId}" title="${match.text} (${match.type})"><span class="wikilink-icon">${match.icon}</span>${escapeHtml(match.text)}</a>`;

        lastIndex = match.index + match.text.length;
      }

      // Add remaining text
      if (lastIndex < text.length) {
        newHtml += escapeHtml(text.slice(lastIndex));
      }

      // Replace the text node with new HTML
      if (newHtml !== escapeHtml(text)) {
        node.rawText = newHtml;
        node._rawText = newHtml;
      }
    } else if (node.nodeType === 1) { // Element node
      processElement(node, matcher, nowInsideLink);
    }
  }
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

**Step 3: Run tests to verify refactor didn't break anything**

Run: `cd wikilinker && npm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add wikilinker/lib/injector.js
git commit -m "refactor(injector): use shared skip-rules module"
```

---

### Task 4: Create sampler.js - page discovery

**Files:**
- Create: `wikilinker/test-suite/sampler.js`

**Step 1: Write the sampler**

```javascript
// wikilinker/test-suite/sampler.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'node-html-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITES_PATH = path.join(__dirname, '../data/sites.json');
const PAGES_PATH = path.join(__dirname, 'pages.json');

const PAGES_PER_SITE = 20;
const ARTICLES_PER_SITE = 17;
const CATEGORY_PAGES_PER_SITE = 2;

// User agent to avoid blocks
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

function extractLinks(html, baseUrl) {
  const root = parse(html);
  const links = root.querySelectorAll('a[href]');
  const urls = new Set();

  for (const link of links) {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;

    try {
      const resolved = new URL(href, baseUrl);
      // Only same-origin links
      if (resolved.hostname === new URL(baseUrl).hostname) {
        urls.add(resolved.href);
      }
    } catch {
      // Invalid URL
    }
  }

  return Array.from(urls);
}

function classifyPage(url, siteDomain) {
  const pathname = new URL(url).pathname;

  // Homepage
  if (pathname === '/' || pathname === '') return 'homepage';

  // Common category patterns
  const categoryPatterns = [
    /^\/[a-z-]+\/?$/i,           // /news/, /sport/
    /^\/[a-z-]+\/[a-z-]+\/?$/i,  // /news/world/
    /\/section\//i,
    /\/category\//i,
    /\/topic\//i,
  ];

  for (const pattern of categoryPatterns) {
    if (pattern.test(pathname)) return 'category';
  }

  // Assume articles have longer paths or dates
  if (pathname.split('/').filter(Boolean).length >= 3 ||
      /\d{4}/.test(pathname)) {
    return 'article';
  }

  return 'unknown';
}

async function sampleSite(domain, config) {
  console.log(`\nSampling ${config.name} (${domain})...`);

  const pages = {
    homepage: [],
    category: [],
    article: [],
  };

  const visited = new Set();
  const queue = [config.homepageUrl];

  while (queue.length > 0 &&
         (pages.article.length < ARTICLES_PER_SITE ||
          pages.category.length < CATEGORY_PAGES_PER_SITE)) {

    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    const html = await fetchPage(url);
    if (!html) continue;

    const pageType = classifyPage(url, domain);

    if (pageType === 'homepage' && pages.homepage.length < 1) {
      pages.homepage.push(url);
      console.log(`  [homepage] ${url}`);
    } else if (pageType === 'category' && pages.category.length < CATEGORY_PAGES_PER_SITE) {
      pages.category.push(url);
      console.log(`  [category] ${url}`);
    } else if (pageType === 'article' && pages.article.length < ARTICLES_PER_SITE) {
      pages.article.push(url);
      console.log(`  [article] ${url}`);
    }

    // Add discovered links to queue
    const links = extractLinks(html, url);
    for (const link of links) {
      if (!visited.has(link)) {
        queue.push(link);
      }
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  return {
    domain,
    name: config.name,
    articleSelector: config.articleSelector,
    pages: [
      ...pages.homepage.map(url => ({ url, type: 'homepage' })),
      ...pages.category.map(url => ({ url, type: 'category' })),
      ...pages.article.map(url => ({ url, type: 'article' })),
    ],
  };
}

async function main() {
  console.log('Wikilinker Test Suite - Page Sampler');
  console.log('====================================');

  const sites = JSON.parse(await fs.readFile(SITES_PATH, 'utf-8'));
  const results = [];

  for (const [domain, config] of Object.entries(sites)) {
    try {
      const siteResult = await sampleSite(domain, config);
      results.push(siteResult);
      console.log(`  Total: ${siteResult.pages.length} pages`);
    } catch (error) {
      console.error(`  Error sampling ${domain}: ${error.message}`);
    }
  }

  await fs.writeFile(PAGES_PATH, JSON.stringify(results, null, 2));

  const totalPages = results.reduce((sum, s) => sum + s.pages.length, 0);
  console.log(`\n====================================`);
  console.log(`Saved ${totalPages} pages across ${results.length} sites to pages.json`);
}

main().catch(console.error);
```

**Step 2: Run the sampler on a single site to test**

Run: `cd wikilinker && node test-suite/sampler.js 2>&1 | head -50`
Expected: Pages are discovered and logged

**Step 3: Commit**

```bash
git add wikilinker/test-suite/sampler.js
git commit -m "feat(test-suite): add page sampler"
```

---

### Task 5: Create runner.js - page processing and correctness detection

**Files:**
- Create: `wikilinker/test-suite/runner.js`

**Step 1: Write the runner**

```javascript
// wikilinker/test-suite/runner.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'node-html-parser';
import { injectWikilinks } from '../lib/injector.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES_PATH = path.join(__dirname, 'pages.json');
const ROUNDS_DIR = path.join(__dirname, 'rounds');

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

    // Add role if present
    const role = current.getAttribute?.('role');
    if (role) selector += `[role="${role}"]`;

    // Add class hints
    const classes = current.classNames?.slice(0, 2).join('.');
    if (classes) selector += `.${classes}`;

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

function analyzeWikilinks(originalHtml, processedHtml, articleSelector) {
  const processed = parse(processedHtml);
  const wikilinks = processed.querySelectorAll('.wikilink');
  const results = [];

  // Get article content boundaries
  const articleElements = [];
  if (articleSelector) {
    const selectors = articleSelector.split(',').map(s => s.trim());
    for (const sel of selectors) {
      try {
        const elements = processed.querySelectorAll(sel);
        articleElements.push(...elements);
      } catch {
        // Invalid selector
      }
    }
  }

  for (const link of wikilinks) {
    const wikidataId = link.getAttribute('data-wikidata-id');
    const entity = link.text?.replace(/^[^\w]*/, '').trim(); // Remove emoji prefix
    const typeMatch = link.classNames?.find(c => c.startsWith('wikilink-') && c !== 'wikilink');
    const type = typeMatch?.replace('wikilink-', '') || 'unknown';

    // Check if inside article selector
    let isCorrect = false;
    for (const articleEl of articleElements) {
      if (articleEl.outerHTML?.includes(link.outerHTML)) {
        isCorrect = true;
        break;
      }
    }

    // If no article selector matched, check if it would have been in body
    if (articleElements.length === 0) {
      const body = processed.querySelector('body');
      isCorrect = body?.outerHTML?.includes(link.outerHTML) || false;
    }

    const selectorPath = getSelectorPath(link.parentNode);
    const parentText = link.parentNode?.text || '';
    const linkText = link.text || entity;
    const matchStart = parentText.indexOf(linkText);
    const textContext = matchStart >= 0
      ? getTextContext(parentText, matchStart, matchStart + linkText.length)
      : linkText;

    results.push({
      entity,
      wikidataId,
      type,
      isCorrect,
      selectorPath,
      textContext,
    });
  }

  return results;
}

async function processPage(pageInfo, articleSelector) {
  const { url, type } = pageInfo;

  const html = await fetchPage(url);
  if (!html) {
    return { url, type, error: 'fetch_failed', wikilinks: [], stats: { correct: 0, incorrect: 0 } };
  }

  const processedHtml = injectWikilinks(html, articleSelector);
  const wikilinks = analyzeWikilinks(html, processedHtml, articleSelector);

  const correct = wikilinks.filter(w => w.isCorrect).length;
  const incorrect = wikilinks.filter(w => !w.isCorrect).length;

  return {
    url,
    type,
    articleSelector,
    wikilinks,
    stats: { correct, incorrect },
  };
}

async function main() {
  const roundArg = process.argv.find(a => a.startsWith('--round='));
  const round = roundArg ? parseInt(roundArg.split('=')[1]) : 0;

  console.log(`Wikilinker Test Suite - Runner (Round ${round})`);
  console.log('='.repeat(50));

  // Load pages
  let pages;
  try {
    pages = JSON.parse(await fs.readFile(PAGES_PATH, 'utf-8'));
  } catch {
    console.error('No pages.json found. Run sampler first: npm run test-suite:sample');
    process.exit(1);
  }

  const results = [];
  let totalCorrect = 0;
  let totalIncorrect = 0;

  for (const site of pages) {
    console.log(`\nProcessing ${site.name}...`);

    for (const pageInfo of site.pages) {
      process.stdout.write(`  ${pageInfo.type}: ${pageInfo.url.slice(0, 60)}...`);

      const result = await processPage(pageInfo, site.articleSelector);
      result.site = site.domain;
      result.siteName = site.name;
      results.push(result);

      totalCorrect += result.stats.correct;
      totalIncorrect += result.stats.incorrect;

      console.log(` ✓${result.stats.correct} ✗${result.stats.incorrect}`);

      // Rate limiting
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // Save results
  const roundDir = ROUNDS_DIR;
  await fs.mkdir(roundDir, { recursive: true });

  const resultsPath = path.join(roundDir, `results-round-${round}.json`);
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Round ${round} complete:`);
  console.log(`  Total pages: ${results.length}`);
  console.log(`  Correct links: ${totalCorrect}`);
  console.log(`  Incorrect links: ${totalIncorrect}`);
  console.log(`  Results saved to: ${resultsPath}`);
}

main().catch(console.error);
```

**Step 2: Test the runner on saved pages**

Run: `cd wikilinker && node test-suite/runner.js --round=0 2>&1 | head -30`
Expected: Pages are processed and results logged

**Step 3: Commit**

```bash
git add wikilinker/test-suite/runner.js
git commit -m "feat(test-suite): add page runner with correctness detection"
```

---

### Task 6: Create analyzer.js - error clustering

**Files:**
- Create: `wikilinker/test-suite/analyzer.js`

**Step 1: Write the analyzer**

```javascript
// wikilinker/test-suite/analyzer.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUNDS_DIR = path.join(__dirname, 'rounds');

function normalizeSelectorPath(selectorPath) {
  // Remove specific class names, keep structure
  return selectorPath
    .replace(/\.[a-zA-Z0-9_-]+/g, '') // Remove classes
    .replace(/\[role="([^"]+)"\]/g, '[$1]') // Simplify roles
    .replace(/\s+/g, ' ')
    .trim();
}

function clusterByPattern(incorrectLinks) {
  const clusters = new Map();

  for (const link of incorrectLinks) {
    const pattern = normalizeSelectorPath(link.selectorPath);

    if (!clusters.has(pattern)) {
      clusters.set(pattern, {
        pattern,
        count: 0,
        sites: new Set(),
        examples: [],
      });
    }

    const cluster = clusters.get(pattern);
    cluster.count++;
    cluster.sites.add(link.site);

    if (cluster.examples.length < 3) {
      cluster.examples.push({
        entity: link.entity,
        url: link.url,
        textContext: link.textContext,
      });
    }
  }

  return Array.from(clusters.values())
    .map(c => ({ ...c, sites: Array.from(c.sites) }))
    .sort((a, b) => b.count - a.count);
}

async function main() {
  const roundArg = process.argv.find(a => a.startsWith('--round='));
  const round = roundArg ? parseInt(roundArg.split('=')[1]) : 0;

  console.log(`Wikilinker Test Suite - Analyzer (Round ${round})`);
  console.log('='.repeat(60));

  // Load results
  const resultsPath = path.join(ROUNDS_DIR, `results-round-${round}.json`);
  let results;
  try {
    results = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
  } catch {
    console.error(`No results found for round ${round}. Run runner first.`);
    process.exit(1);
  }

  // Collect all incorrect links
  const incorrectLinks = [];
  for (const page of results) {
    for (const link of page.wikilinks || []) {
      if (!link.isCorrect) {
        incorrectLinks.push({
          ...link,
          site: page.site,
          url: page.url,
        });
      }
    }
  }

  console.log(`\nTotal incorrect links: ${incorrectLinks.length}\n`);

  // Cluster by pattern
  const clusters = clusterByPattern(incorrectLinks);

  console.log('Pattern Analysis:');
  console.log('-'.repeat(60));

  for (const cluster of clusters.slice(0, 20)) {
    console.log(`\n${cluster.pattern}`);
    console.log(`  Count: ${cluster.count} across ${cluster.sites.length} sites`);
    console.log(`  Sites: ${cluster.sites.slice(0, 5).join(', ')}${cluster.sites.length > 5 ? '...' : ''}`);
    console.log(`  Examples:`);
    for (const ex of cluster.examples) {
      console.log(`    - "${ex.entity}" in ${ex.textContext.slice(0, 50)}`);
    }
  }

  // Save summary
  const summary = {
    round,
    totalPages: results.length,
    totalCorrect: results.reduce((sum, p) => sum + (p.stats?.correct || 0), 0),
    totalIncorrect: incorrectLinks.length,
    clusters: clusters.slice(0, 50),
  };

  const summaryPath = path.join(ROUNDS_DIR, `summary-round-${round}.json`);
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Summary saved to: ${summaryPath}`);
}

main().catch(console.error);
```

**Step 2: Test the analyzer**

Run: `cd wikilinker && node test-suite/analyzer.js --round=0 2>&1 | head -50`
Expected: Clusters are identified and displayed

**Step 3: Commit**

```bash
git add wikilinker/test-suite/analyzer.js
git commit -m "feat(test-suite): add error clustering analyzer"
```

---

### Task 7: Create reporter.js - regression detection

**Files:**
- Create: `wikilinker/test-suite/reporter.js`

**Step 1: Write the reporter**

```javascript
// wikilinker/test-suite/reporter.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUNDS_DIR = path.join(__dirname, 'rounds');

function linkKey(link, url) {
  // Create a stable key for matching links across rounds
  return `${link.wikidataId}|${url}|${link.textContext?.slice(0, 50)}`;
}

function compareRounds(prevResults, currResults) {
  // Build maps of link states
  const prevLinks = new Map();
  const currLinks = new Map();

  for (const page of prevResults) {
    for (const link of page.wikilinks || []) {
      const key = linkKey(link, page.url);
      prevLinks.set(key, { ...link, url: page.url, site: page.site });
    }
  }

  for (const page of currResults) {
    for (const link of page.wikilinks || []) {
      const key = linkKey(link, page.url);
      currLinks.set(key, { ...link, url: page.url, site: page.site });
    }
  }

  const fixed = [];      // Was incorrect, now correct
  const regressed = [];  // Was correct, now incorrect
  const newCorrect = []; // New link, is correct
  const newIncorrect = []; // New link, is incorrect
  const unchangedCorrect = [];
  const unchangedIncorrect = [];

  // Check current links against previous
  for (const [key, curr] of currLinks) {
    const prev = prevLinks.get(key);

    if (!prev) {
      // New link
      if (curr.isCorrect) {
        newCorrect.push(curr);
      } else {
        newIncorrect.push(curr);
      }
    } else if (!prev.isCorrect && curr.isCorrect) {
      fixed.push(curr);
    } else if (prev.isCorrect && !curr.isCorrect) {
      regressed.push(curr);
    } else if (curr.isCorrect) {
      unchangedCorrect.push(curr);
    } else {
      unchangedIncorrect.push(curr);
    }
  }

  return {
    fixed,
    regressed,
    newCorrect,
    newIncorrect,
    unchangedCorrect,
    unchangedIncorrect,
  };
}

async function main() {
  const roundArg = process.argv.find(a => a.startsWith('--round='));
  const round = roundArg ? parseInt(roundArg.split('=')[1]) : 1;

  if (round < 1) {
    console.log('Round 0 is the baseline - no comparison available.');
    process.exit(0);
  }

  console.log(`Wikilinker Test Suite - Reporter (Round ${round} vs ${round - 1})`);
  console.log('='.repeat(60));

  // Load both rounds
  const prevPath = path.join(ROUNDS_DIR, `results-round-${round - 1}.json`);
  const currPath = path.join(ROUNDS_DIR, `results-round-${round}.json`);

  let prevResults, currResults;
  try {
    prevResults = JSON.parse(await fs.readFile(prevPath, 'utf-8'));
    currResults = JSON.parse(await fs.readFile(currPath, 'utf-8'));
  } catch (error) {
    console.error(`Missing results file: ${error.message}`);
    process.exit(1);
  }

  const comparison = compareRounds(prevResults, currResults);

  console.log(`\nRound ${round} vs Round ${round - 1}:`);
  console.log('─'.repeat(60));
  console.log(`✅ Fixed:              ${comparison.fixed.length} links`);
  console.log(`❌ Regressed:          ${comparison.regressed.length} links`);
  console.log(`➕ New (correct):      ${comparison.newCorrect.length} links`);
  console.log(`➖ New (incorrect):    ${comparison.newIncorrect.length} links`);
  console.log(`⚪ Unchanged correct:  ${comparison.unchangedCorrect.length} links`);
  console.log(`⚪ Unchanged incorrect: ${comparison.unchangedIncorrect.length} links`);

  const netImprovement = comparison.fixed.length - comparison.regressed.length;
  console.log('─'.repeat(60));
  console.log(`Net improvement: ${netImprovement >= 0 ? '+' : ''}${netImprovement} links`);

  // Show regressions in detail (these are critical)
  if (comparison.regressed.length > 0) {
    console.log(`\n⚠️  REGRESSIONS DETECTED:`);
    for (const link of comparison.regressed.slice(0, 10)) {
      console.log(`  - "${link.entity}" at ${link.selectorPath}`);
      console.log(`    URL: ${link.url}`);
    }
    if (comparison.regressed.length > 10) {
      console.log(`  ... and ${comparison.regressed.length - 10} more`);
    }
  }

  // Save regression report
  const report = {
    round,
    comparedTo: round - 1,
    summary: {
      fixed: comparison.fixed.length,
      regressed: comparison.regressed.length,
      newCorrect: comparison.newCorrect.length,
      newIncorrect: comparison.newIncorrect.length,
      unchangedCorrect: comparison.unchangedCorrect.length,
      unchangedIncorrect: comparison.unchangedIncorrect.length,
      netImprovement,
    },
    regressions: comparison.regressed,
    fixes: comparison.fixed.slice(0, 100), // Sample of fixes
  };

  const reportPath = path.join(ROUNDS_DIR, `regression-round-${round}.json`);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`\nReport saved to: ${reportPath}`);
}

main().catch(console.error);
```

**Step 2: Commit**

```bash
git add wikilinker/test-suite/reporter.js
git commit -m "feat(test-suite): add regression reporter"
```

---

### Task 8: Create screenshotter.js - visual capture

**Files:**
- Create: `wikilinker/test-suite/screenshotter.js`

**Step 1: Write the screenshotter**

```javascript
// wikilinker/test-suite/screenshotter.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUNDS_DIR = path.join(__dirname, 'rounds');
const SCREENSHOTS_DIR = path.join(ROUNDS_DIR, 'screenshots');

// Server must be running for wikilinked versions
const PROXY_BASE = 'http://localhost:3000/wikilinker';

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function slugify(url) {
  return new URL(url).hostname.replace(/^www\./, '').split('.')[0];
}

async function captureScreenshots(browser, pageInfo, round, isWorstPage) {
  const { url, type } = pageInfo;
  const site = slugify(url);
  const pageId = `${site}-${type}-${Buffer.from(url).toString('base64').slice(0, 8)}`;

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // Capture original (only on round 0 or if worst page)
    if (round === 0 || isWorstPage) {
      console.log(`  Capturing original: ${url.slice(0, 50)}...`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `${pageId}-original.png`),
        fullPage: false,
      });
    }

    // Capture wikilinked version
    const proxyUrl = `${PROXY_BASE}?url=${encodeURIComponent(url)}`;
    console.log(`  Capturing round ${round}: ${url.slice(0, 50)}...`);
    await page.goto(proxyUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, `${pageId}-round-${round}.png`),
      fullPage: false,
    });

    return true;
  } catch (error) {
    console.error(`  Error capturing ${url}: ${error.message}`);
    return false;
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

  // Load results to find worst pages
  const resultsPath = path.join(ROUNDS_DIR, `results-round-${round}.json`);
  let results;
  try {
    results = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
  } catch {
    console.error('No results found. Run runner first.');
    process.exit(1);
  }

  // On round 0, identify worst pages (most incorrect links)
  // On subsequent rounds, use the same pages from round 0
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

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  });

  let captured = 0;
  for (const pageInfo of worstPages) {
    const success = await captureScreenshots(browser, pageInfo, round, true);
    if (success) captured++;

    // Rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }

  await browser.close();

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Captured ${captured} screenshots for round ${round}`);
  console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);
}

main().catch(console.error);
```

**Step 2: Commit**

```bash
git add wikilinker/test-suite/screenshotter.js
git commit -m "feat(test-suite): add Puppeteer screenshotter"
```

---

### Task 9: Add wikilink styling to ensure font inheritance

**Files:**
- Modify: `wikilinker/lib/header.js` (or create styles file)

**Step 1: Read current header.js**

Check current `getHeaderStyles()` function.

**Step 2: Update styles for font inheritance**

Ensure wikilink styles include:

```css
.wikilink {
  font: inherit;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  text-decoration: none;
}
.wikilink:hover {
  text-decoration: underline;
}
.wikilink-icon {
  margin-right: 0.15em;
}
.wikilink-person { color: #2563eb; }
.wikilink-place { color: #ea580c; }
.wikilink-org { color: #7c3aed; }
.wikilink-company { color: #0d9488; }
```

**Step 3: Run server and verify styling**

Run: `cd wikilinker && npm start`
Verify: Check that wikilinks inherit parent font styling

**Step 4: Commit**

```bash
git add wikilinker/lib/header.js
git commit -m "fix(styling): ensure wikilinks inherit font properties"
```

---

### Task 10: Run baseline (Round 0)

**Step 1: Sample pages**

Run: `cd wikilinker && npm run test-suite:sample`
Expected: pages.json created with ~480 URLs

**Step 2: Run test suite**

Run: `cd wikilinker && npm run test-suite -- --round=0`
Expected: results-round-0.json created

**Step 3: Analyze errors**

Run: `cd wikilinker && npm run test-suite:analyze -- --round=0`
Expected: Clusters displayed, summary-round-0.json created

**Step 4: Capture screenshots**

Run: `cd wikilinker && npm run test-suite:screenshot -- --round=0`
Expected: Screenshots of worst pages captured

**Step 5: Commit baseline results**

```bash
git add wikilinker/test-suite/pages.json wikilinker/test-suite/rounds/
git commit -m "test(baseline): round 0 results"
```

---

### Task 11: Apply fixes based on Round 0 analysis

Based on the clustered error patterns from Round 0, update `shared/skip-rules.js`:

**Step 1: Review clusters from summary-round-0.json**

Identify top patterns (e.g., `nav`, `header`, `[role="navigation"]`)

**Step 2: Add new skip rules**

Update SKIP_TAGS and SKIP_SELECTORS based on findings.

**Step 3: Run tests to verify no breaks**

Run: `cd wikilinker && npm test`

**Step 4: Commit**

```bash
git add wikilinker/shared/skip-rules.js
git commit -m "fix(skip-rules): add patterns from round 0 analysis"
```

---

### Task 12: Run Round 1 and check regressions

**Step 1: Run test suite**

Run: `cd wikilinker && npm run test-suite -- --round=1`

**Step 2: Generate regression report**

Run: `cd wikilinker && npm run test-suite:report -- --round=1`

**Step 3: Capture screenshots**

Run: `cd wikilinker && npm run test-suite:screenshot -- --round=1`

**Step 4: Review regressions**

If regressions exist, investigate and adjust skip-rules.

**Step 5: Commit**

```bash
git add wikilinker/test-suite/rounds/
git commit -m "test(round-1): results and regression report"
```

---

### Task 13: Iterate until clean

Repeat Tasks 11-12 until:
- Zero regressions
- Incorrect links < 1% of total
- Visual review of screenshots shows clean results

---

### Task 14: Port skip-rules to Chrome extension

**Files:**
- Copy: `wikilinker/shared/skip-rules.js` → Chrome extension
- Modify: Chrome extension's content.js to use shared rules

**Step 1: Copy skip-rules to extension**

```bash
cp wikilinker/shared/skip-rules.js /Users/stefan/github/wikilinker/skip-rules.js
```

**Step 2: Update extension content.js**

Integrate `shouldSkipElement` with the extension's native DOM API.

**Step 3: Test extension on sample pages**

Verify both server and extension produce identical results.

**Step 4: Commit extension changes**

```bash
cd /Users/stefan/github/wikilinker
git add skip-rules.js content.js
git commit -m "feat: integrate shared skip-rules from test suite"
```

---

### Task 15: Final verification

**Step 1: Run final round**

Ensure all tests pass with zero regressions.

**Step 2: Compare screenshots**

Review round 0 vs final round screenshots for visual improvement.

**Step 3: Document findings**

Update design doc with final skip rules and lessons learned.

**Step 4: Final commit**

```bash
git add .
git commit -m "docs: finalize wikilinker testing suite"
```
