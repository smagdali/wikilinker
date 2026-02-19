import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BloomFilter } from './bloom.js';

describe('BloomFilter', () => {
  it('stores and retrieves values', () => {
    const bf = BloomFilter.create(1000, 0.01);
    bf.add('hello');
    bf.add('world');
    assert.equal(bf.has('hello'), true);
    assert.equal(bf.has('world'), true);
  });

  it('returns false for absent values (probabilistic)', () => {
    const bf = BloomFilter.create(100, 0.001);
    bf.add('hello');
    // Very unlikely to get false positives on these at 0.1% FP rate
    let fps = 0;
    const tests = ['xyz', 'abc', 'nothere', 'missing', 'absent'];
    for (const t of tests) {
      if (bf.has(t)) fps++;
    }
    assert.ok(fps <= 1, `Expected <=1 false positives, got ${fps}`);
  });

  it('serializes and deserializes correctly', () => {
    const bf = BloomFilter.create(1000, 0.01);
    bf.add('Barack Obama');
    bf.add('United Kingdom');
    bf.add('NATO');

    const data = bf.serialize();
    const bf2 = BloomFilter.deserialize(data);

    assert.equal(bf2.has('Barack Obama'), true);
    assert.equal(bf2.has('United Kingdom'), true);
    assert.equal(bf2.has('NATO'), true);
    assert.equal(bf2.m, bf.m);
    assert.equal(bf2.k, bf.k);
  });

  it('calculates correct parameters', () => {
    const bf = BloomFilter.create(1000000, 0.0001);
    // m should be ~19.2M bits
    assert.ok(bf.m > 19000000 && bf.m < 20000000, `m=${bf.m}`);
    // k should be ~13
    assert.equal(bf.k, 13);
  });
});
