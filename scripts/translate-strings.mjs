#!/usr/bin/env node
//
// Translate Wikilinker UI strings + store-listing copy from English into one
// or more target languages via the Claude API.
//
// Usage:
//   node scripts/translate-strings.mjs --lang fr
//   node scripts/translate-strings.mjs --all-langs
//
// Outputs:
//   i18n/{lang}/messages.json         chrome.i18n format, ready to ship
//   i18n/{lang}/store-listing.json    keyed per-store localised copy
//
// See scripts/lib/i18n-translate.mjs for the shared caching strategy.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT_DIR, MODEL, CACHE_TTL,
  getClient, resolveTargetLangs, printUsageAndExit,
  extractJson, joinTextBlocks, logUsage,
} from './lib/i18n-translate.mjs';

// ── CLI ────────────────────────────────────────────────────────────────────

const targets = resolveTargetLangs(process.argv.slice(2));
if (!targets) printUsageAndExit('translate-strings.mjs');

// ── Load source material ──────────────────────────────────────────────────

const englishMessages = JSON.parse(
  readFileSync(join(ROOT_DIR, 'i18n/en/messages.json'), 'utf8'),
);
const storeListingMd = readFileSync(
  join(ROOT_DIR, 'extension/store-listing.md'), 'utf8',
);
const styleGuide = readFileSync(
  join(ROOT_DIR, 'docs/i18n-style-guide.md'), 'utf8',
);

const client = getClient();

// ── System prompt (cached across all 19 language calls) ───────────────────

const SYSTEM_PROMPT = `You are a professional localiser for the Wikilinker browser extension. Apply the style guide below to every translation you produce.

<style-guide>
${styleGuide}
</style-guide>

Non-negotiable rules:
- Preserve Unicode characters like ⓦ, em dashes (—), and curly quotes exactly as they appear in the source.
- Keep proper nouns (Wikipedia, Chrome, Firefox, Safari) and technical terms (bloom filter) untranslated unless the target language has an established localisation.
- Keep URLs and licence names (MIT) as-is.
- Maintain consistent terminology across a run: once you pick a word for a concept, use the same word for every occurrence.
- Output only the JSON object asked for — no preamble, no explanation, no code fences.`;

// ── Chrome.i18n messages ──────────────────────────────────────────────────

async function translateMessages(lang) {
  const keyList = Object.keys(englishMessages);
  const outputSchema = Object.fromEntries(keyList.map((k) => [k, '<translated string>']));

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    system: [{
      type: 'text',
      text: SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral', ttl: CACHE_TTL },
    }],
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Translate the following Wikilinker chrome.i18n UI strings. The "description" field of each entry is context for you as a translator — do not include descriptions in the output.

Source (English):
\`\`\`json
${JSON.stringify(englishMessages, null, 2)}
\`\`\`

Pay attention to character limits noted in each description. Keep the translation natural but within limits.

Output format — a JSON object with exactly these keys, each mapped to the translated string:
${JSON.stringify(outputSchema, null, 2)}`,
          cache_control: { type: 'ephemeral', ttl: CACHE_TTL },
        },
        {
          type: 'text',
          text: `Target language: ${lang.name} (${lang.nativeName}). Output only the JSON object.`,
        },
      ],
    }],
  });

  const text = joinTextBlocks(response);
  let translated;
  try {
    translated = JSON.parse(extractJson(text));
  } catch (e) {
    throw new Error(`Failed to parse messages JSON for ${lang.code}: ${e.message}\n--- raw output ---\n${text}\n--- end ---`);
  }

  // Rebuild chrome.i18n format, preserving English descriptions for future translators.
  const result = {};
  for (const [key, englishEntry] of Object.entries(englishMessages)) {
    if (typeof translated[key] !== 'string') {
      throw new Error(`Missing or non-string translation for key "${key}" in ${lang.code}`);
    }
    result[key] = {
      message: translated[key],
      description: englishEntry.description,
    };
  }

  logUsage(`messages/${lang.code}`, response.usage);
  return result;
}

// ── Store listings (chrome / firefox / safari) ────────────────────────────

const STORE_SCHEMA_KEYS = [
  'shortDescription',
  'chromeDescription',
  'firefoxSummary',
  'firefoxDescription',
  'safariSubtitle',
  'safariKeywords',
  'safariDescription',
  'safariPromotionalText',
];

async function translateStoreListing(lang) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    thinking: { type: 'adaptive' },
    system: [{
      type: 'text',
      text: SYSTEM_PROMPT,
      cache_control: { type: 'ephemeral', ttl: CACHE_TTL },
    }],
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Translate the Wikilinker store-listing copy. The source is a markdown document organised by store; your output is a flat JSON object with per-store localised strings.

Source (English, translation-ready):
\`\`\`markdown
${storeListingMd}
\`\`\`

Output exactly these keys, each mapped to a translated string:

- "shortDescription" — manifest.json short description (≤132 chars)
- "chromeDescription" — full description from the Chrome Web Store section. Chrome stays generic on Reader mode: "reader modes that strip styling".
- "firefoxSummary" — Firefox AMO summary (≤250 chars). Mentions Firefox Reader mode specifically.
- "firefoxDescription" — Firefox AMO detailed description. Mentions Firefox Reader mode specifically.
- "safariSubtitle" — Safari subtitle (≤30 chars)
- "safariKeywords" — Safari keywords, comma-separated, no spaces (≤100 chars total)
- "safariDescription" — Safari App Store detailed description. Mentions Safari Reader mode specifically.
- "safariPromotionalText" — Safari promotional text (≤170 chars)

Character limits are hard — translations can expand 30-40% over English, so trim where needed without losing meaning. Output only the JSON object.`,
          cache_control: { type: 'ephemeral', ttl: CACHE_TTL },
        },
        {
          type: 'text',
          text: `Target language: ${lang.name} (${lang.nativeName}). Output only the JSON object.`,
        },
      ],
    }],
  });

  const text = joinTextBlocks(response);
  let parsed;
  try {
    parsed = JSON.parse(extractJson(text));
  } catch (e) {
    throw new Error(`Failed to parse store-listing JSON for ${lang.code}: ${e.message}\n--- raw output ---\n${text}\n--- end ---`);
  }

  for (const key of STORE_SCHEMA_KEYS) {
    if (typeof parsed[key] !== 'string') {
      throw new Error(`Missing or non-string "${key}" in store-listing for ${lang.code}`);
    }
  }

  logUsage(`store/${lang.code}`, response.usage);
  return parsed;
}

// ── Main ───────────────────────────────────────────────────────────────────

for (const lang of targets) {
  console.log(`\n=== ${lang.code} (${lang.nativeName}) ===`);
  const langDir = join(ROOT_DIR, 'i18n', lang.code);
  mkdirSync(langDir, { recursive: true });

  const messages = await translateMessages(lang);
  writeFileSync(
    join(langDir, 'messages.json'),
    JSON.stringify(messages, null, 2) + '\n',
  );
  console.log(`  wrote i18n/${lang.code}/messages.json`);

  const storeListing = await translateStoreListing(lang);
  writeFileSync(
    join(langDir, 'store-listing.json'),
    JSON.stringify(storeListing, null, 2) + '\n',
  );
  console.log(`  wrote i18n/${lang.code}/store-listing.json`);
}

console.log(`\nDone. Translated ${targets.length} language(s).`);
