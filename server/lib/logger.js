// wikilinker/lib/logger.js
//
// Appends match data to a daily TSV log file. Each row records one
// wikilink match with context, destination URL, and the proxied page.
import { appendFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const LOG_DIR = process.env.LOG_DIR || '/var/cache/wikilinker/logs';

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// Log a batch of matches for a proxied page.
// matches: array of { text, wikiUrl, context }
// proxyUrl: the URL being proxied
export function logMatches(matches, proxyUrl) {
  if (!matches || matches.length === 0) return;

  try {
    ensureDir(LOG_DIR);
    const logFile = join(LOG_DIR, 'matches.tsv');
    const timestamp = new Date().toISOString();

    const lines = matches.map(m =>
      [timestamp, m.context, m.text, m.wikiUrl, proxyUrl].join('\t')
    );

    appendFileSync(logFile, lines.join('\n') + '\n');
  } catch (err) {
    // Don't crash the server if logging fails
    console.error('Match logging failed:', err.message);
  }
}
