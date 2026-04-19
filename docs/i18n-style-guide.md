# i18n Style Guide

Rules for writing English source copy that translates cleanly into all 20 target languages. Applies to store listings, popup strings, splash screen text, and any other copy that will be translated.

**Audience:** us (when writing English), Claude (when translating), native-speaker reviewers (when checking translations).

## Why bother

- Literal translations of idiomatic English are awkward in every target language. Avoiding idioms in the source avoids the problem entirely.
- Consistent terminology in the source produces consistent terminology in every translation. Drift in the source multiplies across 20 languages.
- Short, simple English is easier to skim for non-native English readers too (a significant share of the English Chrome Web Store).
- Bullets translate cleanly in every script and direction, including RTL and CJK.

## Sentence structure

- **Maximum 15 words per sentence.** Long sentences accumulate translation errors and produce awkward word order in target languages.
- **Active voice, present tense.** "Wikilinker reads the text" not "The text is read by Wikilinker." Simpler grammar in every language.
- **One idea per sentence.** Chains of clauses with "and" / "but" / "which" are hard to translate.
- **Short paragraphs.** Two to three sentences each. Long blocks deter readers and translators.

## Vocabulary

- **Consistent terminology.** Pick one word per concept and stick to it. Don't alternate "Wikipedia link" / "hyperlink" / "reference", or "name" / "entity" / "term", or "webpage" / "site" / "article".
- **No idioms.** "At your fingertips" / "seamless experience" / "on the fly" / "transforms your reading" — all out.
- **No puns, rhymes, or alliteration.** These never survive translation.
- **No cultural references.** No movie titles, song lyrics, memes, or politics — even if they feel universal.
- **Concrete features over abstract benefits.** "Adds a ⓦ next to each link" translates cleanly; "Transforms your reading experience" becomes weird in most target languages.
- **Technical terms stay in English when they're already English loanwords globally** (e.g., "bloom filter", "browser", "Wikipedia") — usually better than forcing a native translation that may not be standard.

## Structure

- **Bullets over prose** wherever a list of features, steps, or facts fits. Bullets are easier to translate accurately and easier to scan in every language.
- **Use headings.** Break long descriptions into "Features", "How it works", "Privacy", "History". Predictable structure helps translators and readers.
- **Put the essential sentence first.** Each paragraph's first sentence should convey the point; details can follow. Translations sometimes reorder clauses, but the lead sentence carries the message.

## Specific pitfalls

- **Avoid contractions.** "Does not" not "doesn't". Contractions are English-specific and produce nothing useful when translated.
- **Spell out numbers up to ten.** "Two-megabyte bloom filter" not "2MB bloom filter" — but keep "1,000,000" literal for emphasis (and translators will localise the separator).
- **Define acronyms on first use**, or drop them entirely if undefined. "MIT licensed" is fine (it's a proper noun); "AI" without context is not.
- **Dates**: spell out month names or use ISO format. "04/12/2026" means different dates in the US and Europe, and "Apr" doesn't translate.
- **Units**: spell out first use ("megabyte" not "MB"); after that the abbreviation is fine in context.

## Character limits (tightest first)

| Surface | Limit |
|---------|-------|
| Safari subtitle | 30 chars |
| Chrome short description (manifest.json) | 132 chars |
| Safari promotional text | 170 chars |
| Firefox AMO summary | 250 chars |
| Chrome Web Store long description | 16,000 chars |
| Safari description (App Store) | 4,000 chars |

Translations can expand by 30-40% from English. Leave headroom — don't pack the English version to the limit.

## Glossary for Wikilinker

Use exactly these terms in every piece of copy:

| Concept | Term | Notes |
|---------|------|-------|
| The thing we link | **name** | Not "entity", "proper noun", "term", "keyword" |
| The linked output | **Wikipedia link** | Not "hyperlink", "reference", "external link" |
| The input | **webpage** | Not "page", "site", "article" (unless specifically about articles) |
| The data structure | **bloom filter** | Literal; link to Wikipedia on first use |
| The size claim | **one million** (or **1,000,000**) | Not "1M", "a million", "loads of" |
| The file size | **two-megabyte** | Not "2MB" in prose (fine in labels) |
| The extension | **Wikilinker** | Always capitalised, always singular |
| The marking | **ⓦ glyph** or **small ⓦ** | Describe what it is; do not localise the character |

## Process

1. Draft English copy following the rules above.
2. Save to `extension/store-listing.md`.
3. Run `scripts/translate-strings.mjs` to produce `i18n/{lang}/store-listing.json` for each target language.
4. Native-speaker review before publishing each language tier.
5. Updates to the English source re-trigger the full translation pipeline.

## When the rules are wrong

Some English surfaces benefit from more voice: the about page, blog posts, release notes. Those stay in the English repository and do not go through the translation pipeline.

If a rule here ever harms the English listing enough to cost installs, revisit. Concrete, bullet-heavy copy is not the same as boring copy. But if we need a punchy idiom for one specific line, isolate that line to an English-only surface rather than bending the style guide.
