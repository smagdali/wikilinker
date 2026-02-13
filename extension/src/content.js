// extension/src/content.js
//
// Content script injected into news pages. Walks the live DOM,
// finds entity names using shared matching logic, and wraps them
// in Wikipedia links using browser-native DOM APIs.

import { shouldSkipElement } from '../../server/shared/skip-rules.js';
import {
  findMatches, extractCandidates, escapeRegExp,
  isSentenceStart, isPartOfLargerPhrase, toWikiUrl,
} from '../../server/shared/matcher-core.js';
import sites from '../../server/shared/sites.json';

// Tags allowed inside article containers (content, not nav)
const ALLOW_INSIDE_ARTICLE = new Set(['LI', 'TH', 'TD']);

let entitySet = null;   // Set of entity names
let settings = {};

// ── Initialisation ──────────────────────────────────────────

async function init() {
  // Guard against double-init when both static and dynamic content scripts fire
  if (window.__wikilinkerInit) return;
  window.__wikilinkerInit = true;

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

function isSupportedSite() {
  const hostname = location.hostname.replace(/^www\./, '');
  return !!(sites[hostname] ||
    Object.entries(sites).find(([domain]) =>
      hostname === domain || hostname.endsWith('.' + domain)
    )?.[1]);
}

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

  DEBUG: {
    const allText = containers.map(c => c.textContent).join('\n');
    const candidates = extractCandidates(allText);
    const lines = [];

    // Classify candidate type
    const ruleOf = (c) => {
      if (c.includes(' ')) return 'multi-word';
      if (/^[A-Z]+$/.test(c)) return 'acronym';
      return 'single-word';
    };

    // Get context: 10 chars either side with the candidate in brackets
    const contextOf = (text, candidate) => {
      const re = new RegExp(`\\b${escapeRegExp(candidate)}\\b`);
      const m = re.exec(text);
      if (!m) return `[${candidate}]`;
      const start = Math.max(0, m.index - 10);
      const end = Math.min(text.length, m.index + candidate.length + 10);
      const before = text.slice(start, m.index).replace(/\n/g, ' ');
      const after = text.slice(m.index + candidate.length, end).replace(/\n/g, ' ');
      return `${start > 0 ? '...' : ''}${before}[${candidate}]${after}${end < text.length ? '...' : ''}`;
    };

    // Track used ranges for overlap detection (mirroring matcher logic)
    const matched = [];
    for (const c of candidates) {
      if (entitySet.has(c)) matched.push(c);
    }
    matched.sort((a, b) => b.length - a.length);
    const usedRanges = [];

    for (const c of matched) {
      const re = new RegExp(`\\b${escapeRegExp(c)}\\b`);
      const found = re.exec(allText);
      if (!found) continue;
      const start = found.index;
      const end = start + c.length;
      const overlaps = usedRanges.some(([s, e]) =>
        (start >= s && start < e) || (end > s && end <= e) || (start <= s && end >= e));
      let status;
      if (overlaps) {
        status = 'overlapped';
      } else if (isSentenceStart(allText, start)) {
        status = 'sentence-start';
      } else if (isPartOfLargerPhrase(allText, start, end)) {
        status = 'part-of-larger';
      } else if (linkedEntities.has(c)) {
        status = 'linked';
        usedRanges.push([start, end]);
      } else {
        status = 'matched';
        usedRanges.push([start, end]);
      }
      lines.push(`${contextOf(allText, c)}\t${c}\t${ruleOf(c)}\t${status}`);
    }

    // Unmatched candidates
    for (const c of [...candidates].filter(c => !entitySet.has(c)).sort()) {
      lines.push(`${contextOf(allText, c)}\t${c}\t${ruleOf(c)}\tnot-in-db`);
    }

    const header = `context\tcandidate\trule\tstatus`;
    const report = [
      `# Wikilinker debug: ${location.href}`,
      `# Containers: ${containers.length}, Text: ${allText.length} chars, Linked: ${linkCount}`,
      header,
      ...lines,
    ].join('\n');

    console.log(report);

    const slug = location.hostname.replace(/\./g, '-');
    const blob = new Blob([report], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wikilinker-debug-${slug}.tsv`;
    a.click();
    URL.revokeObjectURL(a.href);
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
    if (settings.enabled !== false && (isSupportedSite() || settings.allSites)) {
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
