// wikilinker/lib/cache.test.js
import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { Cache } from './cache.js';

describe('Cache', () => {
  let testDir;
  let cache;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `cache-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    cache = new Cache({ dir: testDir, maxSize: 1024 }); // 1KB for testing
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  test('stores and retrieves values', async () => {
    await cache.set('key1', 'value1');
    const result = await cache.get('key1');
    assert.strictEqual(result, 'value1');
  });

  test('returns null for missing keys', async () => {
    const result = await cache.get('nonexistent');
    assert.strictEqual(result, null);
  });

  test('evicts oldest entries when size exceeded', async () => {
    // Fill cache with 500 bytes each (exceeds 1KB limit)
    await cache.set('key1', 'x'.repeat(500));
    await cache.set('key2', 'y'.repeat(500));
    await cache.set('key3', 'z'.repeat(500)); // Should evict key1

    const result1 = await cache.get('key1');
    const result3 = await cache.get('key3');

    assert.strictEqual(result1, null); // Evicted
    assert.strictEqual(result3, 'z'.repeat(500)); // Still present
  });
});
