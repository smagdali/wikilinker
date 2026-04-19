// shared/matcher-core.js
//
// Pure-function entity matching logic shared between the server and
// browser extension. No I/O, no DOM — just string processing.
//
// Unicode-aware: uses \p{Lu} (uppercase letter) and \p{L} (any letter)
// with the /u flag, so non-Latin scripts (Cyrillic, Greek, Devanagari,
// Arabic, Hebrew) work out of the box.

import skipWordsEn from '../../i18n/en/skip-words.json' with { type: 'json' };

// Default English skip words — used when no explicit list is provided.
// Extension builds inject the correct per-language list via options.skipWords.
export const SKIP_WORDS = new Set(skipWordsEn);

// Minimum length rules for single-word candidates:
// - ALL CAPS (acronyms like FBI, NATO): 3+ chars (kills ambiguous 2-letter: US, UK, PM, MP)
// - Mixed-case (like Israel, Gaza): 4+ chars
// Multi-word phrases bypass this check entirely.
export function meetsMinLength(phrase) {
  if (phrase.includes(' ')) return true;
  if (/^\p{Lu}+$/u.test(phrase)) return phrase.length >= 3;
  return phrase.length >= 4;
}

// Trim leading/trailing filler words from greedy-matched phrases.
// These are English fillers; per-language fillers can be added in a future task.
const FILLER_LEADING = /^(?:of|and|in|on|under|the|for)\s+/i;
const FILLER_TRAILING = /\s+(?:of|and|in|on|under|the|for)$/i;

export function trimFillers(phrase) {
  let result = phrase;
  while (FILLER_LEADING.test(result)) {
    result = result.replace(FILLER_LEADING, '');
  }
  while (FILLER_TRAILING.test(result)) {
    result = result.replace(FILLER_TRAILING, '');
  }
  return result;
}

// Normalise curly quotes to straight so candidates match entity DB
export function normaliseCurlyQuotes(text) {
  return text.replace(/[\u2018\u2019]/g, "'");
}

// Extract capitalised phrase candidates from text.
// options.skipWords: Set of words to reject (defaults to English SKIP_WORDS)
//
// Note: \b is ASCII-only in JavaScript regex — it doesn't recognise letters
// outside [A-Za-z0-9_] as word characters. For Unicode support we use
// Unicode-aware lookarounds: (?<![\p{L}\p{N}]) before and (?![\p{L}\p{N}]) after.
export function extractCandidates(text, options = {}) {
  const skipWords = options.skipWords || SKIP_WORDS;
  const candidates = new Set();

  const capsWord = "\\p{Lu}[\\p{L}'\\-]+";
  const filler = "(?:of|and|in|on|under|the|for)";
  const boundaryBefore = "(?<![\\p{L}\\p{N}])";
  const boundaryAfter = "(?![\\p{L}\\p{N}])";

  const greedyRe = new RegExp(
    `${boundaryBefore}(${capsWord}(?:\\s+(?:${filler}|${capsWord}))*\\s+${capsWord})${boundaryAfter}`,
    'gu',
  );

  const patterns = [
    greedyRe,
    new RegExp(`${boundaryBefore}(${capsWord}(?:\\s+${capsWord})+)${boundaryAfter}`, 'gu'),
    new RegExp(`${boundaryBefore}(${capsWord})${boundaryAfter}`, 'gu'),
    new RegExp(`${boundaryBefore}(\\p{Lu}{2,6})${boundaryAfter}`, 'gu'),
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const phrase = match[1].trim();
      if (meetsMinLength(phrase) && !skipWords.has(phrase)) {
        candidates.add(phrase);

        if (pattern === greedyRe) {
          const trimmed = trimFillers(phrase);
          if (trimmed !== phrase && meetsMinLength(trimmed) && !skipWords.has(trimmed)) {
            candidates.add(trimmed);
          }
        }
      }
    }
  }

  return candidates;
}

// Check if a match position is at the start of a sentence
export function isSentenceStart(text, index) {
  if (index === 0) return true;
  let i = index - 1;
  while (i >= 0 && /\s/.test(text[i])) i--;
  if (i < 0) return true;
  return /[.!?;]/.test(text[i]);
}

// Check if matched text is part of a larger proper noun phrase
export function isPartOfLargerPhrase(text, start, end) {
  if (start > 0) {
    const charBefore = text[start - 1];
    if (charBefore === ' ') {
      const textBefore = text.slice(0, start - 1);
      const lastWord = textBefore.match(/\p{Lu}[\p{L}'\-]*$/u);
      if (lastWord) return true;
    }
  }
  if (end < text.length) {
    const charAfter = text[end];
    if (charAfter === ' ') {
      const textAfter = text.slice(end + 1);
      const nextWord = textAfter.match(/^\p{Lu}[\p{L}'\-]*/u);
      if (nextWord) return true;
    }
  }
  return false;
}

export function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Find entity matches in text using full candidate extraction.
// entitySet: a Set of known entity names.
// options.multiWordOnly: if true, skip single-word and acronym matches.
// options.skipWords: Set of words to reject (defaults to English SKIP_WORDS)
// Returns array of { text, index } sorted by position.
export function findMatches(text, entitySet, options = {}) {
  const normalised = normaliseCurlyQuotes(text);
  let candidates = extractCandidates(normalised, options);

  if (options.multiWordOnly) {
    candidates = new Set([...candidates].filter(c => c.includes(' ') || /^\p{Lu}+$/u.test(c)));
  }
  const matches = [];

  for (const candidate of candidates) {
    if (entitySet.has(candidate)) {
      matches.push({ text: candidate });
    }
  }

  matches.sort((a, b) => b.text.length - a.text.length);

  const result = [];
  const usedRanges = [];

  for (const match of matches) {
    const regex = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(match.text)}(?![\\p{L}\\p{N}])`,
      'u',
    );
    const found = regex.exec(normalised);

    if (found) {
      const start = found.index;
      const end = start + match.text.length;

      const overlaps = usedRanges.some(([s, e]) =>
        (start >= s && start < e) || (end > s && end <= e) || (start <= s && end >= e)
      );

      if (!overlaps && !isPartOfLargerPhrase(normalised, start, end) && !isSentenceStart(normalised, start)) {
        result.push({ text: match.text, index: start });
        usedRanges.push([start, end]);
      }
    }
  }

  result.sort((a, b) => a.index - b.index);
  return result;
}

// Find occurrences of pre-discovered entities in text.
// knownEntities: a Map (or Set) of entity names.
// Returns array of { text, index } sorted by position.
export function findMatchesInText(text, knownEntities) {
  const matches = [];

  for (const [name] of knownEntities) {
    const regex = new RegExp(
      `(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`,
      'gu',
    );
    let found;
    while ((found = regex.exec(text)) !== null) {
      matches.push({ text: name, index: found.index });
    }
  }

  matches.sort((a, b) => b.text.length - a.text.length);

  const result = [];
  const usedRanges = [];

  for (const match of matches) {
    const start = match.index;
    const end = start + match.text.length;

    const overlaps = usedRanges.some(([s, e]) =>
      (start >= s && start < e) || (end > s && end <= e) || (start <= s && end >= e)
    );

    if (!overlaps && !isSentenceStart(text, start)) {
      result.push(match);
      usedRanges.push([start, end]);
    }
  }

  result.sort((a, b) => a.index - b.index);
  return result;
}

// Generate Wikipedia URL from entity name.
// lang: two-letter language code (defaults to 'en')
export function toWikiUrl(entityName, lang = 'en') {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(entityName.replace(/ /g, '_'))}`;
}

// Extract context around a match — 3 words either side
export function extractContext(text, index, matchLength) {
  const before = text.slice(0, index);
  const after = text.slice(index + matchLength);
  const wordsBefore = before.trim().split(/\s+/).slice(-3).join(' ');
  const wordsAfter = after.trim().split(/\s+/).slice(0, 3).join(' ');
  const matched = text.slice(index, index + matchLength);
  return `${wordsBefore} [${matched}] ${wordsAfter}`.trim();
}
