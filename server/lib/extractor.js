// wikilinker/lib/extractor.js
//
// Loads site configuration from data/sites.json and provides lookup by
// hostname. Each site entry defines a CSS articleSelector used to find
// the main content area, plus a display name and homepage URL for the UI.
import { parse } from 'node-html-parser';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sitesPath = join(__dirname, '..', 'shared', 'sites.json');

let sites = null;

function loadSites() {
  if (!sites) {
    sites = JSON.parse(readFileSync(sitesPath, 'utf8'));
  }
  return sites;
}

export function getSiteConfig(urlString) {
  const sites = loadSites();

  try {
    const url = new URL(urlString);
    const hostname = url.hostname.replace(/^www\./, '');

    // Check exact match first
    if (sites[hostname]) {
      return sites[hostname];
    }

    // Check if hostname ends with any known domain
    for (const [domain, config] of Object.entries(sites)) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return config;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export function getAllSites() {
  return loadSites();
}

export function extractArticleBody(html, selector) {
  const root = parse(html);

  if (selector) {
    // Try each selector (comma-separated)
    const selectors = selector.split(',').map(s => s.trim());

    for (const sel of selectors) {
      const elements = root.querySelectorAll(sel);
      if (elements.length > 0) {
        return elements.map(el => el.outerHTML).join('\n');
      }
    }
  }

  // Fallback: return body content
  const body = root.querySelector('body');
  return body ? body.innerHTML : html;
}

export function getArticleElements(html, selector) {
  const root = parse(html);

  if (selector) {
    const selectors = selector.split(',').map(s => s.trim());

    for (const sel of selectors) {
      const elements = root.querySelectorAll(sel);
      if (elements.length > 0) {
        return { root, elements, selector: sel };
      }
    }
  }

  // Fallback
  const body = root.querySelector('body');
  return { root, elements: body ? [body] : [], selector: 'body' };
}
