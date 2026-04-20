#!/usr/bin/env node
//
// Build a per-language skip-word denylist for the Wikilinker matcher,
// starting from the English list and using Claude to translate + augment
// with target-language-specific additions (articles, particles, pronouns).
//
// Usage:
//   node scripts/build-skip-words.mjs --lang fr
//   node scripts/build-skip-words.mjs --all-langs
//
// Output: i18n/{lang}/skip-words.json (JSON array of unique words).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT_DIR, MODEL, CACHE_TTL,
  getClient, resolveTargetLangs, printUsageAndExit,
  extractJson, joinTextBlocks, logUsage,
} from './lib/i18n-translate.mjs';

// ── CLI ───────────────────────────────────────────────────────────────────

const targets = resolveTargetLangs(process.argv.slice(2));
if (!targets) printUsageAndExit('build-skip-words.mjs');

const englishSkipWords = JSON.parse(
  readFileSync(join(ROOT_DIR, 'i18n/en/skip-words.json'), 'utf8'),
);

const client = getClient();

// ── System prompt (cached across all 19 language calls) ───────────────────

const SYSTEM_PROMPT = `You are building a per-language skip-word denylist for the Wikilinker browser extension.

Wikilinker scans webpages for capitalised phrases and looks each one up in a bloom filter of Wikipedia titles. The skip-word list is a denylist — words that happen to match a Wikipedia title but are almost never useful entity links because they are common words, not entities.

The English list has these categories:
- Pronouns and determiners ("The", "They", "Your")
- Days and months ("Monday", "January")
- Common words that happen to be Wikipedia titles ("About", "Following", "Health")
- Compass directions ("North", "East")
- Demonyms and nationality adjectives ("American", "British", "Chinese")
- Institutional and role words ("Parliament", "Secretary", "Justice")
- Stock photo attribution names ("Getty", "Alamy", "Shutterstock")

Your job: produce the equivalent denylist for the target language.

Rules:
1. Output words capitalised as they would appear at the start of a sentence (matching Wikipedia title case).
2. Translate each applicable English category into its target-language equivalents. Not every English entry has an equivalent — that is expected; skip those rather than invent awkward words.
3. Add target-language-specific common words the English list doesn't cover. Every language needs its own articles, pronouns, and filler words. Examples:
   - French: Le, La, Les, Un, Une, Des, Du, De, Je, Tu, Il, Elle, Nous, Vous, Ce, Cette, Ces, Mon, Ma, Ton, Sa, Son, Leur...
   - Spanish: El, La, Los, Las, Un, Una, Unos, Unas, Yo, Tú, Él, Ella, Nosotros, Vosotros, Mi, Mis, Tu, Sus...
   - German: Der, Die, Das, Den, Dem, Ein, Eine, Ich, Du, Er, Sie, Wir, Mein, Dein, Sein...
4. Stock-photo attribution names stay in English — brand names do not translate: Getty, Alamy, Shutterstock.
5. Do NOT include proper nouns (place names, people's names, organisation names). This is a denylist of common words, not a list of entities.
6. No duplicates. Deduplicate case-sensitively (French "Le" and "LE" are both added only if both make sense as sentence-start forms; usually only one).

Output: only a JSON array of strings. No preamble, no explanation, no code fences.`;

// ── Per-language build ─────────────────────────────────────────────────────

async function buildSkipWords(lang) {
  // Skip-words is a bulk translation + lookup task — no thinking needed.
  // Streaming just for long-output safety.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 8000,
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
          text: `English skip-word list (${englishSkipWords.length} entries, for reference — do not translate literally):
\`\`\`json
${JSON.stringify(englishSkipWords)}
\`\`\`

Produce the equivalent denylist for the target language, following all the rules in the system prompt.`,
          cache_control: { type: 'ephemeral', ttl: CACHE_TTL },
        },
        {
          type: 'text',
          text: `Target language: ${lang.name} (${lang.nativeName}).
Script: ${lang.script}.
Output only the JSON array of strings.`,
        },
      ],
    }],
  });

  const response = await stream.finalMessage();
  const text = joinTextBlocks(response);
  let arr;
  try {
    arr = JSON.parse(extractJson(text));
  } catch (e) {
    throw new Error(`Failed to parse skip-words JSON for ${lang.code}: ${e.message}\n--- raw output ---\n${text}\n--- end ---`);
  }

  if (!Array.isArray(arr)) {
    throw new Error(`Output for ${lang.code} is not a JSON array.`);
  }
  if (!arr.every((w) => typeof w === 'string' && w.length > 0)) {
    throw new Error(`Output for ${lang.code} contains non-string or empty entries.`);
  }

  const unique = [...new Set(arr)];

  // Sanity check — warn but don't fail if the list looks obviously wrong.
  if (unique.length < 50) {
    console.warn(`  WARN: ${lang.code} only has ${unique.length} words — that looks too small.`);
  }
  if (unique.length > 1000) {
    console.warn(`  WARN: ${lang.code} has ${unique.length} words — that looks too large.`);
  }

  logUsage(`skip-words/${lang.code}`, response.usage);
  return unique;
}

// ── Main ───────────────────────────────────────────────────────────────────

for (const lang of targets) {
  console.log(`\n=== ${lang.code} (${lang.nativeName}) ===`);
  const langDir = join(ROOT_DIR, 'i18n', lang.code);
  mkdirSync(langDir, { recursive: true });

  const words = await buildSkipWords(lang);
  writeFileSync(
    join(langDir, 'skip-words.json'),
    JSON.stringify(words, null, 2) + '\n',
  );
  console.log(`  wrote i18n/${lang.code}/skip-words.json (${words.length} words)`);
}

console.log(`\nDone. Built skip-words for ${targets.length} language(s).`);
