import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKIP_WORDS } from './matcher-core.js';

test('SKIP_WORDS is a Set loaded from i18n/en/skip-words.json', () => {
  assert.ok(SKIP_WORDS instanceof Set);
  assert.ok(SKIP_WORDS.size > 200, `expected > 200 skip words, got ${SKIP_WORDS.size}`);
});

test('SKIP_WORDS contains expected categories', () => {
  // Pronouns
  assert.ok(SKIP_WORDS.has('The'));
  assert.ok(SKIP_WORDS.has('This'));
  // Days and months
  assert.ok(SKIP_WORDS.has('Monday'));
  assert.ok(SKIP_WORDS.has('January'));
  // Demonyms
  assert.ok(SKIP_WORDS.has('American'));
  assert.ok(SKIP_WORDS.has('British'));
  // Stock photo attributions
  assert.ok(SKIP_WORDS.has('Getty'));
  assert.ok(SKIP_WORDS.has('Alamy'));
});

test('SKIP_WORDS does not contain real entities', () => {
  assert.ok(!SKIP_WORDS.has('London'));
  assert.ok(!SKIP_WORDS.has('Gaza'));
  assert.ok(!SKIP_WORDS.has('NATO'));
});
