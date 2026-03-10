# Wikilinker i18n Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish Wikilinker in 20 Wikipedia languages across Chrome, Firefox, and Safari stores.

**Architecture:** Monorepo with parameterised build. A new `i18n/` directory holds per-language config (skip words, store copy, UI strings). Existing `extension/` is the template. `build.js --bloom --lang fr` produces a complete French extension ZIP. Data pipeline extracts per-language pageviews from already-cached Wikimedia dumps.

**Tech Stack:** Node.js, esbuild, bash, Playwright (screenshots), Chrome Web Store API, AMO Signing API, xcodebuild/xcrun, Claude API (translations)

---

## Phase 1: Foundation — Language Config & Data Pipeline

### Task 1: Create `i18n/languages.json` master config

**Files:**
- Create: `i18n/languages.json`

**Step 1: Write the config file**

```json
{
  "languages": [
    { "code": "en", "name": "English", "nativeName": "English", "script": "latin", "matcher": "regex", "dir": "ltr", "wikiPrefix": "en" },
    { "code": "ja", "name": "Japanese", "nativeName": "日本語", "script": "cjk", "matcher": "segmenter", "dir": "ltr", "wikiPrefix": "ja" },
    { "code": "de", "name": "German", "nativeName": "Deutsch", "script": "latin", "matcher": "regex", "dir": "ltr", "wikiPrefix": "de" },
    { "code": "es", "name": "Spanish", "nativeName": "Español", "script": "latin", "matcher": "regex", "dir": "ltr", "wikiPrefix": "es" },
    { "code": "fr", "name": "French", "nativeName": "Français", "script": "latin", "matcher": "regex", "dir": "ltr", "wikiPrefix": "fr" },
    { "code": "ru", "name": "Russian", "nativeName": "Русский", "script": "cyrillic", "matcher": "regex", "dir": "ltr", "wikiPrefix": "ru" },
    { "code": "it", "name": "Italian", "nativeName": "Italiano", "script": "latin", "matcher": "regex", "dir": "ltr", "wikiPrefix": "it" },
    { "code": "zh", "name": "Chinese", "nativeName": "中文", "script": "cjk", "matcher": "segmenter", "dir": "ltr", "wikiPrefix": "zh" },
    { "code": "pt", "name": "Portuguese", "nativeName": "Português", "script": "latin", "matcher": "regex", "dir": "ltr", "wikiPrefix": "pt" },
    { "code": "pl", "name": "Polish", "nativeName": "Polski", "script": "latin", "matcher": "regex", "dir": "ltr", "wikiPrefix": "pl" },
    { "code": "nl", "name": "Dutch", "nativeName": "Nederlands", "script": "latin", "matcher": "regex", "dir": "ltr", "wikiPrefix": "nl" },
    { "code": "ar", "name": "Arabic", "nativeName": "العربية", "script": "arabic", "matcher": "regex", "dir": "rtl", "wikiPrefix": "ar" },
    { "code": "tr", "name": "Turkish", "nativeName": "Türkçe", "script": "latin", "matcher": "regex", "dir": "ltr", "wikiPrefix": "tr" },
    { "code": "id", "name": "Indonesian", "nativeName": "Bahasa Indonesia", "script": "latin", "matcher": "regex", "dir": "ltr", "wikiPrefix": "id" },
    { "code": "uk", "name": "Ukrainian", "nativeName": "Українська", "script": "cyrillic", "matcher": "regex", "dir": "ltr", "wikiPrefix": "uk" },
    { "code": "fa", "name": "Persian", "nativeName": "فارسی", "script": "arabic", "matcher": "regex", "dir": "rtl", "wikiPrefix": "fa" },
    { "code": "ko", "name": "Korean", "nativeName": "한국어", "script": "hangul", "matcher": "segmenter", "dir": "ltr", "wikiPrefix": "ko" },
    { "code": "sv", "name": "Swedish", "nativeName": "Svenska", "script": "latin", "matcher": "regex", "dir": "ltr", "wikiPrefix": "sv" },
    { "code": "cs", "name": "Czech", "nativeName": "Čeština", "script": "latin", "matcher": "regex", "dir": "ltr", "wikiPrefix": "cs" },
    { "code": "hi", "name": "Hindi", "nativeName": "हिन्दी", "script": "devanagari", "matcher": "regex", "dir": "ltr", "wikiPrefix": "hi" }
  ]
}
```

**Step 2: Commit**

```bash
git add i18n/languages.json
git commit -m "feat(i18n): add languages.json master config for 20 languages"
```

---

### Task 2: Extract English skip words to `i18n/en/skip-words.json`

**Files:**
- Create: `i18n/en/skip-words.json`
- Modify: `server/shared/matcher-core.js` — import skip words from JSON instead of hardcoded Set

**Step 1: Write the failing test**

Add to `server/shared/matcher-core.test.js` (new file):

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('i18n/en/skip-words.json exists and contains expected words', () => {
  const raw = readFileSync(join(__dirname, '..', '..', 'i18n', 'en', 'skip-words.json'), 'utf8');
  const words = JSON.parse(raw);
  assert.ok(Array.isArray(words));
  assert.ok(words.length >= 100, `Expected 100+ skip words, got ${words.length}`);
  assert.ok(words.includes('Monday'));
  assert.ok(words.includes('French'));
  assert.ok(words.includes('Shutterstock'));
});
```

**Step 2: Run test to verify it fails**

Run: `cd server && node --test shared/matcher-core.test.js`
Expected: FAIL — file doesn't exist yet

**Step 3: Create the skip words JSON**

Extract the SKIP_WORDS array from `server/shared/matcher-core.js` into `i18n/en/skip-words.json` as a sorted JSON array of strings.

**Step 4: Update `matcher-core.js` to load skip words from JSON**

Change the top of `matcher-core.js`:

```js
import skipWordsEn from '../../i18n/en/skip-words.json' with { type: 'json' };

export const SKIP_WORDS = new Set(skipWordsEn.default || skipWordsEn);
```

Note: The extension build uses esbuild which handles JSON imports natively. The server uses Node.js which supports `import ... with { type: 'json' }`. Verify both paths work.

If the `with` syntax causes issues with the esbuild target, keep the hardcoded array for now and load from JSON only in the build step. The important thing is the JSON file exists as the source of truth.

**Step 5: Run all tests to verify nothing broke**

Run: `npm test`
Expected: All 74 tests pass

**Step 6: Run the new test**

Run: `cd server && node --test shared/matcher-core.test.js`
Expected: PASS

**Step 7: Commit**

```bash
git add i18n/en/skip-words.json server/shared/matcher-core.js server/shared/matcher-core.test.js
git commit -m "refactor: extract English skip words to i18n/en/skip-words.json"
```

---

### Task 3: Parameterise `build-pageview-ranking.sh` with `--lang`

**Files:**
- Modify: `scripts/build-pageview-ranking.sh`

**Step 1: Add `--lang` argument parsing**

Add to the arg parsing block:

```bash
LANG_CODE="en"

# In the while loop:
--lang) LANG_CODE=$2; shift 2 ;;
```

**Step 2: Change the awk filter to use `$LANG_CODE`**

Replace:
```bash
| awk '$1 == "en.wikipedia" { print $2 "\t" $(NF-1) }'
```
With:
```bash
| awk -v wiki="${LANG_CODE}.wikipedia" '$1 == wiki { print $2 "\t" $(NF-1) }'
```

**Step 3: Change output path**

Replace:
```bash
OUTPUT="$SCRIPT_DIR/../../whitelabel.org/wikiproxy-data/titles-ranked.tsv"
```
With:
```bash
if [ "$LANG_CODE" = "en" ]; then
  OUTPUT="$SCRIPT_DIR/../../whitelabel.org/wikiproxy-data/titles-ranked.tsv"
else
  OUTPUT="$SCRIPT_DIR/../i18n/${LANG_CODE}/titles-ranked.tsv"
  mkdir -p "$(dirname "$OUTPUT")"
fi
```

**Step 4: Test with a non-English language**

Run: `bash scripts/build-pageview-ranking.sh --lang fr --days 1`
Expected: Creates `i18n/fr/titles-ranked.tsv` with French Wikipedia titles. Top entries should be French articles (Paris, France, etc).

Verify: `head -5 i18n/fr/titles-ranked.tsv`

**Step 5: Test English still works (backward compat)**

Run: `bash scripts/build-pageview-ranking.sh --days 1`
Expected: Still writes to the original `whitelabel.org/wikiproxy-data/titles-ranked.tsv`

**Step 6: Commit**

```bash
git add scripts/build-pageview-ranking.sh
git commit -m "feat(i18n): add --lang flag to build-pageview-ranking.sh"
```

---

### Task 4: Add `--all-langs` mode for batch extraction

**Files:**
- Modify: `scripts/build-pageview-ranking.sh`

**Step 1: Add `--all-langs` flag**

```bash
ALL_LANGS=false

# In the while loop:
--all-langs) ALL_LANGS=true; shift ;;
```

**Step 2: Build the awk filter for all languages**

When `--all-langs` is true, read language codes from `i18n/languages.json` and generate an awk script that outputs to multiple files simultaneously:

```bash
if [ "$ALL_LANGS" = "true" ]; then
  # Read language codes from languages.json
  LANG_CODES=$(node -e "
    const langs = JSON.parse(require('fs').readFileSync('i18n/languages.json','utf8'));
    console.log(langs.languages.map(l => l.code).join(' '));
  ")

  # Create output dirs
  for lc in $LANG_CODES; do
    if [ "$lc" = "en" ]; then continue; fi
    mkdir -p "i18n/$lc"
  done
fi
```

Replace the single-language awk in the extract phase with a multi-output version when `--all-langs` is set. Each daily file gets split into per-language TSVs in a single pass.

**Step 3: Test**

Run: `bash scripts/build-pageview-ranking.sh --all-langs --days 1`
Expected: Creates `i18n/{code}/titles-ranked.tsv` for all 19 non-English languages. Verify a few: `head -3 i18n/fr/titles-ranked.tsv i18n/de/titles-ranked.tsv i18n/ja/titles-ranked.tsv`

**Step 4: Commit**

```bash
git add scripts/build-pageview-ranking.sh
git commit -m "feat(i18n): add --all-langs batch extraction mode"
```

---

### Task 5: Parameterise `build-bloom.mjs` with `--lang`

**Files:**
- Modify: `scripts/build-bloom.mjs`

**Step 1: Add `--lang` argument**

```js
const langCode = getArg('--lang', 'en');
```

**Step 2: Change input/output paths based on language**

```js
const titlesPath = langCode === 'en'
  ? join(__dirname, '..', '..', 'whitelabel.org', 'wikiproxy-data', 'titles-ranked.tsv')
  : join(__dirname, '..', 'i18n', langCode, 'titles-ranked.tsv');

const outPath = langCode === 'en'
  ? join(__dirname, '..', 'server', 'shared', 'entities-bloom.bin')
  : join(__dirname, '..', 'i18n', langCode, 'entities-bloom.bin');
```

**Step 3: Test with French**

Prerequisite: `i18n/fr/titles-ranked.tsv` must exist from Task 3/4.

Run: `node scripts/build-bloom.mjs --lang fr --count 100000`
Expected: Creates `i18n/fr/entities-bloom.bin` (~240KB for 100K titles). Verify with: `ls -la i18n/fr/entities-bloom.bin`

**Step 4: Test English backward compat**

Run: `node scripts/build-bloom.mjs --count 1000`
Expected: Still writes to `server/shared/entities-bloom.bin`

**Step 5: Commit**

```bash
git add scripts/build-bloom.mjs
git commit -m "feat(i18n): add --lang flag to build-bloom.mjs"
```

---

### Task 6: Create `scripts/build-all-langs.sh`

**Files:**
- Create: `scripts/build-all-langs.sh`

**Step 1: Write the orchestrator script**

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COUNT=${1:-1000000}

echo "=== Building all language data ==="

# Phase 1: Extract pageviews for all languages
echo ""
echo "--- Extracting pageviews for all languages ---"
bash "$SCRIPT_DIR/build-pageview-ranking.sh" --all-langs

# Phase 2: Build bloom filters
echo ""
echo "--- Building bloom filters ---"

LANG_CODES=$(node -e "
  const langs = JSON.parse(require('fs').readFileSync('i18n/languages.json','utf8'));
  console.log(langs.languages.filter(l => l.code !== 'en').map(l => l.code).join(' '));
")

for lc in $LANG_CODES; do
  echo "  Building bloom: $lc"
  node "$SCRIPT_DIR/build-bloom.mjs" --lang "$lc" --count "$COUNT"
done

echo ""
echo "=== Done ==="
```

**Step 2: Make executable and test**

```bash
chmod +x scripts/build-all-langs.sh
```

Run with a small count to verify: `bash scripts/build-all-langs.sh 1000`
Expected: All 19 non-English languages get `titles-ranked.tsv` and `entities-bloom.bin` in their `i18n/{code}/` directories.

**Step 3: Commit**

```bash
git add scripts/build-all-langs.sh
git commit -m "feat(i18n): add build-all-langs.sh orchestrator"
```

---

## Phase 2: Matcher Internationalisation

### Task 7: Unicode regex upgrade for `extractCandidates`

**Files:**
- Modify: `server/shared/matcher-core.js`
- Modify: `server/lib/matcher.test.js`

**Step 1: Write failing tests for non-Latin scripts**

Add to `server/lib/matcher.test.js`:

```js
test('finds Cyrillic entities (Russian)', () => {
  const russianEntities = ['Москва', 'Владимир Путин'];
  const matcher = new EntityMatcher(russianEntities);
  const matches = matcher.findMatches('репортёр встретил Владимир Путин в Москва вчера.');
  assert.ok(matches.some(m => m.text === 'Владимир Путин'));
});

test('finds German entities with umlauts', () => {
  const germanEntities = ['München', 'Österreich'];
  const matcher = new EntityMatcher(germanEntities);
  const matches = matcher.findMatches('der Reporter reiste nach München und dann nach Österreich.');
  assert.ok(matches.some(m => m.text === 'München'));
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: New tests FAIL — current regex only matches `[A-Z][a-zA-Z]`

**Step 3: Upgrade regex patterns in `extractCandidates`**

Replace:
```js
const capsWord = "[A-Z][a-zA-Z'\\-]+";
```
With:
```js
const capsWord = "[\\p{Lu}][\\p{L}'\\-]+";
```

And update the acronym pattern:
```js
/\b([A-Z]{2,6})\b/g
```
To:
```js
/\b([\p{Lu}]{2,6})\b/gu
```

All regex patterns using `[A-Z]` or `[a-zA-Z]` need the `u` flag and Unicode property escapes. Update every `new RegExp(...)` call to include the `u` flag.

Also update `meetsMinLength`:
```js
if (/^[\p{Lu}]+$/u.test(phrase)) return phrase.length >= 3;
```

And `isPartOfLargerPhrase`:
```js
const lastWord = textBefore.match(/[\p{Lu}][\p{L}''\-]*$/u);
const nextWord = textAfter.match(/^[\p{Lu}][\p{L}''\-]*/u);
```

**Step 4: Run tests**

Run: `npm test`
Expected: All tests pass including the new Cyrillic/German tests

**Step 5: Commit**

```bash
git add server/shared/matcher-core.js server/lib/matcher.test.js
git commit -m "feat(i18n): upgrade matcher regex to Unicode property escapes"
```

---

### Task 8: Parameterise `toWikiUrl` with language prefix

**Files:**
- Modify: `server/shared/matcher-core.js`
- Modify: `extension/src/content.js`

**Step 1: Write failing test**

Add to `server/lib/matcher.test.js`:

```js
import { toWikiUrl } from '../shared/matcher-core.js';

test('toWikiUrl defaults to English', () => {
  assert.strictEqual(toWikiUrl('Barack Obama'), 'https://en.wikipedia.org/wiki/Barack_Obama');
});

test('toWikiUrl generates French URL', () => {
  assert.strictEqual(toWikiUrl('Paris', 'fr'), 'https://fr.wikipedia.org/wiki/Paris');
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `toWikiUrl` doesn't accept a second argument

**Step 3: Add language parameter**

In `matcher-core.js`:
```js
export function toWikiUrl(entityName, lang = 'en') {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(entityName.replace(/ /g, '_'))}`;
}
```

In `content.js`, the language will come from a build-time define (Task 12). For now just pass `'en'` explicitly.

**Step 4: Run tests**

Run: `npm test`
Expected: All pass

**Step 5: Commit**

```bash
git add server/shared/matcher-core.js server/lib/matcher.test.js
git commit -m "feat(i18n): parameterise toWikiUrl with language prefix"
```

---

### Task 9: Externalise skip words loading in matcher

**Files:**
- Modify: `server/shared/matcher-core.js`

**Step 1: Write failing test**

Add to `server/shared/matcher-core.test.js`:

```js
import { extractCandidates, setSkipWords } from '../shared/matcher-core.js';

test('setSkipWords overrides default skip words', () => {
  // 'Monday' is in the default English skip words
  setSkipWords(new Set(['CustomSkip']));
  const candidates = extractCandidates('he met Monday and CustomSkip there.');
  assert.ok(candidates.has('Monday'), 'Monday should NOT be skipped with custom list');
  assert.ok(!candidates.has('CustomSkip'), 'CustomSkip SHOULD be skipped');
  // Restore defaults
  setSkipWords(null);
});
```

**Step 2: Run to verify failure**

Run: `cd server && node --test shared/matcher-core.test.js`
Expected: FAIL — `setSkipWords` doesn't exist

**Step 3: Implement `setSkipWords`**

In `matcher-core.js`, change the SKIP_WORDS from a `const` to a mutable module variable:

```js
let currentSkipWords = new Set([...the existing array...]);
export const SKIP_WORDS = currentSkipWords; // backward compat for existing code

export function setSkipWords(words) {
  if (words === null) {
    currentSkipWords = SKIP_WORDS;
  } else {
    currentSkipWords = words;
  }
}
```

Then in `extractCandidates`, use `currentSkipWords` instead of `SKIP_WORDS`.

The point: the extension build can inject language-specific skip words at build time (or load them at runtime), while the server and tests still use the English defaults.

**Step 4: Run tests**

Run: `npm test` and `cd server && node --test shared/matcher-core.test.js`
Expected: All pass

**Step 5: Commit**

```bash
git add server/shared/matcher-core.js server/shared/matcher-core.test.js
git commit -m "feat(i18n): add setSkipWords() for per-language skip word lists"
```

---

### Task 10: CJK matcher using `Intl.Segmenter`

**Files:**
- Create: `server/shared/matcher-cjk.js`
- Create: `server/shared/matcher-cjk.test.js`

**Step 1: Write failing tests**

Create `server/shared/matcher-cjk.test.js`:

```js
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { findMatchesCJK } from './matcher-cjk.js';

describe('CJK matcher', () => {
  test('finds Japanese entities in text', () => {
    const entitySet = { has: (t) => ['東京', '日本'].includes(t) };
    const text = '記者は東京で日本の首相に会った。';
    const matches = findMatchesCJK(text, entitySet, 'ja');
    assert.ok(matches.some(m => m.text === '東京'));
    assert.ok(matches.some(m => m.text === '日本'));
  });

  test('finds Chinese entities in text', () => {
    const entitySet = { has: (t) => ['北京', '中国'].includes(t) };
    const text = '记者在北京采访了中国外交部。';
    const matches = findMatchesCJK(text, entitySet, 'zh');
    assert.ok(matches.some(m => m.text === '北京'));
    assert.ok(matches.some(m => m.text === '中国'));
  });

  test('finds Korean entities in text', () => {
    const entitySet = { has: (t) => ['서울', '한국'].includes(t) };
    const text = '기자는 서울에서 한국 대통령을 만났다.';
    const matches = findMatchesCJK(text, entitySet, 'ko');
    assert.ok(matches.some(m => m.text === '서울'));
    assert.ok(matches.some(m => m.text === '한국'));
  });

  test('deduplicates — first occurrence only', () => {
    const entitySet = { has: (t) => ['東京'].includes(t) };
    const text = '東京は大きい。東京は美しい。';
    const matches = findMatchesCJK(text, entitySet, 'ja');
    assert.strictEqual(matches.filter(m => m.text === '東京').length, 1);
  });

  test('finds multi-character entity names', () => {
    const entitySet = { has: (t) => ['国際連合'].includes(t) };
    const text = '国際連合の総会が開催された。';
    const matches = findMatchesCJK(text, entitySet, 'ja');
    assert.ok(matches.some(m => m.text === '国際連合'));
  });
});
```

**Step 2: Run to verify failure**

Run: `cd server && node --test shared/matcher-cjk.test.js`
Expected: FAIL — file doesn't exist

**Step 3: Implement CJK matcher**

Create `server/shared/matcher-cjk.js`:

```js
// CJK entity matcher using Intl.Segmenter.
// For Japanese, Chinese, and Korean text where regex word
// boundaries don't work.

export function findMatchesCJK(text, entitySet, lang) {
  const segmenter = new Intl.Segmenter(lang, { granularity: 'word' });
  const segments = [...segmenter.segment(text)];

  const matches = [];
  const seen = new Set();

  // Check individual words and 2-4 word combinations
  for (let i = 0; i < segments.length; i++) {
    if (!segments[i].isWordLike) continue;

    // Try combinations of 1-4 consecutive word segments
    let combined = '';
    let wordCount = 0;
    for (let j = i; j < segments.length && wordCount < 4; j++) {
      combined += segments[j].segment;
      if (segments[j].isWordLike) wordCount++;

      if (wordCount > 0 && entitySet.has(combined) && !seen.has(combined)) {
        matches.push({ text: combined, index: segments[i].index });
        seen.add(combined);
        break; // take longest match starting at this position
      }
    }
  }

  matches.sort((a, b) => a.index - b.index);
  return matches;
}
```

**Step 4: Run tests**

Run: `cd server && node --test shared/matcher-cjk.test.js`
Expected: All pass

Note: `Intl.Segmenter` requires Node.js 16+. The extension targets Chrome 120+, Safari 15.4+, Firefox 125+ — all support it.

**Step 5: Commit**

```bash
git add server/shared/matcher-cjk.js server/shared/matcher-cjk.test.js
git commit -m "feat(i18n): add CJK matcher using Intl.Segmenter"
```

---

## Phase 3: Extension Build Parameterisation

### Task 11: Add `--lang` flag to `extension/build.js`

**Files:**
- Modify: `extension/build.js`

**Step 1: Add language argument parsing**

```js
const langArg = process.argv.find(a => a.startsWith('--lang'));
const langIdx = process.argv.indexOf('--lang');
const lang = langIdx >= 0 ? process.argv[langIdx + 1] : 'en';
```

**Step 2: Resolve paths based on language**

```js
import { readFileSync, existsSync, mkdirSync, cpSync, writeFileSync } from 'fs';
import { join } from 'path';

const i18nDir = join('i18n', lang);
const isEnglish = lang === 'en';

// Bloom filter path
const bloomPath = isEnglish
  ? 'server/shared/entities-bloom.bin'
  : join(i18nDir, 'entities-bloom.bin');

// Skip words path
const skipWordsPath = join('i18n', lang, 'skip-words.json');
```

**Step 3: Choose matcher entry point**

Read `i18n/languages.json` to determine matcher type:

```js
const languages = JSON.parse(readFileSync('i18n/languages.json', 'utf8'));
const langConfig = languages.languages.find(l => l.code === lang);
const isCJK = langConfig?.matcher === 'segmenter';
```

For CJK languages, use a new content script entry point that imports `matcher-cjk.js` instead of `matcher-core.js`. (Create this variant in Task 13.)

**Step 4: Inject language as build-time define**

```js
define: {
  ENTITY_COUNT: String(entityCount),
  WIKI_LANG: JSON.stringify(lang),
},
```

**Step 5: When `lang !== 'en'`, copy to build output dir**

Instead of writing to `extension/dist/`, write to `build/{lang}/dist/` and copy the extension template files alongside:

```js
const outdir = isEnglish ? 'extension/dist' : `build/${lang}/dist`;
```

After esbuild, copy static files (manifest.json, popup.html, popup.js, styles.css, icons/) into `build/{lang}/` and patch the manifest with localised name/description.

**Step 6: Test**

Run: `node extension/build.js --bloom --lang en`
Expected: Writes to `extension/dist/` as before (backward compat)

Run: `node extension/build.js --bloom --lang fr`
Expected: Writes to `build/fr/` with a complete extension. Requires `i18n/fr/entities-bloom.bin` and `i18n/fr/skip-words.json` to exist.

**Step 7: Commit**

```bash
git add extension/build.js
git commit -m "feat(i18n): add --lang flag to extension build"
```

---

### Task 12: Inject `WIKI_LANG` into content script

**Files:**
- Modify: `extension/src/content.js`

**Step 1: Use the `WIKI_LANG` define**

In `content.js`, replace the hardcoded `'en'` in `toWikiUrl`:

```js
// At top of file (build-time define)
const wikiLang = typeof WIKI_LANG !== 'undefined' ? WIKI_LANG : 'en';
```

In `createWikiLink`:
```js
function createWikiLink(entityName) {
  const link = document.createElement('a');
  link.href = toWikiUrl(entityName, wikiLang);
  link.className = 'wikilink';
  link.title = `${entityName} — Wikipedia`;
  link.rel = 'noopener';
  link.appendChild(document.createTextNode(entityName));
  return link;
}
```

**Step 2: Run existing tests**

Run: `npm test`
Expected: All pass (the define defaults to `'en'`)

**Step 3: Commit**

```bash
git add extension/src/content.js
git commit -m "feat(i18n): use WIKI_LANG build define for Wikipedia URL prefix"
```

---

### Task 13: CJK content script variant

**Files:**
- Create: `extension/src/content-cjk.js`

**Step 1: Create CJK content script**

This is a variant of `content.js` that imports `matcher-cjk.js` instead of `matcher-core.js`. The simplest approach: import both matchers and select based on the `WIKI_LANG` define.

Modify `content.js` to conditionally use CJK matching:

```js
import { findMatchesCJK } from '../../server/shared/matcher-cjk.js';

// In walkAndProcess, where findMatches is called:
const matches = isCJKLang
  ? findMatchesCJK(text, entitySet, wikiLang)
  : findMatches(text, entitySet);
```

Where `isCJKLang` is derived from the build-time define:

```js
const CJK_LANGS = new Set(['ja', 'zh', 'ko']);
const isCJKLang = CJK_LANGS.has(wikiLang);
```

esbuild's tree-shaking will eliminate the unused matcher code when `WIKI_LANG` is a constant string, so non-CJK builds won't include the Segmenter code, and CJK builds won't include the regex matcher.

Actually — esbuild won't tree-shake based on runtime values. Instead, use `--define` to set a boolean:

In `build.js`:
```js
define: {
  ENTITY_COUNT: String(entityCount),
  WIKI_LANG: JSON.stringify(lang),
  IS_CJK: String(isCJK),
},
```

In `content.js`:
```js
const isCJKLang = typeof IS_CJK !== 'undefined' ? IS_CJK : false;
```

esbuild with `IS_CJK: 'false'` will dead-code-eliminate the CJK import for non-CJK builds.

**Step 2: Test English build still works**

Run: `node extension/build.js --bloom`
Expected: Builds successfully, no CJK code in output

**Step 3: Commit**

```bash
git add extension/src/content.js
git commit -m "feat(i18n): add CJK matcher support in content script"
```

---

## Phase 4: UI Internationalisation

### Task 14: Create chrome.i18n `messages.json` for English

**Files:**
- Create: `i18n/en/messages.json`
- Modify: `extension/popup.html` — replace hardcoded strings with `__MSG_key__`
- Modify: `extension/popup.js` — use `chrome.i18n.getMessage()`
- Modify: `extension/manifest.json` — add `default_locale`

**Step 1: Create English messages.json**

```json
{
  "extensionName": {
    "message": "Wikilinker",
    "description": "Extension name shown in browser"
  },
  "extensionDescription": {
    "message": "Auto-links names to Wikipedia",
    "description": "Extension description shown in stores"
  },
  "popupTitle": {
    "message": "Wikilinker",
    "description": "Title shown in popup header"
  },
  "popupSubtitle": {
    "message": "Auto-link names to Wikipedia",
    "description": "Subtitle in popup"
  },
  "enableToggle": {
    "message": "Enable Wikilinker",
    "description": "Main enable/disable toggle label"
  },
  "allSitesToggle": {
    "message": "Run on all sites",
    "description": "Toggle to enable on all websites"
  },
  "allSitesNote": {
    "message": "Experimental — may not work on every site",
    "description": "Note below all-sites toggle"
  },
  "statsNames": {
    "message": "Names in database:",
    "description": "Label for entity count stat"
  },
  "statsLinks": {
    "message": "Links on this page:",
    "description": "Label for page link count stat"
  },
  "statsLoading": {
    "message": "Loading...",
    "description": "Shown while loading entity count"
  },
  "statsError": {
    "message": "Error",
    "description": "Shown when entity count fails to load"
  },
  "footerCoffee": {
    "message": "Buy Stef a coffee",
    "description": "Ko-fi donation link text"
  },
  "footerAbout": {
    "message": "About",
    "description": "About page link text"
  }
}
```

**Step 2: Update `popup.html` to use message keys**

Replace hardcoded strings with `data-i18n` attributes (chrome.i18n doesn't work in HTML directly for popup content — only manifest.json supports `__MSG_key__`). Use JS to populate:

Keep popup.html with the English strings as defaults, but add `data-i18n` attributes:

```html
<span class="toggle-label" data-i18n="enableToggle">Enable Wikilinker</span>
```

**Step 3: Update `popup.js` to load i18n strings**

Add at the top of the DOMContentLoaded handler:

```js
// Apply i18n strings
document.querySelectorAll('[data-i18n]').forEach(el => {
  const msg = chrome.i18n.getMessage(el.dataset.i18n);
  if (msg) el.textContent = msg;
});
```

**Step 4: Update `manifest.json`**

Add `"default_locale": "en"` and change name/description to use message keys:

```json
{
  "name": "__MSG_extensionName__",
  "description": "__MSG_extensionDescription__",
  "default_locale": "en"
}
```

**Step 5: Add RTL support to popup**

Add to popup.html `<html>` tag:
```html
<html lang="en" dir="auto">
```

Add to popup.js:
```js
// Set text direction for RTL languages
const uiLocale = chrome.i18n.getUILanguage();
if (['ar', 'fa', 'he'].some(l => uiLocale.startsWith(l))) {
  document.documentElement.dir = 'rtl';
}
```

**Step 6: Copy `_locales/en/messages.json` into extension at build time**

In `build.js`, after esbuild, copy the messages.json:

```js
const localeDir = isEnglish ? 'extension/_locales/en' : `build/${lang}/_locales/${lang}`;
mkdirSync(localeDir, { recursive: true });
cpSync(join('i18n', lang, 'messages.json'), join(localeDir, 'messages.json'));
```

For the English build, create `extension/_locales/en/messages.json` so the extension works locally during development.

**Step 7: Test**

Load the extension in Chrome with `_locales/en/messages.json` present. The popup should display normally with English strings. The manifest name should resolve to "Wikilinker".

**Step 8: Commit**

```bash
git add i18n/en/messages.json extension/popup.html extension/popup.js extension/manifest.json extension/build.js
git commit -m "feat(i18n): add chrome.i18n support with English messages.json"
```

---

## Phase 5: Translation Generation

### Task 15: Create `scripts/translate-strings.mjs`

**Files:**
- Create: `scripts/translate-strings.mjs`
- Create: `i18n/en/store-listing.json`
- Create: `i18n/en/simplified-source.json` (simplified English for translation)

**Step 1: Create the simplified English source**

Write short, non-idiomatic versions of all strings in `i18n/en/simplified-source.json`. This is the translation source. Example:

```json
{
  "extensionName": "Wikilinker",
  "extensionDescription": "Adds Wikipedia links to names automatically",
  "popupSubtitle": "Adds Wikipedia links to names",
  "enableToggle": "Turn on Wikilinker",
  "allSitesToggle": "Use on all websites",
  "allSitesNote": "This feature is experimental. It may not work on all websites.",
  "statsNames": "Names in database:",
  "statsLinks": "Links on this page:",
  "footerCoffee": "Buy Stef a coffee",
  "footerAbout": "About",
  "storeDescription": "Wikilinker adds Wikipedia links to people, places, and organisations as you read news articles. It works automatically on any website. It has a database of 1,000,000 names. All processing happens on your device. No data is sent to any server.",
  "storeKeywords": "wikipedia,news,links,knowledge,reference"
}
```

**Step 2: Create the translation script**

`scripts/translate-strings.mjs` reads `i18n/en/simplified-source.json`, calls the Claude API for each target language, outputs `i18n/{lang}/messages.json` and `i18n/{lang}/store-listing.json`.

The script should:
- Read `i18n/languages.json` for the target language list
- Skip `en` (source language)
- Accept `--lang fr` to translate a single language, or `--all` for all
- Use the Anthropic SDK (`@anthropic-ai/sdk`)
- Prompt: "Translate the following UI strings to {language}. Keep translations concise. Do not translate proper nouns. Return valid JSON."
- Write output files

**Step 3: Test with one language**

Run: `node scripts/translate-strings.mjs --lang fr`
Expected: Creates `i18n/fr/messages.json` and `i18n/fr/store-listing.json` with French translations.

Manually verify a few strings look correct.

**Step 4: Commit**

```bash
git add scripts/translate-strings.mjs i18n/en/simplified-source.json i18n/en/store-listing.json
git commit -m "feat(i18n): add translation generation script using Claude API"
```

---

### Task 16: Create `scripts/build-skip-words.mjs`

**Files:**
- Create: `scripts/build-skip-words.mjs`

**Step 1: Write the script**

The script:
1. Reads `i18n/en/skip-words.json` as the English template
2. Calls Claude API to translate the English skip words to the target language AND add language-specific common words
3. Writes to `i18n/{lang}/skip-words.json`

Prompt structure:
```
Here are English skip words for a Wikipedia entity linker: [list]

Translate these to {language} where applicable. Also add:
- Common {language} articles, prepositions, conjunctions
- Days of the week and months in {language}
- Common {language} words that are likely Wikipedia titles but not useful as entity links
- Demonym adjectives in {language}

Return a JSON array of strings.
```

**Step 2: Test with French**

Run: `node scripts/build-skip-words.mjs --lang fr`
Expected: Creates `i18n/fr/skip-words.json` with French skip words. Should include lundi/mardi/mercredi, janvier/février, le/la/les, etc.

**Step 3: Commit**

```bash
git add scripts/build-skip-words.mjs
git commit -m "feat(i18n): add skip word translation script using Claude API"
```

---

## Phase 6: Screenshot & Promo Generation

### Task 17: Create `i18n/{lang}/sample-urls.json` for all languages

**Files:**
- Create: `i18n/{lang}/sample-urls.json` for each of the 20 languages

**Step 1: Curate sample news article URLs**

For each language, pick 2-3 URLs from major news sites. Articles should be about uncontroversial topics: science, geography, culture, sport. Use established broadsheet-style outlets.

Example structure:
```json
{
  "urls": [
    {
      "url": "https://www.lemonde.fr/sciences/article/...",
      "description": "Science article from Le Monde"
    },
    {
      "url": "https://www.lefigaro.fr/culture/...",
      "description": "Culture article from Le Figaro"
    }
  ]
}
```

Use Claude to help identify appropriate news sites and find suitable article URLs for each language. Verify each URL loads.

**Step 2: Commit**

```bash
git add i18n/*/sample-urls.json
git commit -m "feat(i18n): add sample news article URLs for all 20 languages"
```

---

### Task 18: Create `scripts/generate-screenshots.mjs`

**Files:**
- Create: `scripts/generate-screenshots.mjs`

**Step 1: Write the screenshot script**

Uses Playwright to:
1. Navigate to each sample URL
2. Inject the language's wikilinks (load the bloom filter, run the matcher, inject links with wikilink CSS)
3. Take screenshots at required dimensions:
   - Desktop: 1280×800
   - iPhone: 1284×2778
   - iPad: 2048×2732
4. Output to `i18n/{lang}/screenshots/`

The script should accept `--lang fr` or `--all`.

Key: The extension can't run as a real extension in Playwright. Instead, the script loads the page, injects the content script logic directly (import the matcher, bloom filter, and link injection code), and takes screenshots of the result.

**Step 2: Test with English**

Run: `node scripts/generate-screenshots.mjs --lang en`
Expected: Screenshots in `i18n/en/screenshots/` showing wikilinks on English news articles.

**Step 3: Test with French**

Run: `node scripts/generate-screenshots.mjs --lang fr`
Expected: Screenshots of French news articles with French Wikipedia wikilinks.

**Step 4: Commit**

```bash
git add scripts/generate-screenshots.mjs
git commit -m "feat(i18n): add Playwright screenshot generation script"
```

---

### Task 19: Create promo image generation

**Files:**
- Create: `scripts/generate-promos.mjs`
- Create: `scripts/templates/promo-440x280.html` (template)
- Create: `scripts/templates/promo-1400x560.html` (template)

**Step 1: Create HTML templates**

Based on the existing promo images, create HTML templates with placeholder text that gets replaced per language:

- `{{extensionName}}` → "Wikilinker (Français)"
- `{{subtitle}}` → localised subtitle
- `{{sampleText}}` → a short paragraph of news text with wikilinks highlighted

**Step 2: Write the generation script**

Renders each template with Playwright at the correct dimensions, outputs PNG to `i18n/{lang}/screenshots/`.

**Step 3: Test**

Run: `node scripts/generate-promos.mjs --lang fr`
Expected: `i18n/fr/screenshots/promo-440x280.png` and `promo-1400x560.png`

**Step 4: Commit**

```bash
git add scripts/generate-promos.mjs scripts/templates/
git commit -m "feat(i18n): add promo image generation from HTML templates"
```

---

## Phase 7: Publishing Pipeline

### Task 20: Create `scripts/build-extension.sh`

**Files:**
- Create: `scripts/build-extension.sh`

**Step 1: Write the build script for a single language**

```bash
#!/bin/bash
# Usage: bash scripts/build-extension.sh --lang fr
set -euo pipefail

LANG_CODE="en"
while [[ $# -gt 0 ]]; do
  case $1 in
    --lang) LANG_CODE=$2; shift 2 ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
done

echo "Building extension for: $LANG_CODE"

# Build with esbuild
node extension/build.js --bloom --lang "$LANG_CODE"

# Create ZIP
if [ "$LANG_CODE" = "en" ]; then
  cd extension && zip -r "../build/wikilinker-en.zip" \
    manifest.json popup.html popup.js styles.css dist/ icons/ _locales/ \
    -x "*.DS_Store" && cd ..
else
  cd "build/$LANG_CODE" && zip -r "../wikilinker-${LANG_CODE}.zip" \
    manifest.json popup.html popup.js styles.css dist/ icons/ _locales/ \
    -x "*.DS_Store" && cd ../..
fi

echo "Output: build/wikilinker-${LANG_CODE}.zip"
```

**Step 2: Test**

Run: `bash scripts/build-extension.sh --lang en`
Expected: `build/wikilinker-en.zip` containing all extension files

**Step 3: Commit**

```bash
git add scripts/build-extension.sh
git commit -m "feat(i18n): add single-language extension build script"
```

---

### Task 21: Create `scripts/build-all-extensions.sh`

**Files:**
- Create: `scripts/build-all-extensions.sh`

**Step 1: Write the batch build script**

```bash
#!/bin/bash
set -euo pipefail

LANG_CODES=$(node -e "
  const langs = JSON.parse(require('fs').readFileSync('i18n/languages.json','utf8'));
  console.log(langs.languages.map(l => l.code).join(' '));
")

mkdir -p build
for lc in $LANG_CODES; do
  echo "=== Building: $lc ==="
  bash scripts/build-extension.sh --lang "$lc"
done

echo ""
echo "=== All builds complete ==="
ls -la build/wikilinker-*.zip
```

**Step 2: Test**

Run: `bash scripts/build-all-extensions.sh`
Expected: 20 ZIP files in `build/`

**Step 3: Commit**

```bash
git add scripts/build-all-extensions.sh
git commit -m "feat(i18n): add batch extension build script"
```

---

### Task 22: Chrome Web Store publishing script

**Files:**
- Create: `scripts/publish-chrome.sh`

**Step 1: Research the Chrome Web Store API**

Check: `https://developer.chrome.com/docs/webstore/using-api`

The API requires:
- OAuth2 client ID and client secret
- Refresh token
- Extension ID per language (one-time registration)

**Step 2: Write the publish script**

Accepts `--lang fr` or `--all`. Uses `curl` to:
1. Get access token from refresh token
2. Upload ZIP via `PUT https://www.googleapis.com/upload/chromewebstore/v1.1/items/{itemId}`
3. Publish via `POST https://www.googleapis.com/chromewebstore/v1.1/items/{itemId}/publish`

Store extension IDs in `i18n/languages.json` under a `chromeId` field (added after one-time registration).

**Step 3: Commit**

```bash
git add scripts/publish-chrome.sh
git commit -m "feat(i18n): add Chrome Web Store publishing script"
```

---

### Task 23: Firefox AMO publishing script

**Files:**
- Create: `scripts/publish-firefox.sh`

**Step 1: Write the script**

Uses `web-ext sign` or the AMO API directly. Each language needs a unique addon ID in `browser_specific_settings.gecko.id` (e.g. `wikilinker-fr@whitelabel.org`).

**Step 2: Commit**

```bash
git add scripts/publish-firefox.sh
git commit -m "feat(i18n): add Firefox AMO publishing script"
```

---

### Task 24: Safari App Store publishing script

**Files:**
- Create: `scripts/publish-safari.sh`
- Create: `scripts/generate-xcode-project.mjs`

**Step 1: Write Xcode project generator**

This is the most complex piece. The script:
1. Copies the Safari Xcode template project
2. Replaces bundle IDs with per-language values (e.g. `org.whitelabel.wikilinker-fr`)
3. Copies **only runtime files** into Resources/ (manifest.json, popup.html, popup.js, styles.css, dist/, icons/, _locales/)
4. Does NOT copy build artifacts (src/, scripts/, screenshots/, promo files, README, store-listing)
5. Updates the pbxproj with correct file references
6. Sets development team `86H54WCPYP` on all 4 targets

**Step 2: Write the archive + upload script**

```bash
xcodebuild archive \
  -project "build/safari/${LANG_CODE}/Wikilinker.xcodeproj" \
  -scheme "Wikilinker (macOS)" \
  -archivePath "build/safari/${LANG_CODE}/Wikilinker-macOS.xcarchive"

xcrun altool --upload-app \
  -f "build/safari/${LANG_CODE}/Wikilinker-macOS.xcarchive" \
  -t macos \
  --apiKey "$APP_STORE_API_KEY" \
  --apiIssuer "$APP_STORE_API_ISSUER"
```

Repeat for iOS.

**Step 3: Commit**

```bash
git add scripts/publish-safari.sh scripts/generate-xcode-project.mjs
git commit -m "feat(i18n): add Safari App Store publishing scripts"
```

---

### Task 25: Create `scripts/publish-all.sh` orchestrator

**Files:**
- Create: `scripts/publish-all.sh`

**Step 1: Write the orchestrator**

```bash
#!/bin/bash
set -euo pipefail

echo "=== Publishing all languages ==="

# Build all extensions
bash scripts/build-all-extensions.sh

# Publish to each store
LANG_CODES=$(node -e "
  const langs = JSON.parse(require('fs').readFileSync('i18n/languages.json','utf8'));
  console.log(langs.languages.map(l => l.code).join(' '));
")

for lc in $LANG_CODES; do
  echo ""
  echo "=== Publishing $lc ==="
  bash scripts/publish-chrome.sh --lang "$lc" || echo "FAILED: Chrome $lc"
  bash scripts/publish-firefox.sh --lang "$lc" || echo "FAILED: Firefox $lc"
  bash scripts/publish-safari.sh --lang "$lc" || echo "FAILED: Safari $lc"
done

echo ""
echo "=== Done ==="
```

**Step 2: Commit**

```bash
git add scripts/publish-all.sh
git commit -m "feat(i18n): add publish-all.sh orchestrator"
```

---

## Phase 8: Testing & Validation

### Task 26: Per-language validation script

**Files:**
- Create: `scripts/validate-language.mjs`

**Step 1: Write the validation script**

For a given language, the script:
1. Loads the bloom filter from `i18n/{lang}/entities-bloom.bin`
2. Loads skip words from `i18n/{lang}/skip-words.json`
3. Fetches each sample URL from `i18n/{lang}/sample-urls.json`
4. Runs the matcher (regex or CJK) against the article text
5. Reports: total candidates, matched entities, entities linked, false-positive-looking matches
6. Outputs a TSV debug report

Accepts `--lang fr` or `--all`.

**Step 2: Test with English**

Run: `node scripts/validate-language.mjs --lang en`
Expected: Report showing matches on English news articles, similar to existing `--debug` output.

**Step 3: Commit**

```bash
git add scripts/validate-language.mjs
git commit -m "feat(i18n): add per-language validation script"
```

---

### Task 27: Add i18n tests to test suite

**Files:**
- Modify: `package.json` — update test script
- Create: `server/shared/matcher-core.test.js` (if not already created in Task 2)

**Step 1: Update test script in package.json**

```json
"test": "cd server && node --test lib/*.test.js shared/*.test.js test/*.test.js"
```

This picks up the new `matcher-core.test.js`, `matcher-cjk.test.js`, etc.

**Step 2: Run full suite**

Run: `npm test`
Expected: All tests pass including new i18n tests.

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: include shared/*.test.js in test suite"
```

---

## Execution Order Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-6 | Language config, data pipeline parameterisation |
| 2 | 7-10 | Matcher Unicode upgrade, CJK matcher |
| 3 | 11-13 | Extension build parameterisation |
| 4 | 14 | chrome.i18n UI internationalisation |
| 5 | 15-16 | Translation and skip word generation |
| 6 | 17-19 | Screenshot and promo image generation |
| 7 | 20-25 | Build and publishing scripts |
| 8 | 26-27 | Testing and validation |

Phases 1-4 are sequential (each builds on the last). Phases 5-8 can be partially parallelised.
