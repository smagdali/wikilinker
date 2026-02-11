// extension/src/content.js
//
// Content script injected into news pages. Walks the live DOM,
// finds entity names using shared matching logic, and wraps them
// in Wikipedia links using browser-native DOM APIs.

import { shouldSkipElement } from '../../server/shared/skip-rules.js';
import { findMatches, toWikiUrl } from '../../server/shared/matcher-core.js';
import sites from '../../server/shared/sites.json';

// Tags allowed inside article containers (content, not nav)
const ALLOW_INSIDE_ARTICLE = new Set(['LI', 'TH', 'TD']);

let entitySet = null;   // Set of entity names
let settings = {};

// ── Initialisation ──────────────────────────────────────────

async function init() {
  try {
    const [entityResponse, settingsResponse] = await Promise.all([
      chrome.runtime.sendMessage({ type: 'getEntities' }),
      chrome.runtime.sendMessage({ type: 'getSettings' }),
    ]);

    entitySet = new Set(entityResponse.set);
    settings = settingsResponse || {};

    if (settings.enabled === false) return;

    processPage();
  } catch (err) {
    console.error('Wikilinker: init failed', err);
  }
}

// ── Article detection ───────────────────────────────────────

function findArticleContainers() {
  // Try site-specific selectors from shared config
  const hostname = location.hostname.replace(/^www\./, '');
  const siteConfig = sites[hostname] ||
    Object.entries(sites).find(([domain]) =>
      hostname === domain || hostname.endsWith('.' + domain)
    )?.[1];

  if (siteConfig?.articleSelector) {
    const selectors = siteConfig.articleSelector.split(',').map(s => s.trim());
    for (const sel of selectors) {
      const elements = document.querySelectorAll(sel);
      if (elements.length > 0) return Array.from(elements);
    }
  }

  // Fallback: common article containers
  const fallbacks = [
    'article', '[role="article"]', '.article-body', '.article__body',
    '.story-body', 'main',
  ];
  for (const sel of fallbacks) {
    const elements = document.querySelectorAll(sel);
    if (elements.length > 0) return Array.from(elements);
  }

  return [];
}

// ── DOM walking ─────────────────────────────────────────────

function processPage() {
  const containers = findArticleContainers();
  if (containers.length === 0) return;

  const linkedEntities = new Set();
  let linkCount = 0;

  for (const container of containers) {
    linkCount += walkAndProcess(container, linkedEntities, false, true);
  }

  // Update badge
  if (linkCount > 0) {
    chrome.runtime.sendMessage({ type: 'setBadge', count: linkCount });
  }
}

function walkAndProcess(element, linkedEntities, insideLink = false, isRoot = false) {
  if (!element) return 0;
  let count = 0;

  // Skip check (but not for the root article container)
  if (!isRoot && element.nodeType === Node.ELEMENT_NODE) {
    const tag = element.tagName?.toUpperCase();
    const insideArticle = true; // we're always inside an article container
    const allowedInArticle = insideArticle && ALLOW_INSIDE_ARTICLE.has(tag);

    if (!allowedInArticle && shouldSkipElement(
      element,
      (el, sel) => !!el.closest?.(sel),
      (el) => el.className || ''
    )) {
      return 0;
    }
  }

  // Skip wikilinks we've already created
  if (element.classList?.contains('wikilink')) return 0;

  const isLink = element.tagName?.toUpperCase() === 'A';
  const nowInsideLink = insideLink || isLink;

  // Snapshot children (DOM will mutate during text replacement)
  const children = Array.from(element.childNodes);

  for (const node of children) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (nowInsideLink) continue;

      const text = node.textContent;
      if (text.trim().length < 3) continue;

      const matches = findMatches(text, entitySet);
      if (matches.length === 0) continue;

      count += replaceTextNode(node, text, matches, linkedEntities);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      count += walkAndProcess(node, linkedEntities, nowInsideLink, false);
    }
  }

  return count;
}

// ── Text node replacement ───────────────────────────────────

function replaceTextNode(textNode, text, matches, linkedEntities) {
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  let count = 0;

  for (const match of matches) {
    // First occurrence only
    if (linkedEntities.has(match.text)) continue;

    // Add text before this match
    if (match.index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    // Create the wikilink
    fragment.appendChild(createWikiLink(match.text));
    lastIndex = match.index + match.text.length;
    linkedEntities.add(match.text);
    count++;
  }

  if (count === 0) return 0;

  // Add remaining text
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  textNode.parentNode.replaceChild(fragment, textNode);
  return count;
}

function createWikiLink(entityName) {
  const link = document.createElement('a');
  link.href = toWikiUrl(entityName);
  link.className = 'wikilink';
  link.title = `${entityName} — Wikipedia`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.appendChild(document.createTextNode(entityName));
  return link;
}

// ── Settings change listener ────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'settingsChanged') {
    settings = message.settings;
    // Remove existing wikilinks and re-process
    document.querySelectorAll('.wikilink').forEach(link => {
      const text = document.createTextNode(link.textContent);
      link.parentNode.replaceChild(text, link);
    });
    if (settings.enabled !== false) {
      processPage();
    }
  }
});

// ── Start ───────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
