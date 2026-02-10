// wikilinker/lib/sanitizer.js
//
// HTML sanitization using DOMPurify. Strips dangerous tags and attributes
// (scripts, event handlers, etc.) while preserving page structure, text,
// media, and forms. Also provides security response headers (CSP, etc.).
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

// Create a DOMPurify instance with jsdom
const window = new JSDOM('').window;
const purify = DOMPurify(window);

// Configure DOMPurify
const PURIFY_CONFIG = {
  WHOLE_DOCUMENT: true, // Preserve html/head/body structure for header injection
  ALLOWED_TAGS: [
    'html', 'head', 'title', 'meta', 'link', 'body',
    'div', 'span', 'article', 'section', 'main', 'aside', 'header', 'footer', 'nav',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'a', 'img', 'figure', 'figcaption', 'picture', 'source',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
    'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup',
    'blockquote', 'q', 'cite', 'code', 'pre', 'kbd', 'samp',
    'time', 'mark', 'small', 'abbr', 'address',
    'form', 'input', 'button', 'select', 'option', 'textarea', 'label',
    'video', 'audio', 'track',
    'style', // Allow style tags but sanitize content
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'id', 'name',
    'width', 'height', 'style',
    'type', 'value', 'placeholder', 'disabled', 'readonly',
    'data-*', 'aria-*', 'role',
    'datetime', 'cite', 'lang', 'dir',
    'srcset', 'sizes', 'loading', 'decoding',
    'controls', 'autoplay', 'loop', 'muted', 'poster',
    'rel', 'target', 'download',
    'colspan', 'rowspan', 'scope', 'headers',
    'content', 'charset', 'http-equiv', 'property',
  ],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'noscript'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  ALLOW_DATA_ATTR: true,
  ALLOW_ARIA_ATTR: true,
};

export function sanitizeHtml(html) {
  // First pass: DOMPurify
  let clean = purify.sanitize(html, PURIFY_CONFIG);

  // Second pass: Remove any remaining javascript: URLs
  clean = clean.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');

  // Remove any inline event handlers that might have slipped through
  clean = clean.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');

  return clean;
}

export function getSecurityHeaders() {
  return {
    // Allow external stylesheets and fonts (required for proxied content)
    // but keep scripts blocked for security
    'Content-Security-Policy': "default-src 'self'; script-src 'none'; frame-ancestors 'none'; img-src * data: blob:; style-src * 'unsafe-inline'; font-src * data:; media-src *;",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow',
  };
}
