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
      if (resolved.hostname === new URL(baseUrl).hostname ||
          resolved.hostname.endsWith('.' + new URL(baseUrl).hostname.replace(/^www\./, ''))) {
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

  if (pathname === '/' || pathname === '') return 'homepage';

  const categoryPatterns = [
    /^\/[a-z-]+\/?$/i,
    /^\/[a-z-]+\/[a-z-]+\/?$/i,
    /\/section\//i,
    /\/category\//i,
    /\/topic\//i,
  ];

  for (const pattern of categoryPatterns) {
    if (pattern.test(pathname)) return 'category';
  }

  if (pathname.split('/').filter(Boolean).length >= 3 || /\d{4}/.test(pathname)) {
    return 'article';
  }

  return 'unknown';
}

async function sampleSite(domain, config) {
  console.log(`\nSampling ${config.name} (${domain})...`);

  const pages = { homepage: [], category: [], article: [] };
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

    const links = extractLinks(html, url);
    for (const link of links) {
      if (!visited.has(link)) queue.push(link);
    }

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
