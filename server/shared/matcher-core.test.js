import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKIP_WORDS, extractCandidates, findMatches, toWikiUrl, meetsMinLength } from './matcher-core.js';

// ── SKIP_WORDS ──────────────────────────────────────────────

test('SKIP_WORDS is a Set loaded from i18n/en/skip-words.json', () => {
  assert.ok(SKIP_WORDS instanceof Set);
  assert.ok(SKIP_WORDS.size > 200, `expected > 200 skip words, got ${SKIP_WORDS.size}`);
});

test('SKIP_WORDS contains expected categories', () => {
  assert.ok(SKIP_WORDS.has('The'));
  assert.ok(SKIP_WORDS.has('Monday'));
  assert.ok(SKIP_WORDS.has('American'));
  assert.ok(SKIP_WORDS.has('Getty'));
});

test('SKIP_WORDS does not contain real entities', () => {
  assert.ok(!SKIP_WORDS.has('London'));
  assert.ok(!SKIP_WORDS.has('Gaza'));
  assert.ok(!SKIP_WORDS.has('NATO'));
});

// ── Unicode regex (Task 7) ──────────────────────────────────

test('extractCandidates matches Russian (Cyrillic) uppercase names', () => {
  const candidates = extractCandidates('Владимир Путин выступил в Москве.');
  assert.ok(candidates.has('Владимир'), `expected Владимир, got ${[...candidates].join(',')}`);
  assert.ok(candidates.has('Путин'));
  assert.ok(candidates.has('Москве'));
});

test('extractCandidates matches German umlauts and diacritics', () => {
  const candidates = extractCandidates('The meeting was held in München with Angela Merkel.');
  assert.ok(candidates.has('München'));
  assert.ok(candidates.has('Angela Merkel'));
});

test('extractCandidates matches Turkish dotted I', () => {
  const candidates = extractCandidates('They travelled to İstanbul last week.');
  assert.ok(candidates.has('İstanbul'));
});

test('extractCandidates matches Czech diacritics', () => {
  const candidates = extractCandidates('She visited Český Krumlov during her trip.');
  assert.ok(candidates.has('Český Krumlov'));
});

test('extractCandidates matches French accented names', () => {
  const candidates = extractCandidates('The book by Émile Zola was a classic about Paris.');
  assert.ok(candidates.has('Émile Zola'));
});

test('meetsMinLength treats Cyrillic all-caps as acronym', () => {
  assert.ok(meetsMinLength('МГУ'));   // 3 cyrillic caps → acronym
  assert.ok(!meetsMinLength('МГ'));    // 2 cyrillic caps → rejected
});

// ── toWikiUrl with lang (Task 8) ────────────────────────────

test('toWikiUrl defaults to English Wikipedia', () => {
  assert.equal(toWikiUrl('Albert Einstein'), 'https://en.wikipedia.org/wiki/Albert_Einstein');
});

test('toWikiUrl respects lang parameter', () => {
  assert.equal(toWikiUrl('Albert Einstein', 'fr'), 'https://fr.wikipedia.org/wiki/Albert_Einstein');
  assert.equal(toWikiUrl('Albert Einstein', 'es'), 'https://es.wikipedia.org/wiki/Albert_Einstein');
  assert.equal(toWikiUrl('Albert Einstein', 'de'), 'https://de.wikipedia.org/wiki/Albert_Einstein');
});

test('toWikiUrl encodes special characters', () => {
  assert.equal(toWikiUrl("Côte d'Ivoire", 'fr'), "https://fr.wikipedia.org/wiki/C%C3%B4te_d'Ivoire");
});

// ── Injectable skip words (Task 9) ──────────────────────────

test('extractCandidates uses custom skip words when provided', () => {
  const customSkip = new Set(['Einstein']);
  const candidates = extractCandidates('Albert Einstein taught physics.', { skipWords: customSkip });
  assert.ok(!candidates.has('Einstein'), 'Einstein should be skipped when in custom list');
  // But the multi-word "Albert Einstein" can still appear (it's a different candidate)
  assert.ok(candidates.has('Albert Einstein') || candidates.has('Albert'));
});

test('findMatches accepts custom skipWords in options', () => {
  const entitySet = new Set(['Einstein', 'Curie']);
  const customSkip = new Set(['Einstein']);
  // Sentence-start filter means we need a prefix
  const matches = findMatches('It was Einstein who taught Curie. Physics is great.', entitySet, { skipWords: customSkip });
  const names = matches.map(m => m.text);
  assert.ok(!names.includes('Einstein'), 'Einstein should be skipped');
});
