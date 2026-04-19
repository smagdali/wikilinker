# Store Listing — Wikilinker

> **Translation-ready English.** This copy is the source for all 20 language translations.
> Style rules: see [docs/i18n-style-guide.md](../docs/i18n-style-guide.md).
> Keep sentences short. Prefer bullets. Use consistent terminology. No idioms, puns, or cultural references.

## Glossary (consistent terms — do not vary)

- **name** (not "entity", "proper noun", "term") — the thing Wikilinker links
- **Wikipedia link** (not "hyperlink", "reference") — the output
- **webpage** (not "page", "site", "article") — the input
- **bloom filter** (keep literal; link to Wikipedia on first use)
- **1,000,000** — full form, not "1M" or "a million" (except where character limits require)

---

## Short description (Chrome manifest.json + store summary, 132 chars max)

Adds Wikipedia links to names on any webpage. One million names matched locally. No tracking. No network requests.

## Chrome Web Store — Detailed description

Wikilinker adds Wikipedia links to names on any webpage — people, places, and organizations. Each link is marked with a small ⓦ so it stays visible in reader modes that strip styling.

Features:
- Links one million Wikipedia names
- Marks each link with a small ⓦ glyph
- Works in Firefox Reader and Safari Reader modes
- Runs on any webpage
- Links only the first mention of each name
- Optional filter to skip single-word names
- Two-megabyte bloom filter bundled with the extension
- MIT licensed; source code on GitHub

How it works:
- You open a webpage.
- Wikilinker reads the article text.
- It checks each name against a local bloom filter of the top one million Wikipedia titles, ranked by page views.
- It adds a Wikipedia link on the first mention of each name.
- All processing happens inside your browser.
- The extension makes no network requests and sends no data anywhere.

Privacy:
- Wikilinker collects no data.
- It uses no analytics.
- It makes no network requests.
- The only stored value is your enable/disable preference.

History: Wikilinker started in 2004 as a web proxy that added Wikipedia links to BBC News articles. This is a browser-extension version.

Source code: https://github.com/smagdali/wikilinker
Privacy policy: https://github.com/smagdali/wikilinker/blob/main/PRIVACY.md
Bloom filter reference: https://en.wikipedia.org/wiki/Bloom_filter

## Firefox AMO — Summary (250 chars max)

Wikilinker adds Wikipedia links to names on any webpage — people, places, and organizations. Each link is marked with a small ⓦ that stays visible in Reader mode. One million names matched locally. No tracking. No network requests.

## Firefox AMO — Detailed description

Wikilinker adds Wikipedia links to names on any webpage — people, places, and organizations. Each link is marked with a small ⓦ so it stays visible in reader modes that strip styling.

Features:
- Links one million Wikipedia names
- Marks each link with a small ⓦ glyph
- Works in Firefox Reader and Safari Reader modes
- Runs on any webpage
- Links only the first mention of each name
- Optional filter to skip single-word names
- Two-megabyte bloom filter bundled with the extension
- MIT licensed; source code on GitHub

How it works:
- You open a webpage.
- Wikilinker reads the article text.
- It checks each name against a local bloom filter of the top one million Wikipedia titles, ranked by page views.
- It adds a Wikipedia link on the first mention of each name.
- All processing happens inside your browser.
- The extension makes no network requests and sends no data anywhere.

Privacy:
- Wikilinker collects no personal data.
- It uses no analytics.
- It makes no network requests.
- The only stored value is your enable/disable preference.

Source code: https://github.com/smagdali/wikilinker

## Safari App Store

### Subtitle (30 chars max)

Wikipedia links on any page

### Keywords (100 chars max)

wikipedia,links,names,reader,news,knowledge,articles,learning,reference,encyclopedia

### Description

Wikilinker adds Wikipedia links to names on any webpage — people, places, and organizations. Each link is marked with a small ⓦ so it stays visible in reader modes that strip styling.

Features:
- Links one million Wikipedia names
- Marks each link with a small ⓦ glyph
- Works in Safari Reader mode
- Runs on any webpage
- Links only the first mention of each name
- Optional filter to skip single-word names
- Two-megabyte bloom filter bundled with the app
- MIT licensed; source code on GitHub

How it works:
- You open a webpage.
- Wikilinker reads the article text.
- It checks each name against a local bloom filter of the top one million Wikipedia titles.
- It adds a Wikipedia link on the first mention of each name.
- All processing happens inside your browser.
- The extension makes no network requests and sends no data anywhere.

Privacy: Wikilinker collects no data. It uses no analytics. It makes no network requests. The only stored value is your enable/disable preference.

History: Wikilinker started in 2004 as a web proxy that added Wikipedia links to BBC News articles. This is a browser-extension version.

Source code: https://github.com/smagdali/wikilinker

### Promotional text (170 chars max)

Adds Wikipedia links to one million names on any webpage. Each link marked with a ⓦ for Reader mode. All processing is local. No tracking. No network requests.
