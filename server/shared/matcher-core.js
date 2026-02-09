// shared/matcher-core.js
//
// Pure-function entity matching logic shared between the server and
// Chrome extension. No I/O, no DOM — just string processing.

// Common words to skip — pronouns, articles, days, months
export const SKIP_WORDS = new Set([
  'The', 'This', 'That', 'There', 'Their', 'They', 'What', 'When',
  'Where', 'Which', 'Who', 'Why', 'How',
  'He', 'She', 'His', 'Her', 'Him', 'Its', 'We', 'Our', 'You', 'Your', 'My',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]);

// Minimum length rules for single-word candidates:
// - ALL CAPS (acronyms like UK, FBI): 2+ chars
// - Mixed-case (like Israel, Gaza): 4+ chars
// Multi-word phrases bypass this check entirely.
export function meetsMinLength(phrase) {
  if (phrase.includes(' ')) return true;
  if (/^[A-Z]+$/.test(phrase)) return phrase.length >= 2;
  return phrase.length >= 4;
}

// Trim leading/trailing filler words from greedy-matched phrases
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

// Extract capitalised phrase candidates from text
export function extractCandidates(text) {
  const candidates = new Set();

  const capsWord = "[A-Z][a-zA-Z'\\-]+";
  const filler = "(?:of|and|in|on|under|the|for)";

  const greedyRe = new RegExp(`\\b(${capsWord}(?:\\s+(?:${filler}|${capsWord}))*\\s+${capsWord})\\b`, 'g');

  const patterns = [
    greedyRe,
    new RegExp(`\\b(${capsWord}(?:\\s+${capsWord})+)\\b`, 'g'),
    new RegExp(`\\b(${capsWord})\\b`, 'g'),
    /\b([A-Z]{2,6})\b/g,
  ];

  for (const pattern of patterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const phrase = match[1].trim();
      if (meetsMinLength(phrase) && !SKIP_WORDS.has(phrase)) {
        candidates.add(phrase);

        if (pattern === greedyRe) {
          const trimmed = trimFillers(phrase);
          if (trimmed !== phrase && meetsMinLength(trimmed) && !SKIP_WORDS.has(trimmed)) {
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
      const lastWord = textBefore.match(/[A-Z][a-zA-Z''\-]*$/);
      if (lastWord) return true;
    }
  }
  if (end < text.length) {
    const charAfter = text[end];
    if (charAfter === ' ') {
      const textAfter = text.slice(end + 1);
      const nextWord = textAfter.match(/^[A-Z][a-zA-Z''\-]*/);
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
// Returns array of { text, index } sorted by position.
export function findMatches(text, entitySet) {
  const candidates = extractCandidates(text);
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
    const regex = new RegExp(`\\b${escapeRegExp(match.text)}\\b`);
    const found = regex.exec(text);

    if (found) {
      const start = found.index;
      const end = start + match.text.length;

      const overlaps = usedRanges.some(([s, e]) =>
        (start >= s && start < e) || (end > s && end <= e) || (start <= s && end >= e)
      );

      if (!overlaps && !isPartOfLargerPhrase(text, start, end) && !isSentenceStart(text, start)) {
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
    const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'g');
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

// Generate Wikipedia URL from entity name
export function toWikiUrl(entityName) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(entityName.replace(/ /g, '_'))}`;
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
