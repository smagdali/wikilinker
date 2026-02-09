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
  // Headlines - these are navigation, not body text
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  // Code/preformatted
  'CODE', 'PRE', 'KBD', 'SAMP',
  // Media/embedded
  'SVG', 'MATH', 'IFRAME', 'OBJECT', 'EMBED', 'CANVAS',
  // Document structure (non-content)
  'HEAD', 'TITLE', 'META', 'LINK',
  // Figure captions - usually photo credits/descriptions
  'FIGCAPTION',
  // List elements - in news sites, lists are usually navigation/teasers
  'LI',
  // Table elements - usually data, not article text
  'TH', 'TD',
]);

export const SKIP_SELECTORS = [
  // ARIA roles
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="complementary"]',
  '[role="search"]',
  '[role="menu"]',
  '[role="menubar"]',
  '[role="toolbar"]',
  '[role="button"]',
  '[aria-hidden="true"]',
  // Data attributes
  '[data-component="nav"]',
  '[data-component="navigation"]',
  '[data-component="header"]',
  '[data-testid="promo"]',
  '[data-testid="card"]',
  // Commerce/shopping sections
  '[data-commerce]',
  '[data-affiliate]',
];

// Class patterns that indicate non-article content
// These are checked via substring matching for flexibility
export const SKIP_CLASS_PATTERNS = [
  // Navigation/menus
  'menu', 'nav-', '-nav',
  // Headlines/titles (when not skipped by tag)
  'headline', 'title', 'heading',
  // Teasers/decks/leads
  'teaser', 'dek', 'lede', 'leadin', 'lead-in', 'standfirst', 'summary', 'excerpt',
  // Cards/promos
  'card', 'promo', 'tout', 'featured', 'spotlight',
  // Credits/captions
  'credit', 'caption', 'byline', 'author', 'source',
  // Interactive/widgets
  'widget', 'embed', 'video-', '-video', 'interactive',
  // Note: 'module' removed - too broad, matches CSS Modules class names (e.g. article-body-module__wrapper)
  // Item listings
  'item-info', 'item-image', 'list-item',
  // Common grid/layout patterns that aren't article body
  'rail', 'sidebar', 'related',
  // Note: 'grid' removed - too broad, matches CSS Grid layout classes (e.g. container--grid)
  // Intro/outro sections
  'intro', 'outro', 'leadin', 'g-intro', 'g-leadin',
  // Commerce/shopping content (affiliate links, product listings)
  'commerce', 'shopping', 'buyline', 'affiliate', 'product',
  // Structured data
  'speakable', 'schema', 'ld-json',
];

/**
 * Check if element has a class matching skip patterns.
 * Only checks the element itself, not ancestors — ancestor checking was too
 * aggressive and caused article body content to be skipped when a distant
 * ancestor had layout classes like "grid" or "module".
 *
 * @param {Object} element - DOM element
 * @param {Function} getClassFn - Function(element) => string (class attribute value)
 * @returns {boolean}
 */
function hasSkipClassPattern(element, getClassFn) {
  const className = getClassFn(element);
  if (className) {
    const classLower = className.toLowerCase();
    for (const pattern of SKIP_CLASS_PATTERNS) {
      if (classLower.includes(pattern)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Determine if an element should be skipped for wikilink injection.
 *
 * @param {Object} element - DOM element (or node-html-parser element)
 * @param {Function} closestFn - Function(element, selector) => boolean
 * @param {Function} [getClassFn] - Function(element) => string (optional, for class pattern checking)
 * @returns {boolean} - true if element should be skipped
 */
export function shouldSkipElement(element, closestFn, getClassFn) {
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

    // Skip by class patterns (if getClassFn provided)
    if (getClassFn && hasSkipClassPattern(element, getClassFn)) {
      return true;
    }

    return false;
  } catch {
    // Defensive: on any error, skip the element
    return true;
  }
}
