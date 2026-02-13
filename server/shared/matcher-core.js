// shared/matcher-core.js
//
// Pure-function entity matching logic shared between the server and
// Chrome extension. No I/O, no DOM — just string processing.

// Common words to skip — these are English words that happen to have Wikipedia
// articles but are almost never useful entity links in news text.
export const SKIP_WORDS = new Set([
  // Pronouns and determiners
  'The', 'This', 'That', 'There', 'Their', 'They', 'What', 'When',
  'Where', 'Which', 'Who', 'Why', 'How',
  'He', 'She', 'His', 'Her', 'Him', 'Its', 'We', 'Our', 'You', 'Your', 'My',
  // Days and months
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
  // Common English words that are also Wikipedia titles
  'About', 'After', 'Again', 'Album', 'Also', 'Ammunition', 'Another', 'Archive', 'Assault',
  'Before', 'Being', 'Both', 'But',
  'Cash', 'Cast', 'Category', 'Christmas', 'Code', 'Contact', 'Control', 'Copyright',
  'Despite', 'Download',
  'Each', 'Email', 'Error', 'Even', 'Every', 'Everything', 'Evidence', 'Expect',
  'Family', 'Film', 'Fireworks', 'First', 'Following', 'Former', 'Free', 'Freedom', 'From',
  'General', 'Golden', 'Good', 'Great', 'Greatness', 'Greed',
  'Here',
  'Image', 'Indeed',
  'Just',
  'Keep',
  'Language', 'Last', 'Life', 'Like', 'Link', 'List', 'Live',
  'Machine', 'Many', 'Media', 'Meanwhile', 'Minutes', 'More', 'Most', 'Much',
  'Name', 'Nation', 'Never', 'New', 'News', 'Next', 'Night', 'Nobody', 'None', 'Nothing', 'Number',
  'Office', 'Often', 'Only', 'Other', 'Over',
  'Page', 'People', 'Play', 'Please', 'Pointless', 'Police', 'Power', 'Productivity', 'Public',
  'Question',
  'Radio', 'Real',
  'Same', 'Service', 'Several', 'Sign', 'Since', 'Sniper', 'Some', 'South', 'Special',
  'Stalemate', 'State', 'Steam', 'Still', 'Success', 'Such', 'Sunrise',
  'Time', 'Title', 'Today', 'Together',
  'Very',
  'Watch', 'Website', 'Wedding', 'Welcome', 'Well', 'While', 'White', 'Whole', 'Woman', 'Wood',
  'World', 'Writer',
  'Year',
  'Zero',
  // Compass/directional (match as part of multi-word like "South Korea")
  'North', 'East', 'West',
  // Demonym adjectives — link the country instead
  'African', 'American', 'Arab', 'Asian', 'Australian',
  'Brazilian', 'British',
  'Canadian', 'Chinese',
  'Dutch',
  'Egyptian', 'English', 'European',
  'French',
  'German', 'Greek',
  'Indian', 'Iranian', 'Iraqi', 'Irish', 'Islamic', 'Israeli', 'Italian',
  'Japanese',
  'Korean',
  'Latin',
  'Mexican',
  'Palestinian', 'Polish',
  'Russian',
  'Scottish', 'Spanish', 'Swedish',
  'Turkish',
  'Ukrainian',
  'Vietnamese',
  'Welsh',
  // Institutional/role words (too generic alone, valid in multi-word phrases)
  'Academic', 'Athletes', 'Bureaucrat', 'Cabinet', 'Commons', 'Conservative',
  'Constitution', 'Creativity', 'Customs', 'Democracy', 'Deputy', 'Environment',
  'Geography', 'Health', 'History', 'House', 'Immigration',
  'Justice', 'Liberal', 'Ministry',
  'Opposition',
  'Parliament', 'Partnership', 'Poetry', 'Prince', 'Princess',
  'Producer', 'Professor',
  'Republic',
  'Secretary', 'Security', 'Transparency', 'Treasury',
  // Stock photo attribution words
  'Alamy', 'Getty', 'Shutterstock',
]);

// Minimum length rules for single-word candidates:
// - ALL CAPS (acronyms like FBI, NATO): 3+ chars (kills ambiguous 2-letter: US, UK, PM, MP)
// - Mixed-case (like Israel, Gaza): 4+ chars
// Multi-word phrases bypass this check entirely.
export function meetsMinLength(phrase) {
  if (phrase.includes(' ')) return true;
  if (/^[A-Z]+$/.test(phrase)) return phrase.length >= 3;
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

// Normalise curly quotes to straight so candidates match entity DB
export function normaliseCurlyQuotes(text) {
  return text.replace(/[\u2018\u2019]/g, "'");
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
  const normalised = normaliseCurlyQuotes(text);
  const candidates = extractCandidates(normalised);
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
