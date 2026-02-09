// wikilinker/lib/injector.js
//
// Core wikilink injection. Walks the DOM tree of a fetched page, finds
// entity names in text nodes using EntityMatcher, and wraps the first
// occurrence of each entity in a Wikipedia link. Respects skip rules
// for navigation, headings, captions, and other non-article elements.
import { parse } from 'node-html-parser';
import { EntityMatcher } from './matcher.js';
import { shouldSkipElement } from '../shared/skip-rules.js';
import { toWikiUrl, extractContext } from '../shared/matcher-core.js';

// Adapter for node-html-parser's closest() method
function closestAdapter(element, selector) {
  try {
    return !!element?.closest?.(selector);
  } catch {
    return false;
  }
}

// Adapter for getting class attribute
function getClassAdapter(element) {
  return element?.getAttribute?.('class') || '';
}

export function injectWikilinks(html, articleSelector, entities = null, debug = false, knownEntities = null) {
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

  // Track entities that have been linked (for first-occurrence-only rule)
  const linkedEntities = new Set();

  const debugInfo = debug ? {
    allCandidates: new Set(),
    matched: [],
    skippedNoMatch: [],
    skippedOverlap: [],
    skippedPartOfLarger: [],
    skippedSentenceStart: [],
    skippedAlreadyLinked: [],
  } : null;

  // Collect match log entries (always, for daily digest)
  const matchLog = [];

  // Process each content element
  // insideArticle=true so we don't skip the article container itself or its
  // LI/TH/TD children (which are content in articles, but nav elsewhere)
  for (const element of contentElements) {
    processElement(element, matcher, false, linkedEntities, debug, debugInfo, knownEntities, true, true, matchLog);
  }

  const resultHtml = root.toString();
  const stats = { linked: linkedEntities.size };

  if (debug) {
    return {
      html: resultHtml,
      stats,
      matchLog,
      debugInfo: {
        allCandidates: [...debugInfo.allCandidates],
        matched: debugInfo.matched,
        skippedNoMatch: [...new Set(debugInfo.skippedNoMatch)],
        skippedOverlap: debugInfo.skippedOverlap,
        skippedPartOfLarger: debugInfo.skippedPartOfLarger,
        skippedAlreadyLinked: debugInfo.skippedAlreadyLinked,
      },
    };
  }
  return { html: resultHtml, stats, matchLog };
}

// Tags that are skipped globally but allowed inside the article container,
// where they often hold real content (e.g. liveblog updates in <li>, data tables).
const ALLOW_INSIDE_ARTICLE = new Set(['LI', 'TH', 'TD']);

function processElement(element, matcher, insideLink = false, linkedEntities = new Set(), debug = false, debugInfo = null, knownEntities = null, isRoot = false, insideArticle = false, matchLog = null) {
  if (!element) return;

  // Use shared skip rules — but never skip the root article container itself,
  // only its children. The container is explicitly selected via site config,
  // and its classes (e.g. "heading-tag-switch") may match skip patterns.
  // Inside the article container, LI/TH/TD are allowed — they hold real
  // content (e.g. liveblog updates, data tables), unlike nav/teaser lists.
  if (!isRoot) {
    const tag = element.tagName?.toUpperCase();
    const allowedInArticle = insideArticle && ALLOW_INSIDE_ARTICLE.has(tag);
    if (!allowedInArticle && shouldSkipElement(element, closestAdapter, getClassAdapter)) {
      return;
    }
  }

  // Skip if already a wikilink
  if (element.classNames?.includes('wikilink')) {
    return;
  }

  const tagName = element.tagName?.toUpperCase();

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

      let matches;
      if (knownEntities) {
        // Readability pipeline: search for pre-discovered entities
        matches = matcher.findMatchesInText(text, knownEntities);
      } else {
        // Fallback pipeline: full candidate extraction per text node
        matches = matcher.findMatches(text, debug);

        // Collect debug data from matcher
        if (debug && matches._debug) {
          for (const c of matches._debug.candidates) {
            debugInfo.allCandidates.add(c);
          }
          debugInfo.skippedNoMatch.push(...matches._debug.unmatched);
          debugInfo.skippedOverlap.push(...matches._debug.overlapped);
          debugInfo.skippedPartOfLarger.push(...matches._debug.partOfLarger);
          debugInfo.skippedSentenceStart.push(...matches._debug.sentenceStart);
        }
      }

      if (matches.length === 0) continue;

      // Build replacement HTML
      let newHtml = '';
      let lastIndex = 0;

      for (const match of matches) {
        // Skip if this entity was already linked (first occurrence only)
        if (linkedEntities.has(match.text)) {
          if (debugInfo) {
            debugInfo.skippedAlreadyLinked.push({ text: match.text });
          }
          continue;
        }

        // Add text before this match
        if (match.index > lastIndex) {
          newHtml += escapeHtml(text.slice(lastIndex, match.index));
        }

        // Add the wikilink
        const wikiUrl = toWikiUrl(match.text);
        newHtml += `<a href="${wikiUrl}" class="wikilink" title="${match.text}">${escapeHtml(match.text)}</a>`;

        lastIndex = match.index + match.text.length;

        // Mark this entity as linked
        linkedEntities.add(match.text);

        // Record for match log
        if (matchLog) {
          matchLog.push({
            text: match.text,
            wikiUrl,
            context: extractContext(text, match.index, match.text.length),
          });
        }

        if (debugInfo) {
          debugInfo.matched.push({ text: match.text });
        }
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
      processElement(node, matcher, nowInsideLink, linkedEntities, debug, debugInfo, knownEntities, false, insideArticle, matchLog);
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
