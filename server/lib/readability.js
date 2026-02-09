// wikilinker/lib/readability.js
//
// Wraps Mozilla's Readability library to extract clean article text from
// raw HTML. Used to discover entities in prose before injecting wikilinks
// into the full page. Returns plain text (not HTML) to avoid mutation issues.
import { JSDOM } from 'jsdom';
import { Readability, isProbablyReaderable } from '@mozilla/readability';

/**
 * Extract article text using Mozilla Readability.
 * Runs on raw HTML (before sanitization) so Readability can use
 * original class names for its scoring heuristics.
 * We only extract textContent (plain text), never serve Readability's HTML.
 */
export function extractWithReadability(html, url) {
  try {
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    if (!isProbablyReaderable(doc)) {
      return { textContent: null, title: null, isReaderable: false };
    }

    // Readability mutates the DOM, so parse a fresh copy
    const dom2 = new JSDOM(html, { url });
    const reader = new Readability(dom2.window.document);
    const article = reader.parse();

    if (!article || !article.textContent) {
      return { textContent: null, title: null, isReaderable: false };
    }

    return {
      textContent: article.textContent,
      title: article.title,
      isReaderable: true,
    };
  } catch (err) {
    console.error('Readability extraction failed:', err.message);
    return { textContent: null, title: null, isReaderable: false };
  }
}
