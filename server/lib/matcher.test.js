// wikilinker/lib/matcher.test.js
import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { EntityMatcher } from './matcher.js';

describe('EntityMatcher', () => {
  let matcher;

  before(() => {
    // Use a small test set (simple array of titles)
    const testEntities = [
      'Barack Obama', 'United States', 'New York', 'New York City',
      'Google', 'United Nations',
    ];
    matcher = new EntityMatcher(testEntities);
  });

  test('finds entities in text', () => {
    const matches = matcher.findMatches('the reporter met Barack Obama in New York City.');
    assert.ok(matches.some(m => m.text === 'Barack Obama'));
    assert.ok(matches.some(m => m.text === 'New York City'));
  });

  test('prefers longer matches', () => {
    const matches = matcher.findMatches('he flew to New York City last week.');
    assert.ok(matches.some(m => m.text === 'New York City'));
    assert.ok(!matches.some(m => m.text === 'New York'));
  });

  test('respects word boundaries', () => {
    const matches = matcher.findMatches('he Googled something');
    assert.ok(!matches.some(m => m.text === 'Google'));
  });

  test('returns match objects with text property', () => {
    const matches = matcher.findMatches('he works at Google now.');
    const googleMatch = matches.find(m => m.text === 'Google');
    assert.ok(googleMatch);
    assert.strictEqual(googleMatch.text, 'Google');
  });

  test('skips common words', () => {
    const matches = matcher.findMatches('The Monday meeting was great.');
    assert.strictEqual(matches.length, 0);
  });

  test('skips matches at sentence start', () => {
    const matches = matcher.findMatches('Google announced earnings. Barack Obama spoke.', true);
    assert.strictEqual(matches.length, 0);
    assert.ok(matches._debug.sentenceStart.length >= 1);
  });

  test('debug mode returns _debug with candidates', () => {
    const matches = matcher.findMatches('the reporter met Barack Obama in New York City.', true);
    assert.ok(matches._debug);
    assert.ok(Array.isArray(matches._debug.candidates));
    assert.ok(matches._debug.candidates.includes('Barack Obama'));
    assert.ok(matches._debug.candidates.includes('New York City'));
  });

  test('debug mode tracks unmatched candidates', () => {
    const matches = matcher.findMatches('the reporter met Barack Obama and Someone Unknown at Google.', true);
    assert.ok(matches._debug.unmatched.some(c => c === 'Someone Unknown' || c === 'Someone'));
  });

  test('debug mode tracks overlapped matches', () => {
    const overlapEntities = ['Barack Obama', 'Barack'];
    const overlapMatcher = new EntityMatcher(overlapEntities);
    const matches = overlapMatcher.findMatches('the reporter met Barack Obama today.', true);
    assert.ok(matches.some(m => m.text === 'Barack Obama'));
    assert.ok(matches._debug.overlapped.some(m => m.text === 'Barack'));
  });

  test('debug mode tracks part-of-larger-phrase skips', () => {
    const matches = matcher.findMatches('he flew to New York City today.', true);
    assert.ok(matches._debug.partOfLarger.length === 0);
    assert.ok(matches.some(m => m.text === 'New York City'));
  });

  test('no _debug property when debug is false', () => {
    const matches = matcher.findMatches('the reporter met Barack Obama.', false);
    assert.strictEqual(matches._debug, undefined);
  });

  test('no _debug property by default', () => {
    const matches = matcher.findMatches('the reporter met Barack Obama.');
    assert.strictEqual(matches._debug, undefined);
  });

  // Greedy/frugal regex tests
  test('greedy regex bridges filler words', () => {
    const candidates = matcher.extractCandidates('the President of the United States spoke.');
    assert.ok(candidates.has('President of the United States'));
  });

  test('greedy regex matches multi-word fillers like "Secretary of State"', () => {
    const extMatcher = new EntityMatcher(['Secretary of State']);
    const matches = extMatcher.findMatches('she served as Secretary of State last year.');
    assert.ok(matches.some(m => m.text === 'Secretary of State'));
  });

  test('frugal regex splits at fillers', () => {
    const candidates = matcher.extractCandidates('both Amnesty International and Human Rights Watch issued a statement.');
    assert.ok(candidates.has('Amnesty International'));
    assert.ok(candidates.has('Human Rights Watch'));
  });

  test('greedy match with filler trimming adds trimmed version', () => {
    const candidates = matcher.extractCandidates('he visited the United Nations headquarters.');
    assert.ok(candidates.has('United Nations'));
  });

  // Minimum length tests
  test('rejects short mixed-case single words (< 4 chars)', () => {
    const shortMatcher = new EntityMatcher(['In', 'So', 'It', 'As']);
    const matches = shortMatcher.findMatches('he said In some ways and So it goes.');
    assert.strictEqual(matches.length, 0);
  });

  test('accepts short ALL CAPS words (>= 2 chars)', () => {
    const acronymMatcher = new EntityMatcher(['UK', 'US', 'FBI', 'NATO']);
    const matches = acronymMatcher.findMatches('the UK and FBI worked with NATO.');
    assert.ok(matches.some(m => m.text === 'UK'));
    assert.ok(matches.some(m => m.text === 'FBI'));
  });

  test('accepts mixed-case single words >= 4 chars', () => {
    const matches = matcher.findMatches('the reporter visited Google headquarters.');
    assert.ok(matches.some(m => m.text === 'Google'));
  });

  test('multi-word phrases bypass minimum length', () => {
    const matches = matcher.findMatches('the reporter met Barack Obama yesterday.');
    assert.ok(matches.some(m => m.text === 'Barack Obama'));
  });

  // discoverEntities tests
  test('discoverEntities returns Map of entities', () => {
    const result = matcher.discoverEntities('the reporter met Barack Obama at the United Nations.');
    assert.ok(result.entities instanceof Map);
    assert.ok(result.entities.has('Barack Obama'));
    assert.ok(result.entities.has('United Nations'));
  });

  test('discoverEntities includes debug data when requested', () => {
    const result = matcher.discoverEntities('the reporter met Barack Obama at Google.', true);
    assert.ok(result.debugData);
    assert.ok(Array.isArray(result.debugData.candidates));
  });

  // findMatchesInText tests
  test('findMatchesInText finds known entities by position', () => {
    const knownEntities = new Map([['Barack Obama', true]]);
    const matches = matcher.findMatchesInText('the reporter met Barack Obama today.', knownEntities);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].text, 'Barack Obama');
  });

  test('findMatchesInText removes overlapping matches', () => {
    const knownEntities = new Map([['New York City', true], ['New York', true]]);
    const matches = matcher.findMatchesInText('he flew to New York City today.', knownEntities);
    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].text, 'New York City');
  });

  test('findMatchesInText skips sentence-start matches', () => {
    const knownEntities = new Map([['Barack Obama', true]]);
    const matches = matcher.findMatchesInText('Barack Obama spoke.', knownEntities);
    assert.strictEqual(matches.length, 0);
  });
});
