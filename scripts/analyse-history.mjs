#!/usr/bin/env node
//
// Batch-analyse browser history URLs for entity matching quality.
//
// Usage:
//   node scripts/analyse-history.mjs urls.txt              # one URL per line
//   node scripts/analyse-history.mjs urls.csv              # CSV with URL column
//   node scripts/analyse-history.mjs urls.json             # Chrome history JSON
//   node scripts/analyse-history.mjs urls.txt -o results   # output dir (default: ./analysis)
//
// Outputs per-site TSV files (same format as extension --debug) plus a
// summary.tsv of all matched candidates across all pages.

import { readFileSync, copyFileSync, existsSync } from 'node:fs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { homedir } from 'node:os';
import { extractWithReadability } from '../server/lib/readability.js';
import {
  extractCandidates,
  normaliseCurlyQuotes,
  escapeRegExp,
  isSentenceStart,
  isPartOfLargerPhrase,
  meetsMinLength,
  SKIP_WORDS,
} from '../server/shared/matcher-core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load entities ───────────────────────────────────────────

const entitiesPath = join(__dirname, '..', 'server', 'shared', 'entities.json');
const entitySet = new Set(JSON.parse(readFileSync(entitiesPath, 'utf8')));
console.log(`Loaded ${entitySet.size} entities`);

// ── Parse arguments ─────────────────────────────────────────

const args = process.argv.slice(2);
const inputFile = args.find(a => !a.startsWith('-') && a !== 'brave' && a !== 'chrome');
const browserArg = args.find(a => a === 'brave' || a === 'chrome');
const outDirIdx = args.indexOf('-o');
const outDir = outDirIdx !== -1 ? args[outDirIdx + 1] : './analysis';
const limitIdx = args.indexOf('-n');
const urlLimit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 500;

if (!inputFile && !browserArg) {
  console.error(`Usage:
  node scripts/analyse-history.mjs <urls-file> [-o output-dir] [-n limit]
  node scripts/analyse-history.mjs brave [-o output-dir] [-n limit]
  node scripts/analyse-history.mjs chrome [-o output-dir] [-n limit]`);
  process.exit(1);
}

// ── Read browser history directly from SQLite ───────────────

function readBrowserHistory(browser, limit) {
  const paths = {
    brave: join(homedir(), 'Library/Application Support/BraveSoftware/Brave-Browser/Default/History'),
    chrome: join(homedir(), 'Library/Application Support/Google/Chrome/Default/History'),
  };

  const dbPath = paths[browser];
  if (!dbPath || !existsSync(dbPath)) {
    console.error(`${browser} history database not found at ${dbPath}`);
    process.exit(1);
  }

  // Copy to avoid lock issues if browser is running
  const tmpDb = '/tmp/claude/browser-history.db';
  const tmpOut = '/tmp/claude/browser-history-urls.txt';
  mkdirSync('/tmp/claude', { recursive: true });
  copyFileSync(dbPath, tmpDb);

  const query = `SELECT url FROM urls WHERE url LIKE 'http%' ORDER BY last_visit_time DESC LIMIT ${limit}`;
  execSync(`sqlite3 "${tmpDb}" "${query}" > "${tmpOut}"`, { encoding: 'utf8' });

  const output = readFileSync(tmpOut, 'utf8');
  const urls = new Set();
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('http')) urls.add(trimmed);
  }
  return [...urls];
}

// ── Parse URLs from input file ──────────────────────────────

function parseUrls(file) {
  const content = readFileSync(file, 'utf8');
  const ext = extname(file).toLowerCase();
  const urls = new Set();

  if (ext === '.json') {
    // Chrome history export or array of objects with url field
    const data = JSON.parse(content);
    const items = Array.isArray(data) ? data : data.Browser?.History || [];
    for (const item of items) {
      const url = typeof item === 'string' ? item : item.url || item.URL;
      if (url?.startsWith('http')) urls.add(url);
    }
  } else if (ext === '.csv') {
    // CSV — find column containing URLs
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/https?:\/\/[^\s,"""]+/);
      if (match) urls.add(match[0].replace(/["']+$/, ''));
    }
  } else {
    // Plain text — one URL per line
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('http')) urls.add(trimmed);
    }
  }

  return [...urls];
}

// ── Matching pipeline (mirrors extension DEBUG block) ───────

function ruleOf(candidate) {
  if (candidate.includes(' ')) return 'multi-word';
  if (/^[A-Z]+$/.test(candidate)) return 'acronym';
  return 'single-word';
}

function contextOf(text, candidate) {
  const idx = text.indexOf(candidate);
  if (idx === -1) return '';
  const before = text.slice(Math.max(0, idx - 20), idx);
  const after = text.slice(idx + candidate.length, idx + candidate.length + 20);
  return `${before}[${candidate}]${after}`.replace(/[\t\n\r]/g, ' ');
}

function analyseText(text) {
  const normalised = normaliseCurlyQuotes(text);
  const candidates = extractCandidates(normalised);
  const rows = [];

  // First pass: collect entity matches with positions
  const matches = [];
  for (const candidate of candidates) {
    if (!entitySet.has(candidate)) continue;
    matches.push({ text: candidate });
  }
  matches.sort((a, b) => b.text.length - a.text.length);

  const usedRanges = [];
  const matchedSet = new Set();

  for (const match of matches) {
    const regex = new RegExp(`\\b${escapeRegExp(match.text)}\\b`);
    const found = regex.exec(normalised);
    if (!found) continue;

    const start = found.index;
    const end = start + match.text.length;
    const overlaps = usedRanges.some(([s, e]) =>
      (start >= s && start < e) || (end > s && end <= e) || (start <= s && end >= e)
    );

    if (overlaps) {
      rows.push({ candidate: match.text, rule: ruleOf(match.text), status: 'overlapped', context: contextOf(normalised, match.text) });
    } else if (isPartOfLargerPhrase(normalised, start, end)) {
      rows.push({ candidate: match.text, rule: ruleOf(match.text), status: 'part-of-larger', context: contextOf(normalised, match.text) });
    } else if (isSentenceStart(normalised, start)) {
      rows.push({ candidate: match.text, rule: ruleOf(match.text), status: 'sentence-start', context: contextOf(normalised, match.text) });
    } else {
      rows.push({ candidate: match.text, rule: ruleOf(match.text), status: 'matched', context: contextOf(normalised, match.text) });
      usedRanges.push([start, end]);
      matchedSet.add(match.text);
    }
  }

  // Second pass: report non-matches
  for (const candidate of candidates) {
    if (matchedSet.has(candidate)) continue;
    if (matches.some(m => m.text === candidate)) continue; // already reported
    const rule = ruleOf(candidate);
    if (SKIP_WORDS.has(candidate)) {
      rows.push({ candidate, rule, status: 'skip-word', context: contextOf(normalised, candidate) });
    } else {
      rows.push({ candidate, rule, status: 'no-match', context: contextOf(normalised, candidate) });
    }
  }

  return rows;
}

// ── Fetch and process ───────────────────────────────────────

async function fetchPage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Wikilinker/0.5)' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('html')) return null;
    return await resp.text();
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

function hostnameSlug(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').replace(/\./g, '-');
  } catch { return 'unknown'; }
}

// ── URL filtering ───────────────────────────────────────────

// Sites that never produce useful article content
const SKIP_HOSTS = [
  'google.com', 'google.co.uk', 'accounts.google.com', 'docs.google.com',
  'drive.google.com', 'calendar.google.com', 'mail.google.com',
  'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr',
  'wikipedia.org', 'wikimedia.org',
  'github.com', 'gitlab.com', 'bitbucket.org',
  'youtube.com', 'youtu.be',
  'zoom.us', 'zoom.com',
  'teams.microsoft.com', 'outlook.live.com', 'login.microsoftonline.com',
  'localhost', '127.0.0.1',
  'slack.com', 'discord.com', 'discord.gg',
  'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'linkedin.com',
  'claude.ai', 'platform.claude.com', 'chatgpt.com', 'chat.openai.com',
  'notion.so', 'figma.com', 'canva.com',
  'stripe.com', 'paypal.com',
  'icloud.com', 'apple.com',
];

function shouldSkipUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return SKIP_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
  } catch { return true; }
}

// Keep only one URL per hostname+path (strip query strings for dedup)
function deduplicateUrls(urls) {
  const seen = new Set();
  const result = [];
  for (const url of urls) {
    try {
      const u = new URL(url);
      const key = u.hostname + u.pathname;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(url);
      }
    } catch { /* skip */ }
  }
  return result;
}

// ── Main ────────────────────────────────────────────────────

const rawUrls = browserArg
  ? readBrowserHistory(browserArg, urlLimit)
  : parseUrls(inputFile);
const source = browserArg ? `${browserArg} history` : inputFile;
console.log(`Parsed ${rawUrls.length} unique URLs from ${source}`);

const filtered = rawUrls.filter(u => !shouldSkipUrl(u));
console.log(`Filtered to ${filtered.length} after removing ${rawUrls.length - filtered.length} skip-host URLs`);

const urls = deduplicateUrls(filtered);
console.log(`Deduplicated to ${urls.length} unique hostname+path combinations`);

mkdirSync(outDir, { recursive: true });

const allRows = [];
const siteRows = {};
let processed = 0;
let skipped = 0;

for (const url of urls) {
  const slug = hostnameSlug(url);
  process.stdout.write(`[${processed + skipped + 1}/${urls.length}] ${slug}...`);

  const html = await fetchPage(url);
  if (!html) {
    console.log(' skip (fetch failed)');
    skipped++;
    continue;
  }

  const { textContent, isReaderable } = extractWithReadability(html, url);
  if (!isReaderable || !textContent) {
    console.log(' skip (not readable)');
    skipped++;
    continue;
  }

  const rows = analyseText(textContent);
  const matched = rows.filter(r => r.status === 'matched').length;
  console.log(` ${matched} matches, ${rows.length} candidates`);

  for (const row of rows) {
    row.site = slug;
    row.url = url;
    allRows.push(row);
    if (!siteRows[slug]) siteRows[slug] = [];
    siteRows[slug].push(row);
  }

  processed++;

  // Small delay to avoid hammering servers
  await new Promise(r => setTimeout(r, 500));
}

// ── Write output ────────────────────────────────────────────

const header = 'context\tcandidate\trule\tstatus\turl';

// Per-site TSVs
for (const [site, rows] of Object.entries(siteRows)) {
  const lines = [header, ...rows.map(r => `${r.context}\t${r.candidate}\t${r.rule}\t${r.status}\t${r.url}`)];
  writeFileSync(join(outDir, `${site}.tsv`), lines.join('\n') + '\n');
}

// Summary: all matched candidates with counts
const matchCounts = {};
for (const row of allRows.filter(r => r.status === 'matched')) {
  if (!matchCounts[row.candidate]) {
    matchCounts[row.candidate] = { count: 0, rule: row.rule, sites: new Set(), contexts: [] };
  }
  matchCounts[row.candidate].count++;
  matchCounts[row.candidate].sites.add(row.site);
  if (matchCounts[row.candidate].contexts.length < 3) {
    matchCounts[row.candidate].contexts.push(row.context);
  }
}

const summaryHeader = 'candidate\tcount\trule\tsites\texample_contexts';
const summaryRows = Object.entries(matchCounts)
  .sort((a, b) => b[1].count - a[1].count)
  .map(([candidate, data]) =>
    `${candidate}\t${data.count}\t${data.rule}\t${[...data.sites].join(', ')}\t${data.contexts.join(' | ')}`
  );
writeFileSync(join(outDir, '_summary.tsv'), [summaryHeader, ...summaryRows].join('\n') + '\n');

console.log(`\nDone: ${processed} pages processed, ${skipped} skipped`);
console.log(`Output: ${outDir}/`);
console.log(`  ${Object.keys(siteRows).length} site TSVs`);
console.log(`  _summary.tsv (${Object.keys(matchCounts).length} unique matched entities)`);
