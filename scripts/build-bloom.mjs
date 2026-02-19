#!/usr/bin/env node
//
// Build a bloom filter from the top N ranked Wikipedia titles.
//
// Usage: node scripts/build-bloom.mjs [--count 1000000] [--fp 0.0001]
//
// Outputs: server/shared/entities-bloom.bin

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BloomFilter } from '../server/shared/bloom.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse args
const args = process.argv.slice(2);
const getArg = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};

const count = parseInt(getArg('--count', '1000000'), 10);
const fpRate = parseFloat(getArg('--fp', '0.0001'));
const titlesPath = join(__dirname, '..', '..', 'whitelabel.org', 'wikiproxy-data', 'titles-ranked.tsv');
const outPath = join(__dirname, '..', 'server', 'shared', 'entities-bloom.bin');

console.log(`Reading titles from: ${titlesPath}`);
const lines = readFileSync(titlesPath, 'utf8').split('\n').filter(l => l.length > 0);
console.log(`Total ranked titles: ${lines.length.toLocaleString()}`);

const titles = lines.slice(0, count).map(line => line.split('\t')[0]);
console.log(`Using top ${titles.length.toLocaleString()} titles`);

console.log(`Creating bloom filter (FP rate: ${fpRate * 100}%)...`);
const bloom = BloomFilter.create(titles.length, fpRate);
console.log(`  m = ${bloom.m.toLocaleString()} bits (${(bloom.m / 8 / 1024 / 1024).toFixed(2)} MB)`);
console.log(`  k = ${bloom.k} hash functions`);

for (const title of titles) {
  bloom.add(title);
}

// Verify a sample
let fpCount = 0;
const testWords = ['xyzzy', 'notarealpage', 'asdfghjkl', 'zzzzzzz', 'qwertyuiop'];
for (const w of testWords) {
  if (bloom.has(w)) fpCount++;
}

// Verify all titles are found (no false negatives)
let fnCount = 0;
for (const title of titles) {
  if (!bloom.has(title)) fnCount++;
}
console.log(`\nVerification:`);
console.log(`  False negatives: ${fnCount} (should be 0)`);
console.log(`  Sample FP check: ${fpCount}/${testWords.length} random words matched`);

const data = bloom.serialize();
writeFileSync(outPath, data);
console.log(`\nWritten: ${outPath}`);
console.log(`  File size: ${(data.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Titles: ${titles.length.toLocaleString()}`);
