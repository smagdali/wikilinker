// scripts/lib/i18n-translate.mjs
//
// Shared helpers for the Claude-powered translation scripts:
//   scripts/translate-strings.mjs  (messages + store listing)
//   scripts/build-skip-words.mjs   (skip-word denylist)
//
// Prompt-caching note: both scripts follow the same pattern. A stable system
// prompt + a stable user-message block carry `cache_control: { ttl: "1h" }`,
// and the only varying bit (target language name) is appended in a separate
// user block *after* the last breakpoint. Running 19 languages sequentially
// writes the cache once and reads it 18 times.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';

export const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MODEL = 'claude-sonnet-4-6';
export const CACHE_TTL = '1h';  // 2x write, 0.1x read — breaks even at 3+ reads

export function loadLanguagesConfig() {
  return JSON.parse(readFileSync(join(ROOT_DIR, 'i18n/languages.json'), 'utf8')).languages;
}

// Parse --lang <code> or --all-langs from argv. Returns an array of language
// config objects (excluding English) or null if no valid selection was made.
export function resolveTargetLangs(args) {
  const langs = loadLanguagesConfig();

  if (args.includes('--all-langs')) {
    return langs.filter((l) => l.code !== 'en');
  }

  const i = args.indexOf('--lang');
  if (i < 0 || !args[i + 1]) return null;

  const code = args[i + 1];
  const lang = langs.find((l) => l.code === code);
  if (!lang) {
    console.error(`Unknown lang: ${code}`);
    console.error(`Known: ${langs.map((l) => l.code).join(', ')}`);
    process.exit(1);
  }
  return [lang];
}

export function printUsageAndExit(scriptName) {
  console.error(`Usage: node scripts/${scriptName} --lang <code> | --all-langs`);
  console.error('');
  console.error('Requires ANTHROPIC_API_KEY in the environment.');
  process.exit(1);
}

export function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY is not set.');
    process.exit(1);
  }
  return new Anthropic();
}

// Strip optional markdown code fences that Claude sometimes wraps JSON in.
export function extractJson(text) {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/.exec(trimmed);
  return fenced ? fenced[1].trim() : trimmed;
}

// Join all text content blocks from a Message. Thinking blocks are dropped —
// they are model-internal and never part of the translation output.
export function joinTextBlocks(message) {
  return message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

// Print a one-line usage summary so callers can see cache hits as runs progress.
export function logUsage(label, usage) {
  const reads = usage.cache_read_input_tokens ?? 0;
  const writes = usage.cache_creation_input_tokens ?? 0;
  const inputs = usage.input_tokens ?? 0;
  const outputs = usage.output_tokens ?? 0;
  const cacheHit = reads > 0 ? 'HIT' : writes > 0 ? 'WRITE' : 'miss';
  console.log(
    `  [${cacheHit}] ${label}: in=${inputs} out=${outputs} cache_read=${reads} cache_write=${writes}`,
  );
}
