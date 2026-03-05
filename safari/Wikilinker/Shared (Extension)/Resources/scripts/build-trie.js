#!/usr/bin/env node

/**
 * Build a compressed trie (prefix tree) from entity data
 *
 * Compares memory usage between:
 * 1. Plain JSON object (current)
 * 2. Trie (prefix tree)
 * 3. Packed Format (delta-encoded sorted labels)
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DATA_DIR = path.join(__dirname, '..', 'data');
const INPUT_FILE = path.join(DATA_DIR, 'entities.json');

// ============================================
// Data Structure 1: Plain Object (current)
// ============================================
function buildPlainObject(entities) {
  return entities;
}

// ============================================
// Data Structure 2: Trie (Prefix Tree)
// ============================================
function buildTrie(entities) {
  const root = {};

  for (const [label, value] of Object.entries(entities)) {
    let node = root;
    for (const char of label) {
      if (!node[char]) {
        node[char] = {};
      }
      node = node[char];
    }
    node['$'] = value;
  }

  return root;
}

// Lookup function for trie
function trieLookup(trie, label) {
  let node = trie;
  for (const char of label) {
    if (!node[char]) return null;
    node = node[char];
  }
  return node['$'] || null;
}

// ============================================
// Data Structure 3: Packed Format (delta-encoded)
// ============================================
function buildPackedFormat(entities) {
  const sortedLabels = Object.keys(entities).sort();
  const values = sortedLabels.map(l => entities[l]);

  // Delta-encode labels
  const deltas = [];
  let prevLabel = '';

  for (const label of sortedLabels) {
    let common = 0;
    while (common < prevLabel.length && common < label.length &&
           prevLabel[common] === label[common]) {
      common++;
    }
    deltas.push([common, label.slice(common)]);
    prevLabel = label;
  }

  return { d: deltas, v: values };
}

// Reconstruct labels from packed format (for lookup)
function unpackLabels(packed) {
  const labels = [];
  let current = '';

  for (const [common, suffix] of packed.d) {
    current = current.slice(0, common) + suffix;
    labels.push(current);
  }

  return labels;
}

// Binary search lookup for packed format
function packedLookup(packed, searchLabel, labels = null) {
  if (!labels) labels = unpackLabels(packed);

  let lo = 0, hi = labels.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const cmp = labels[mid].localeCompare(searchLabel);
    if (cmp === 0) return packed.v[mid];
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

// ============================================
// Data Structure 4: Minimal Trie (single-char keys, array values)
// ============================================
function buildMinimalTrie(entities) {
  // Use shorter keys and pack structure tighter
  const root = {};

  for (const [label, value] of Object.entries(entities)) {
    if (!value || !Array.isArray(value)) continue;
    const [typeCode, qid] = value;
    let node = root;
    for (let i = 0; i < label.length; i++) {
      const char = label[i];
      if (!node[char]) node[char] = {};
      node = node[char];
    }
    // Store value more compactly: "1:Q123" instead of [1, "Q123"]
    node._ = `${typeCode}:${qid}`;
  }

  return root;
}

// ============================================
// Data Structure 5: Double-Array Trie (very compact)
// ============================================
function buildDoubleArrayTrie(entities) {
  // Sort labels for better compression
  const sortedLabels = Object.keys(entities).sort();

  // Build a mapping of labels to indices
  const labelToIdx = new Map();
  sortedLabels.forEach((l, i) => labelToIdx.set(l, i));

  // Values array (parallel to sorted labels)
  const values = sortedLabels.map(l => entities[l]);

  // For fast lookup, also build a simple hash of first 2 chars -> label indices
  const prefixIndex = {};
  for (let i = 0; i < sortedLabels.length; i++) {
    const prefix = sortedLabels[i].slice(0, 2);
    if (!prefixIndex[prefix]) {
      prefixIndex[prefix] = [i, i]; // [start, end] range
    } else {
      prefixIndex[prefix][1] = i;
    }
  }

  return {
    labels: sortedLabels,
    values,
    prefixIndex
  };
}

// ============================================
// Measurement utilities
// ============================================
function measureSize(data, name) {
  const jsonStr = JSON.stringify(data);
  const rawSize = Buffer.byteLength(jsonStr, 'utf8');
  const gzipped = zlib.gzipSync(jsonStr, { level: 9 });
  const gzSize = gzipped.length;

  return {
    name,
    raw: rawSize,
    gzip: gzSize,
    rawMB: (rawSize / 1024 / 1024).toFixed(2),
    gzipMB: (gzSize / 1024 / 1024).toFixed(2),
  };
}

function formatTable(results) {
  console.log('\n┌─────────────────────────────┬────────────┬────────────┬──────────┐');
  console.log('│ Data Structure              │ Raw Size   │ Gzipped    │ Savings  │');
  console.log('├─────────────────────────────┼────────────┼────────────┼──────────┤');

  const baseline = results[0].gzip;

  for (const r of results) {
    const savings = ((1 - r.gzip / baseline) * 100).toFixed(1);
    const savingsStr = r === results[0] ? 'baseline' : `${savings}%`;
    console.log(`│ ${r.name.padEnd(27)} │ ${r.rawMB.padStart(7)} MB │ ${r.gzipMB.padStart(7)} MB │ ${savingsStr.padStart(8)} │`);
  }

  console.log('└─────────────────────────────┴────────────┴────────────┴──────────┘');
}

// ============================================
// Main
// ============================================
async function main() {
  console.log('Loading entity data...');
  const entities = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  const entityCount = Object.keys(entities).length;
  console.log(`Loaded ${entityCount.toLocaleString()} entities\n`);

  console.log('Building data structures...');

  const structures = [
    { name: 'Plain Object (current)', build: buildPlainObject },
    { name: 'Trie', build: buildTrie },
    { name: 'Packed (delta-encoded)', build: buildPackedFormat },
    { name: 'Double-Array + Prefix Idx', build: buildDoubleArrayTrie },
  ];

  const results = [];
  const built = {};

  for (const { name, build } of structures) {
    process.stdout.write(`  Building ${name}...`);
    const start = Date.now();
    const data = build(entities);
    const elapsed = Date.now() - start;
    console.log(` ${elapsed}ms`);

    results.push(measureSize(data, name));
    built[name] = data;
  }

  formatTable(results);

  // Find best
  const bestIdx = results.reduce((best, r, i) =>
    r.gzip < results[best].gzip ? i : best, 0);
  console.log(`\n✓ Best compression: ${results[bestIdx].name} (${results[bestIdx].gzipMB} MB)`);

  // Test lookup correctness
  console.log('\nVerifying lookups...');
  const testLabels = ['United States', 'London', 'Joe Biden', 'Google', 'NonExistent'];

  for (const label of testLabels) {
    const expected = entities[label] || null;
    const fromTrie = trieLookup(built['Trie'], label);
    const fromPacked = packedLookup(built['Packed (delta-encoded)'], label);

    const trieOk = JSON.stringify(fromTrie) === JSON.stringify(expected);
    const packedOk = JSON.stringify(fromPacked) === JSON.stringify(expected);

    console.log(`  "${label}": trie=${trieOk ? '✓' : '✗'} packed=${packedOk ? '✓' : '✗'}`);
  }

  // Save formats
  console.log('\nSaving to data/ directory...');

  fs.writeFileSync(
    path.join(DATA_DIR, 'entities-trie.json'),
    JSON.stringify(built['Trie'])
  );
  console.log('  ✓ entities-trie.json');

  fs.writeFileSync(
    path.join(DATA_DIR, 'entities-packed.json'),
    JSON.stringify(built['Packed (delta-encoded)'])
  );
  console.log('  ✓ entities-packed.json');

  // Also save gzipped versions
  fs.writeFileSync(
    path.join(DATA_DIR, 'entities-trie.json.gz'),
    zlib.gzipSync(JSON.stringify(built['Trie']), { level: 9 })
  );
  fs.writeFileSync(
    path.join(DATA_DIR, 'entities-packed.json.gz'),
    zlib.gzipSync(JSON.stringify(built['Packed (delta-encoded)']), { level: 9 })
  );
  console.log('  ✓ Gzipped versions saved');
}

main().catch(console.error);
