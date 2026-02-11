// wikilinker/server.js
import express from 'express';
import { Cache } from './lib/cache.js';
import { fetchPage, isUrlAllowed } from './lib/fetcher.js';
import { sanitizeHtml, getSecurityHeaders } from './lib/sanitizer.js';
import { getSiteConfig, getAllSites } from './lib/extractor.js';
import { injectWikilinks } from './lib/injector.js';
import { rewriteLinks, rewriteResourceUrls } from './lib/rewriter.js';
import { generateHeader, getHeaderStyles, generateDebugPanel } from './lib/header.js';
import { extractWithReadability } from './lib/readability.js';
import { EntityMatcher } from './lib/matcher.js';
import { logMatches } from './lib/logger.js';
import { parse } from 'node-html-parser';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// Configuration from environment
const PORT = process.env.PORT || 3000;
const CACHE_DIR = process.env.CACHE_DIR || './cache';
const CACHE_MAX_SIZE = parseInt(process.env.CACHE_MAX_SIZE) || 1024 * 1024 * 1024;
const UNSAFE_KEY = process.env.UNSAFE_KEY || '';
const PROXY_PATH = '/wikilinker';

// Initialize cache
const cache = new Cache({ dir: CACHE_DIR, maxSize: CACHE_MAX_SIZE });

// Load allowed domains from sites.json
const sites = getAllSites();
const allowedDomains = Object.keys(sites);

// Site names for error messages
const siteNames = [...new Set(Object.values(sites).map(s => s.name))].join(', ');

/**
 * Escape HTML special characters to prevent XSS.
 */
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Apply security headers to ALL responses (including error pages)
app.use((req, res, next) => {
  const headers = getSecurityHeaders();
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  next();
});

/**
 * Determine if a URL is likely a homepage or index page (not an article).
 * We only inject wikilinks on article pages, not homepages/section fronts.
 */
function isIndexPage(urlString) {
  try {
    const url = new URL(urlString);
    const path = url.pathname.replace(/\/+$/, ''); // strip trailing slashes

    // Root/homepage
    if (!path || path === '') return true;

    // Common section front patterns
    const sectionPatterns = [
      /^\/news\/?$/i,
      /^\/sport\/?$/i,
      /^\/business\/?$/i,
      /^\/technology\/?$/i,
      /^\/entertainment\/?$/i,
      /^\/politics\/?$/i,
      /^\/opinion\/?$/i,
      /^\/world\/?$/i,
      /^\/us\/?$/i,
      /^\/uk\/?$/i,
    ];
    for (const pattern of sectionPatterns) {
      if (pattern.test(path)) return true;
    }

    // Very short path with no slug-like component (e.g., /news, /world)
    // Article URLs tend to have longer paths with slugs or IDs
    const segments = path.split('/').filter(Boolean);
    if (segments.length === 1 && !segments[0].match(/\d/)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// Landing page
app.get(PROXY_PATH, async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    // Redirect to BBC News UK as default
    return res.redirect(`${PROXY_PATH}?url=${encodeURIComponent('https://www.bbc.co.uk/news')}`);
  }

  try {
    // Validate URL against domain allowlist
    if (!isUrlAllowed(targetUrl, allowedDomains)) {
      const unsafeKey = req.query.key;
      if (!UNSAFE_KEY || unsafeKey !== UNSAFE_KEY) {
        return res.status(403).send(getErrorPage(
          'Site Not Supported',
          `Wikilinker only works with supported news sites: ${escapeHtml(siteNames)}.`,
          targetUrl
        ));
      }
    }

    const noCache = req.query.nocache === '1';
    const unsafe = req.query.unsafe === '1' && req.query.key === UNSAFE_KEY;
    const debug = req.query.debug === '1';

    // Check cache
    let html;
    let fromCache = false;

    if (!noCache) {
      html = await cache.get(targetUrl);
      if (html) fromCache = true;
    }

    // Fetch if not cached
    if (!html) {
      console.log(`Fetching: ${targetUrl}`);
      const result = await fetchPage(targetUrl, { userAgent: req.headers['user-agent'], allowedDomains });
      html = result.html;

      // Cache the raw HTML
      await cache.set(targetUrl, html);
    } else {
      console.log(`Cache hit: ${targetUrl}`);
    }

    // Get site config
    const siteConfig = getSiteConfig(targetUrl);
    const isUnsupported = !siteConfig;
    const articleSelector = siteConfig?.articleSelector || 'article, main, body';

    // Process HTML
    let processedHtml = html;

    // Sanitize (unless unsafe mode)
    if (!unsafe) {
      processedHtml = sanitizeHtml(processedHtml);
    }

    // Check if this is a homepage/index page — skip wikilink injection
    const isIndex = isIndexPage(targetUrl);
    let knownEntities = null;
    let readabilityDebug = null;
    let debugInfo = null;

    if (isIndex) {
      console.log(`Skipping wikilinks: index/homepage detected for ${targetUrl}`);
      readabilityDebug = { status: 'skipped_index_page' };
    } else {
      // Extract article text with Readability (runs on raw HTML for best scoring)
      const readability = extractWithReadability(html, targetUrl);

      if (readability.isReaderable) {
        console.log(`Readability: extracted ${readability.textContent.length} chars from "${readability.title}"`);
        const matcher = new EntityMatcher();
        const discovered = matcher.discoverEntities(readability.textContent, debug);
        knownEntities = discovered.entities;
        readabilityDebug = {
          status: 'active',
          title: readability.title,
          textLength: readability.textContent.length,
          entitiesFound: discovered.entities.size,
          debugData: discovered.debugData,
        };
        console.log(`Readability: discovered ${discovered.entities.size} entities`);
      } else {
        console.log('Readability: not readerable, using fallback pipeline');
        readabilityDebug = { status: 'skipped' };
      }

      // Inject wikilinks
      const injectionResult = injectWikilinks(processedHtml, articleSelector, null, debug, knownEntities);
      if (debug) {
        processedHtml = injectionResult.html;
        debugInfo = injectionResult.debugInfo;
        debugInfo.readability = readabilityDebug;
      } else {
        processedHtml = injectionResult.html;
      }
      readabilityDebug.linked = injectionResult.stats.linked;

      // Log matches for daily digest
      logMatches(injectionResult.matchLog, targetUrl);
    }

    // Rewrite links for proxy navigation
    processedHtml = rewriteLinks(processedHtml, targetUrl, PROXY_PATH, debug);
    processedHtml = rewriteResourceUrls(processedHtml, targetUrl);

    // Inject header
    const root = parse(processedHtml);
    const head = root.querySelector('head');
    const body = root.querySelector('body');

    if (head) {
      head.insertAdjacentHTML('beforeend', '<meta name="robots" content="noindex, nofollow">');
      head.insertAdjacentHTML('beforeend', getHeaderStyles());
    }

    if (body) {
      const headerOptions = { isUnsupported, debug, status: readabilityDebug };
      if (debugInfo) {
        headerOptions.extraHtml = generateDebugPanel(debugInfo);
      }
      body.insertAdjacentHTML('afterbegin', generateHeader(targetUrl, PROXY_PATH, headerOptions));
    }

    processedHtml = root.toString();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(processedHtml);

  } catch (error) {
    console.error('Proxy error:', error);

    let title = 'Error';
    let message = error.message;
    let status = 500;

    if (error.message.includes('blocked')) {
      title = 'URL Blocked';
      status = 403;
    } else if (error.message.includes('too large')) {
      title = 'Page Too Large';
      status = 413;
    } else if (error.message.includes('timeout') || error.name === 'AbortError') {
      title = 'Timeout';
      message = 'The site took too long to respond.';
      status = 504;
    } else if (error.message.includes('HTTP')) {
      title = 'Fetch Failed';
      status = 502;
    }

    res.status(status).send(getErrorPage(title, message, targetUrl));
  }
});

function getLandingPage() {
  // Build site options from sites.json
  const siteOptions = Object.values(sites)
    .map(s => `          <option value="${escapeHtml(s.homepageUrl)}">${escapeHtml(s.name)}</option>`)
    .join('\n');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Wikilinker</title>
      <meta name="description" content="Auto-links people, places, and organizations to Wikipedia in news articles from ${siteNames}.">
      <meta property="og:title" content="Wikilinker">
      <meta property="og:description" content="Auto-links people, places, and organizations to Wikipedia in news articles.">
      <meta property="og:url" content="https://whitelabel.org${PROXY_PATH}">
      <meta property="og:type" content="website">
      <link rel="canonical" href="https://whitelabel.org${PROXY_PATH}">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          max-width: 600px;
          margin: 100px auto;
          padding: 20px;
          text-align: center;
        }
        h1 { margin-bottom: 10px; }
        .brand {
          text-decoration: underline;
          background-color: rgba(52, 168, 83, 0.12);
          padding: 2px 6px;
          border-radius: 3px;
        }
        p { color: #666; margin-bottom: 30px; }
        button {
          padding: 12px 24px;
          font-size: 16px;
          background: #6366f1;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
        button:hover { background: #4f46e5; }
        .site-picker {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .site-picker label {
          font-size: 14px;
          color: #374151;
          font-weight: 500;
        }
        .site-picker select {
          padding: 12px 16px;
          font-size: 16px;
          border: 2px solid #ddd;
          border-radius: 6px;
          background: white;
          cursor: pointer;
        }
        .site-picker select:focus {
          outline: none;
          border-color: #6366f1;
        }
        .about { display: block; margin-top: 20px; color: #6366f1; font-size: 14px; }
      </style>
    </head>
    <body>
      <h1><span class="brand">Wikilinker</span></h1>
      <p>Auto-links people, places, and organizations to Wikipedia in news articles</p>

      <div class="site-picker">
        <label for="site-select">Pick a site:</label>
        <select id="site-select">
${siteOptions}
        </select>
        <button type="button" onclick="window.location='${PROXY_PATH}?url='+encodeURIComponent(document.getElementById('site-select').value)">Go</button>
      </div>
      <a class="about" href="${PROXY_PATH}/about">About</a>
    </body>
    </html>
  `;
}

function getAboutPage() {
  const md = readFileSync(join(__dirname, 'static', 'about.md'), 'utf-8');
  const html = renderMarkdown(md)
    .replace(/Wikilinker/g, '<span class="brand">Wikilinker</span>');
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>About - Wikilinker</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          max-width: 640px;
          margin: 60px auto;
          padding: 20px;
          line-height: 1.6;
          color: #1a1a1a;
        }
        h1 { margin-bottom: 6px; }
        h1 + p { color: #666; margin-top: 0; margin-bottom: 30px; }
        h2 { margin-top: 32px; font-size: 20px; }
        p { margin-bottom: 16px; }
        a { color: #6366f1; }
        a:hover { text-decoration: none; }
        ol { padding-left: 20px; }
        li { margin-bottom: 8px; }
        .brand {
          text-decoration: underline;
          background-color: rgba(52, 168, 83, 0.12);
          padding: 2px 6px;
          border-radius: 3px;
        }
        .back {
          display: inline-block;
          margin-top: 30px;
          padding: 10px 20px;
          background: #6366f1;
          color: white;
          text-decoration: none;
          border-radius: 6px;
        }
        .back:hover { background: #4f46e5; }
      </style>
    </head>
    <body>
      ${html}
      <a class="back" href="${PROXY_PATH}">Try <span class="brand">Wikilinker</span></a>
    </body>
    </html>
  `;
}

/**
 * Minimal markdown to HTML renderer — handles the subset used in about.md.
 */
function renderMarkdown(md) {
  const lines = md.split('\n');
  let html = '';
  let inOl = false;
  let inUl = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Headings
    if (line.startsWith('## ')) {
      if (inOl) { html += '</ol>\n'; inOl = false; }
      if (inUl) { html += '</ul>\n'; inUl = false; }
      html += `<h2>${inlineMarkdown(line.slice(3))}</h2>\n`;
      continue;
    }
    if (line.startsWith('# ')) {
      if (inOl) { html += '</ol>\n'; inOl = false; }
      if (inUl) { html += '</ul>\n'; inUl = false; }
      html += `<h1>${inlineMarkdown(line.slice(2))}</h1>\n`;
      continue;
    }

    // Ordered list items
    const olMatch = line.match(/^\d+\.\s+(.*)/);
    if (olMatch) {
      if (inUl) { html += '</ul>\n'; inUl = false; }
      if (!inOl) { html += '<ol>\n'; inOl = true; }
      html += `  <li>${inlineMarkdown(olMatch[1])}</li>\n`;
      continue;
    }

    // Unordered list items
    const ulMatch = line.match(/^- (.*)/);
    if (ulMatch) {
      if (inOl) { html += '</ol>\n'; inOl = false; }
      if (!inUl) { html += '<ul>\n'; inUl = true; }
      html += `  <li>${inlineMarkdown(ulMatch[1])}</li>\n`;
      continue;
    }

    // Close lists if we hit a non-list line
    if (inOl) { html += '</ol>\n'; inOl = false; }
    if (inUl) { html += '</ul>\n'; inUl = false; }

    // Blank lines
    if (line.trim() === '') continue;

    // Paragraph
    html += `<p>${inlineMarkdown(line)}</p>\n`;
  }

  if (inOl) html += '</ol>\n';
  if (inUl) html += '</ul>\n';
  return html;
}

function inlineMarkdown(text) {
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Em dashes
  text = text.replace(/ — /g, ' &mdash; ');
  return text;
}

function getErrorPage(title, message, url) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${escapeHtml(title)} - Wikilinker</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          max-width: 600px;
          margin: 100px auto;
          padding: 20px;
          text-align: center;
        }
        h1 { color: #dc2626; margin-bottom: 10px; }
        p { color: #666; margin-bottom: 20px; }
        code {
          display: block;
          padding: 10px;
          background: #f3f4f6;
          border-radius: 6px;
          word-break: break-all;
          margin-bottom: 30px;
        }
        a {
          display: inline-block;
          padding: 12px 24px;
          background: #6366f1;
          color: white;
          text-decoration: none;
          border-radius: 6px;
        }
        a:hover { background: #4f46e5; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(title)}</h1>
      <p>${message}</p>
      ${url ? `<code>${escapeHtml(url)}</code>` : ''}
      <a href="${PROXY_PATH}">Try another URL</a>
    </body>
    </html>
  `;
}

// About page
app.get(`${PROXY_PATH}/about`, (req, res) => {
  res.send(getAboutPage());
});

// Start server
app.listen(PORT, () => {
  console.log(`Wikilinker server running on port ${PORT}`);
  console.log(`Proxy available at http://localhost:${PORT}${PROXY_PATH}`);
});
