# Wikilinker i18n Implementation Plan

Date: 2026-04-14 (supersedes 2026-03-10)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish Wikilinker in 20 Wikipedia languages across Chrome, Firefox, and Safari stores.

**Architecture:** Monorepo with parameterised build. `i18n/` holds per-language config (skip words, store copy, UI strings, translated article templates). `extension/` is the template. `node extension/build.js --lang fr` produces a complete French extension ZIP. Safari uses Apple's localization (one project, N locale files) — not N Xcode projects.

**Tech Stack:** Node.js, esbuild, bash, Playwright (screenshots from synthetic templates), Chrome Web Store API, AMO Signing API, App Store Connect API, Claude API (translations).

**Key changes vs. 2026-03-10 plan:**
- `--bloom` flag removed everywhere (bloom is the only path since v0.6.2)
- Safari: one Xcode project with `Localizable.strings` per language, not N per-language projects
- Screenshots: synthetic article templates rendered in Playwright, not live news URLs
- UI strings updated for current popup (no "all sites" toggle; "exclude single words" toggle present)
- `scripts/publish.sh` already exists for Chrome/Firefox — extend with `--lang`, don't create new scripts
- About page stays English-only; store listings are the localisation surface
- Test baseline: 78 tests (was 74)

---

## Phase 1: Foundation — Language Config & Data Pipeline

### Task 1: Create `i18n/languages.json` master config

Identical to 2026-03-10 plan Task 1. One entry per language with `code`, `nativeName`, `script`, `matcher` (`regex` or `segmenter`), `dir` (`ltr`/`rtl`), `wikiPrefix`.

Commit: `feat(i18n): add languages.json master config for 20 languages`

### Task 2: Extract English skip words to `i18n/en/skip-words.json`

Move the hardcoded `SKIP_WORDS` Set from `server/shared/matcher-core.js` into `i18n/en/skip-words.json`. Matcher reads the JSON at build time (esbuild `import` with `.json` loader).

Test: new `matcher-core.test.js` assertion that imported set matches previous hardcoded set.

Commit: `feat(i18n): extract English skip words to i18n/en/`

### Task 3: Parameterise `build-pageview-ranking.sh` with `--lang`

Change hardcoded `$1 == "en.wikipedia"` awk filter to `$1 == "<lang>.wikipedia"`. Output: `i18n/{lang}/titles-ranked.tsv`.

### Task 4: Add `--all-langs` mode for batch extraction

Single pass through each bz2, extracts all 20 languages simultaneously. Critical for performance — 20GB of dumps, don't re-scan per language.

### Task 5: Parameterise `build-bloom.mjs` with `--lang`

Reads `i18n/{lang}/titles-ranked.tsv`, writes `i18n/{lang}/entities-bloom.bin`. Same parameters (1M titles, 0.01% false positive rate).

### Task 6: Create `scripts/build-all-langs.sh`

Orchestrates: `build-pageview-ranking.sh --all-langs` → `build-bloom.mjs --lang <each>` for all 20. Idempotent; skip work if TSV newer than bloom bin.

---

## Phase 2: Matcher Internationalisation

### Task 7: Unicode regex upgrade for `extractCandidates`

In `server/shared/matcher-core.js`, replace `[A-Z]` with `\p{Lu}` and add `/u` flag to all candidate regexes. This single change handles German, Russian, Turkish, Czech, Polish, etc.

Tests:
- Existing English tests still pass
- New tests: "matches Russian uppercase (Москва)", "matches German umlauts (München)", "matches Turkish dotted I (İstanbul)"

### Task 8: Parameterise `toWikiUrl` with language prefix

Currently hardcoded to `en.wikipedia.org`. Take `lang` param, default `en`. Extension passes its build-time `WIKI_LANG` constant.

### Task 9: Externalise skip words loading in matcher

Matcher accepts skip words as argument/import, not hardcoded. Server loads English list by default. Extension build inlines the right list via esbuild.

### Task 10: CJK matcher using `Intl.Segmenter`

New `server/shared/matcher-segmenter.js` implementing the segmenter strategy from the design doc. Same public API as `matcher-core.js` so the extension can swap implementations at build time. Tests use Japanese/Chinese/Korean sample sentences with known-title entities.

---

## Phase 3: Extension Build Parameterisation

### Task 11: Add `--lang` flag to `extension/build.js`

- Reads `i18n/languages.json`
- Validates `--lang` against known codes
- Bundles the correct bloom filter, skip words, matcher variant, and `_locales/`
- Patches `manifest.json`: `default_locale`, `name`, `description` as `__MSG_extensionName__`/`__MSG_extensionDescription__`
- For RTL langs, injects `dir="auto"` to popup body
- Output: `build/wikilinker-{lang}.zip`

Remove the obsolete `--bloom` references while we're here.

### Task 12: Inject `WIKI_LANG` into content script

esbuild `define` replaces `WIKI_LANG` constant with the build-time language. Matcher passes this to `toWikiUrl()`.

### Task 13: CJK content script variant

For ja/zh/ko, `build.js` substitutes the segmenter matcher import. No runtime branching — pure build-time substitution.

---

## Phase 4: UI Internationalisation

### Task 14: Create chrome.i18n `messages.json` for English

Author `i18n/en/messages.json` covering the current v0.6.5 UI surface:

```json
{
  "extensionName": { "message": "Wikilinker" },
  "extensionDescription": { "message": "Auto-links names to Wikipedia — people, places, and organizations on any webpage" },
  "popupTagline": { "message": "Auto-link names to Wikipedia" },
  "popupEnable": { "message": "Enable Wikilinker" },
  "popupExcludeSingleWords": { "message": "Exclude single words" },
  "popupExcludeSingleWordsNote": { "message": "Skip single-word matches like \"blue\" and \"high\"" },
  "popupNamesInDatabase": { "message": "Names in database:" },
  "popupLinksOnThisPage": { "message": "Links on this page:" },
  "popupAbout": { "message": "About" },
  "popupGitHub": { "message": "GitHub" }
}
```

Update `popup.html` and `popup.js` to read these via `chrome.i18n.getMessage()`. The "Run on all sites" toggle was removed in v0.6.4 — not present in strings.

---

## Phase 5: Translation Generation

### Task 15: Create `scripts/translate-strings.mjs`

Two-step translation pipeline:

1. **Normalise** the English source to simplified, non-idiomatic English (short declarative sentences, no slang, no cultural references). This is the translation source; idiomatic English reintroduced for the English listing.
2. **Translate** the simplified English to all 19 target languages via Claude API. One call per language with the full message set, returning a localised `messages.json`.

Also translates store listing copy (`name`, `shortDescription`, `longDescription`, `keywords`, `screenshotCaptions`) into `i18n/{lang}/store-listing.json`.

### Task 16: Create `scripts/build-skip-words.mjs`

Use Claude API to translate the English skip words list per language, then augment with language-specific additions (articles, particles, pronouns). Output: `i18n/{lang}/skip-words.json`.

Validation: run matcher with `--debug` against one synthetic article per language, assert that candidate set is reasonable. Flag for native-speaker review but don't block the build.

---

## Phase 6: Screenshot & Promo Generation

### Task 17: Create synthetic article templates

Three English HTML templates in `i18n/article-templates/`:
- `science.html` — e.g. "How photosynthesis works" (~400 words, ~15 entity mentions)
- `biography.html` — e.g. "Marie Curie" (~400 words, ~15 entity mentions)
- `history.html` — e.g. "The Voyager missions" (~400 words, ~15 entity mentions)

Each template has realistic news-site chrome (header, byline, date, paragraphs). Topics are chosen to be universally safe (science, historical figures, space missions) — no politics, religion, or current affairs.

Translation: per language, `scripts/translate-strings.mjs` adds article bodies to `i18n/{lang}/article-translations/*.json`. Translation quality doesn't have to be literary; it has to be accurate enough to contain the target language's Wikipedia entity names correctly.

### Task 18: Create `scripts/generate-screenshots.mjs`

For each language × each template:
1. Load the template HTML, inject the translated body
2. Load the built extension for that language into a Playwright browser context
3. Navigate to a `file://` URL rendering the article
4. Wait for the extension to inject wikilinks
5. Capture screenshots at each target size:
   - Desktop 1280×800 (Chrome/Firefox)
   - iPhone 1284×2778 (App Store)
   - iPad 2048×2732 (App Store)
6. Write to `i18n/{lang}/screenshots/`

Playwright doesn't currently support Safari Web Extensions directly, so for Safari-sized screenshots, render with the extension's content script injected manually against the same bloom filter the Safari build uses. Output is indistinguishable.

### Task 19: Create promo image generation

Same approach as 2026-03-10 plan — HTML templates rendered via Playwright, with localised tagline per language. Sizes: 440×280 (small) + 1400×560 (marquee).

---

## Phase 7: Publishing Pipeline

### Task 20: Extend `scripts/build-extension.sh`

Wrap `node extension/build.js --lang <lang>` with zip packaging. Output to `build/wikilinker-{lang}.zip`.

### Task 21: Create `scripts/build-all-extensions.sh`

Loops over `i18n/languages.json` calling Task 20 for each. Parallelises where safe.

### Task 22: Extend `scripts/publish.sh` with `--lang`

Current script publishes English only. Add `--lang fr` flag:
- Uses per-language Chrome extension ID (stored as `CHROME_EXTENSION_ID_FR` etc. in `.env.publish`, or loaded from `i18n/{lang}/store-ids.json`)
- Uses per-language Firefox AMO ID
- Uploads localised store metadata via Chrome Web Store API and AMO API

`--lang all` loops over every language.

### Task 23: Create `scripts/publish-safari.sh`

One `xcodebuild archive` — the archive contains all localizations. Then `xcrun notarytool submit`, then App Store Connect API calls to sync per-locale metadata (name, subtitle, description, keywords, screenshots) for all 20 locales.

Per-locale `Localizable.strings` files in `safari/Wikilinker/Shared (App)/Resources/{lang}.lproj/` drive display name + splash screen copy. Generated from `i18n/{lang}/messages.json` at build time.

**Pre-requisite (pbxproj surgery)**: The `_locales/` folder must be added as a `PBXFileReference` with `lastKnownFileType = folder` in `safari/Wikilinker/Wikilinker.xcodeproj/project.pbxproj`, with `PBXBuildFile` entries referenced by both extension `PBXResourcesBuildPhase` lists (iOS and macOS). Without this, chrome.i18n strings don't ship in the Safari bundle and `__MSG_extensionName__` placeholders fail to resolve at runtime.

### Task 24: Create `scripts/publish-all.sh`

Orchestrates the full pipeline:
1. `build-all-langs.sh` — refresh bloom filters if needed
2. `build-all-extensions.sh` — 20 Chrome/Firefox ZIPs + XPIs
3. `publish.sh --lang all` — Chrome + Firefox uploads
4. `publish-safari.sh` — one archive, 20 locales

Logs results per store per language. Exits non-zero if any upload fails.

---

## Phase 8: Testing & Validation

### Task 25: Per-language validation script

`scripts/validate-lang.mjs --lang fr`:
- Runs matcher with the language's skip words against the translated synthetic articles
- Counts candidates, matches, skipped
- Asserts:
  - At least 10 matches per article
  - False positive rate < 5% (using Wikipedia page existence as oracle via bloom filter)
  - No matches in skip words list
- Reports per-language table

### Task 26: Add i18n tests to test suite

- CJK matcher tests with Japanese/Chinese/Korean samples
- RTL rendering tests: build a popup with Arabic strings, snapshot test the DOM
- Unicode regex tests covering each script

### Task 27: Manual review checkpoints

Before publishing each language tier (see rollout order in design doc):
- Spot-check translated strings with a native speaker (one-paragraph review)
- Verify screenshots look natural in the target language
- Check Chrome/Firefox/Apple store preview in the target locale

Not automated; intentional gate before hitting publish.

---

## Execution Order Summary

Infrastructure-first rollout:

| Phase | Tasks | Deliverable |
|-------|-------|-------------|
| 1 | 1-6 | Data pipeline per language |
| 2 | 7-10 | Matcher handles all scripts |
| 3 | 11-13 | Extension builds per language |
| 4 | 14 | English UI via chrome.i18n |
| 5 | 15-16 | Translations for all 20 |
| 6 | 17-19 | Screenshots + promos |
| 7 | 20-24 | Publishing scripts |
| 8 | 25-27 | Validation |

Ship as v0.7.0 with English-only after Phase 3 (proves infrastructure). Ship French pilot after Phase 7 complete. Scale through tiers thereafter.
