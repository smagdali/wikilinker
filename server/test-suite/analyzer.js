// wikilinker/test-suite/analyzer.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUNDS_DIR = path.join(__dirname, 'rounds');

function normalizeSelectorPath(selectorPath) {
  return selectorPath
    .replace(/\.[a-zA-Z0-9_-]+/g, '')
    .replace(/\[role="([^"]+)"\]/g, '[$1]')
    .replace(/\s+/g, ' ')
    .trim();
}

function clusterByPattern(incorrectLinks) {
  const clusters = new Map();

  for (const link of incorrectLinks) {
    const pattern = normalizeSelectorPath(link.selectorPath);

    if (!clusters.has(pattern)) {
      clusters.set(pattern, {
        pattern,
        count: 0,
        sites: new Set(),
        examples: [],
      });
    }

    const cluster = clusters.get(pattern);
    cluster.count++;
    cluster.sites.add(link.site);

    if (cluster.examples.length < 3) {
      cluster.examples.push({
        entity: link.entity,
        url: link.url,
        textContext: link.textContext,
      });
    }
  }

  return Array.from(clusters.values())
    .map(c => ({ ...c, sites: Array.from(c.sites) }))
    .sort((a, b) => b.count - a.count);
}

async function main() {
  const roundArg = process.argv.find(a => a.startsWith('--round='));
  const round = roundArg ? parseInt(roundArg.split('=')[1]) : 0;

  console.log(`Wikilinker Test Suite - Analyzer (Round ${round})`);
  console.log('='.repeat(60));

  const resultsPath = path.join(ROUNDS_DIR, `results-round-${round}.json`);
  let results;
  try {
    results = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
  } catch {
    console.error(`No results found for round ${round}. Run runner first.`);
    process.exit(1);
  }

  const incorrectLinks = [];
  for (const page of results) {
    for (const link of page.wikilinks || []) {
      if (!link.isCorrect) {
        incorrectLinks.push({
          ...link,
          site: page.site,
          url: page.url,
        });
      }
    }
  }

  console.log(`\nTotal incorrect links: ${incorrectLinks.length}\n`);

  const clusters = clusterByPattern(incorrectLinks);

  console.log('Pattern Analysis:');
  console.log('-'.repeat(60));

  for (const cluster of clusters.slice(0, 20)) {
    console.log(`\n${cluster.pattern}`);
    console.log(`  Count: ${cluster.count} across ${cluster.sites.length} sites`);
    console.log(`  Sites: ${cluster.sites.slice(0, 5).join(', ')}${cluster.sites.length > 5 ? '...' : ''}`);
    console.log(`  Examples:`);
    for (const ex of cluster.examples) {
      console.log(`    - "${ex.entity}" in ${ex.textContext.slice(0, 50)}`);
    }
  }

  const summary = {
    round,
    totalPages: results.length,
    totalCorrect: results.reduce((sum, p) => sum + (p.stats?.correct || 0), 0),
    totalIncorrect: incorrectLinks.length,
    clusters: clusters.slice(0, 50),
  };

  const summaryPath = path.join(ROUNDS_DIR, `summary-round-${round}.json`);
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Summary saved to: ${summaryPath}`);
}

main().catch(console.error);
