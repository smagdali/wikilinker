# Wikilinker Testing & Refinement Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Systematically identify and fix incorrect wikilink placement across all supported news sites through iterative testing with regression detection.

**Architecture:** Sample 480 pages (20 per site), detect links outside articleSelector as errors, cluster by CSS path, fix with generic rules, verify no regressions.

**Tech Stack:** Node.js test runner, Puppeteer for screenshots, shared skip-rules module portable to Chrome extension.

---

## Problem Statement

Wikilinks are being injected into navigation, headlines, and card text - not just article body text. Sites like The Guardian use CSS overlay links where text appears clickable but isn't technically inside `<a>` tags, causing our "skip links" logic to miss these cases.

## Design Principles

1. **Defensive** - When uncertain, don't link. Better to miss a valid entity than create broken UX.
2. **Generic rules only** - No site-specific special cases. Find universal patterns that work everywhere.
3. **Portable** - Final algorithm must work identically in Node.js server and Chrome extension.
4. **Iterative** - Fix patterns, check for regressions, repeat until clean.

---

## Test Infrastructure

### Directory Structure

```
wikilinker/
├── test-suite/
│   ├── sampler.js        # Discovers and selects 20 pages per site
│   ├── runner.js         # Fetches pages, processes, compares
│   ├── analyzer.js       # Clusters errors by selector path
│   ├── reporter.js       # Generates summary + regression reports
│   ├── screenshotter.js  # Puppeteer captures before/after
│   ├── pages.json        # Cached list of URLs to test
│   └── rounds/
│       ├── results.json      # Current round results
│       ├── summary.json      # Aggregated stats
│       ├── regression.json   # Comparison to previous round
│       └── screenshots/      # Flat folder with named PNGs
└── shared/
    └── skip-rules.js     # Portable skip logic
```

### Page Sampling

Per site (24 sites total = 480 pages):
- 1 homepage
- 2 category/section pages
- 17 article pages

The `sampler.js` crawls each site starting from homepage, follows internal links, classifies pages by type, and builds `pages.json`.

---

## Correctness Detection

### Per-Page Result Format

```javascript
{
  url: "https://www.theguardian.com/...",
  pageType: "article",           // homepage | category | article
  site: "guardian",
  articleSelector: "article[data-gu-name='body']",
  wikilinks: [
    {
      entity: "Prince Harry",
      wikidataId: "Q152316",
      type: "person",
      isCorrect: true,           // Inside articleSelector
      selectorPath: "article > div > p",
      textContext: "...said Prince Harry in a statement..."
    },
    {
      entity: "Sport",
      wikidataId: "Q21661612",
      type: "company",
      isCorrect: false,          // Outside articleSelector
      selectorPath: "nav > ul > li > label",
      textContext: "Sport"
    }
  ],
  stats: {
    correct: 12,
    incorrect: 3
  }
}
```

### Wikilink Matching Across Rounds

A wikilink is "the same" across runs if:
- Links to the same Wikipedia article (same wikidataId)
- Appears in similar text context (surrounding words match)

This handles minor DOM structure changes between fetches.

---

## Error Clustering

The `analyzer.js` groups incorrect links by CSS selector path patterns:

```
Pattern Analysis (Round 0):
─────────────────────────────────────────
nav *                    → 847 incorrect links across 18 sites
header *                 → 234 incorrect links across 12 sites
[role="navigation"] *    → 156 incorrect links across 14 sites
aside *                  → 89 incorrect links across 8 sites
footer *                 → 67 incorrect links across 11 sites
button                   → 45 incorrect links across 6 sites
label                    → 34 incorrect links across 4 sites
─────────────────────────────────────────
```

This identifies which generic rules to add (e.g., skip all `nav` descendants).

---

## Iterative Fix Process

### Workflow

1. **Run tests** → `npm run test-suite -- --round=N`
2. **Review clusters** → Analyzer shows top patterns causing incorrect links
3. **Add generic rule** → e.g., add `'NAV'` to `SKIP_TAGS`
4. **Re-run tests** → Compare round N+1 to round N
5. **Check regression report**
6. **Iterate** until incorrect count is acceptable and regressions are zero

### Regression Report Format

```
Round 1 vs Round 0:
═══════════════════════════════════════════════════
✅ Fixed:      847 links (nav descendants now skipped)
✅ Fixed:      234 links (header descendants now skipped)
❌ Regression:   3 links (false positives - valid article nav)
⚪ Unchanged: 12,847 correct, 156 incorrect
═══════════════════════════════════════════════════
Net improvement: +1,078 links fixed, -3 regressions
```

---

## Defensive Skip Rules

### Shared Module (Portable)

```javascript
// shared/skip-rules.js
export const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'A', 'CODE', 'PRE',
  'NAV', 'HEADER', 'FOOTER', 'ASIDE', 'SVG', 'BUTTON',
  'INPUT', 'TEXTAREA', 'SELECT', 'LABEL',
  // Extended from test findings...
]);

export const SKIP_SELECTORS = [
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[aria-hidden="true"]',
  // Extended from test findings...
];

export function shouldSkipElement(element, closestFn) {
  try {
    const tagName = element.tagName?.toUpperCase();
    if (SKIP_TAGS.has(tagName)) return true;

    for (const sel of SKIP_SELECTORS) {
      if (closestFn(element, sel)) return true;
    }
    return false;
  } catch {
    return true; // Defensive: error = don't link
  }
}
```

### Server Adapter

```javascript
import { shouldSkipElement } from '../shared/skip-rules.js';

function processElement(element, matcher, insideLink = false) {
  const closestFn = (el, sel) => !!el.closest?.(sel);
  if (shouldSkipElement(element, closestFn)) return;
  // ... rest of processing
}
```

### Chrome Extension Adapter

```javascript
import { shouldSkipElement } from './skip-rules.js';

function processTextNode(node) {
  const closestFn = (el, sel) => !!el.closest(sel);
  if (shouldSkipElement(node.parentElement, closestFn)) return;
  // ... rest of processing
}
```

---

## Styling

Wikilinks inherit source text styling, only adding link-specific properties:

```css
.wikilink {
  /* Inherit everything from parent */
  font: inherit;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  letter-spacing: inherit;

  /* Only override link-specific properties */
  color: var(--wikilink-color, #2563eb);
  text-decoration: none;
}

.wikilink:hover {
  text-decoration: underline;
}

.wikilink-icon {
  margin-right: 0.15em;
}

/* Type-specific colors (colorblind-friendly) */
.wikilink-person { color: #2563eb; }  /* Blue */
.wikilink-place  { color: #ea580c; }  /* Orange */
.wikilink-org    { color: #7c3aed; }  /* Purple */
.wikilink-company { color: #0d9488; } /* Teal */
```

---

## Screenshots

### Selection

After round 0, identify 2-3 worst pages per site (most incorrect links). These become the fixed sample set tracked through all rounds.

### Storage

Flat folder with descriptive filenames:

```
rounds/screenshots/
├── guardian-article-1-original.png
├── guardian-article-1-round-0.png
├── guardian-article-1-round-1.png
├── guardian-article-1-round-2.png
├── bbc-homepage-original.png
├── bbc-homepage-round-0.png
├── bbc-homepage-round-1.png
└── ...
```

Filename format: `{site}-{page-type}-{page-num}-{round}.png`

### Capture Process

Using Puppeteer:
1. Load original page → capture `{page}-original.png`
2. Load wikilinked page → capture `{page}-round-N.png`
3. Viewport: 1280x800 (standard desktop)
4. Wait for network idle before capture

---

## Success Criteria

- **Zero regressions** in final round
- **<1% incorrect links** relative to total links
- **Visual review** of screenshot samples shows clean article text with no nav/header pollution
- **Both environments pass** - Server and Chrome extension produce identical results on test pages

---

## Implementation Order

1. Build sampler.js - crawl and select pages
2. Build runner.js - fetch and process pages
3. Build analyzer.js - cluster errors
4. Build reporter.js - generate reports
5. Build screenshotter.js - Puppeteer captures
6. Run round 0 baseline
7. Extract shared/skip-rules.js
8. Iterate: fix patterns, run tests, check regressions
9. Port final rules to Chrome extension
10. Verify both environments match
