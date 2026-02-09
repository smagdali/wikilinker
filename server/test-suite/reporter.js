// wikilinker/test-suite/reporter.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUNDS_DIR = path.join(__dirname, 'rounds');

function linkKey(link, url) {
  return `${link.wikidataId}|${url}|${link.textContext?.slice(0, 50)}`;
}

function compareRounds(prevResults, currResults) {
  const prevLinks = new Map();
  const currLinks = new Map();

  for (const page of prevResults) {
    for (const link of page.wikilinks || []) {
      const key = linkKey(link, page.url);
      prevLinks.set(key, { ...link, url: page.url, site: page.site });
    }
  }

  for (const page of currResults) {
    for (const link of page.wikilinks || []) {
      const key = linkKey(link, page.url);
      currLinks.set(key, { ...link, url: page.url, site: page.site });
    }
  }

  const fixed = [];
  const regressed = [];
  const newCorrect = [];
  const newIncorrect = [];
  const unchangedCorrect = [];
  const unchangedIncorrect = [];

  for (const [key, curr] of currLinks) {
    const prev = prevLinks.get(key);

    if (!prev) {
      if (curr.isCorrect) newCorrect.push(curr);
      else newIncorrect.push(curr);
    } else if (!prev.isCorrect && curr.isCorrect) {
      fixed.push(curr);
    } else if (prev.isCorrect && !curr.isCorrect) {
      regressed.push(curr);
    } else if (curr.isCorrect) {
      unchangedCorrect.push(curr);
    } else {
      unchangedIncorrect.push(curr);
    }
  }

  return { fixed, regressed, newCorrect, newIncorrect, unchangedCorrect, unchangedIncorrect };
}

async function main() {
  const roundArg = process.argv.find(a => a.startsWith('--round='));
  const round = roundArg ? parseInt(roundArg.split('=')[1]) : 1;

  if (round < 1) {
    console.log('Round 0 is the baseline - no comparison available.');
    process.exit(0);
  }

  console.log(`Wikilinker Test Suite - Reporter (Round ${round} vs ${round - 1})`);
  console.log('='.repeat(60));

  const prevPath = path.join(ROUNDS_DIR, `results-round-${round - 1}.json`);
  const currPath = path.join(ROUNDS_DIR, `results-round-${round}.json`);

  let prevResults, currResults;
  try {
    prevResults = JSON.parse(await fs.readFile(prevPath, 'utf-8'));
    currResults = JSON.parse(await fs.readFile(currPath, 'utf-8'));
  } catch (error) {
    console.error(`Missing results file: ${error.message}`);
    process.exit(1);
  }

  const comparison = compareRounds(prevResults, currResults);

  console.log(`\nRound ${round} vs Round ${round - 1}:`);
  console.log('─'.repeat(60));
  console.log(`✅ Fixed:              ${comparison.fixed.length} links`);
  console.log(`❌ Regressed:          ${comparison.regressed.length} links`);
  console.log(`➕ New (correct):      ${comparison.newCorrect.length} links`);
  console.log(`➖ New (incorrect):    ${comparison.newIncorrect.length} links`);
  console.log(`⚪ Unchanged correct:  ${comparison.unchangedCorrect.length} links`);
  console.log(`⚪ Unchanged incorrect: ${comparison.unchangedIncorrect.length} links`);

  const netImprovement = comparison.fixed.length - comparison.regressed.length;
  console.log('─'.repeat(60));
  console.log(`Net improvement: ${netImprovement >= 0 ? '+' : ''}${netImprovement} links`);

  if (comparison.regressed.length > 0) {
    console.log(`\n⚠️  REGRESSIONS DETECTED:`);
    for (const link of comparison.regressed.slice(0, 10)) {
      console.log(`  - "${link.entity}" at ${link.selectorPath}`);
      console.log(`    URL: ${link.url}`);
    }
    if (comparison.regressed.length > 10) {
      console.log(`  ... and ${comparison.regressed.length - 10} more`);
    }
  }

  const report = {
    round,
    comparedTo: round - 1,
    summary: {
      fixed: comparison.fixed.length,
      regressed: comparison.regressed.length,
      newCorrect: comparison.newCorrect.length,
      newIncorrect: comparison.newIncorrect.length,
      unchangedCorrect: comparison.unchangedCorrect.length,
      unchangedIncorrect: comparison.unchangedIncorrect.length,
      netImprovement,
    },
    regressions: comparison.regressed,
    fixes: comparison.fixed.slice(0, 100),
  };

  const reportPath = path.join(ROUNDS_DIR, `regression-round-${round}.json`);
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  console.log(`\nReport saved to: ${reportPath}`);
}

main().catch(console.error);
