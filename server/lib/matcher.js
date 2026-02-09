// wikilinker/lib/matcher.js
//
// Entity discovery and Wikipedia title matching. Scans text for capitalised
// multi-word phrases and acronyms, filters out common words (pronouns,
// months, prepositions), then looks up candidates against a local index
// of the top 500k Wikipedia articles by pageview. Exact match only.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Common words to skip
const SKIP_WORDS = new Set([
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
function meetsMinLength(phrase) {
  // Multi-word phrases are always OK
  if (phrase.includes(' ')) return true;
  // All-uppercase acronyms: 2+ chars
  if (/^[A-Z]+$/.test(phrase)) return phrase.length >= 2;
  // Mixed-case single words: 4+ chars
  return phrase.length >= 4;
}

// Trim leading/trailing filler words from greedy-matched phrases
const FILLER_LEADING = /^(?:of|and|in|on|under|the|for)\s+/i;
const FILLER_TRAILING = /\s+(?:of|and|in|on|under|the|for)$/i;

function trimFillers(phrase) {
  let result = phrase;
  while (FILLER_LEADING.test(result)) {
    result = result.replace(FILLER_LEADING, '');
  }
  while (FILLER_TRAILING.test(result)) {
    result = result.replace(FILLER_TRAILING, '');
  }
  return result;
}

export class EntityMatcher {
  constructor(entities = null) {
    if (entities) {
      this.entities = entities instanceof Set ? entities : new Set(entities);
    } else {
      this.loadEntities();
    }
  }

  loadEntities() {
    const entitiesPath = join(__dirname, '..', 'data', 'entities.json');
    const data = JSON.parse(readFileSync(entitiesPath, 'utf8'));
    this.entities = new Set(data);
    console.log(`EntityMatcher: Loaded ${this.entities.size} entities`);
  }

  extractCandidates(text) {
    const candidates = new Set();

    const capsWord = "[A-Z][a-zA-Z'\\-]+";
    const filler = "(?:of|and|in|on|under|the|for)";

    // Greedy regex index for filler trimming
    const greedyRe = new RegExp(`\\b(${capsWord}(?:\\s+(?:${filler}|${capsWord}))*\\s+${capsWord})\\b`, 'g');

    const patterns = [
      // Greedy: CapsWord (filler|CapsWord)* CapsWord — bridges multiple fillers
      // Matches: "President of the United States", "Secretary of State"
      greedyRe,
      // Frugal: consecutive CapsWords only — splits at fillers
      // Splits: "Amnesty International and Human Rights Watch" → both sub-phrases
      new RegExp(`\\b(${capsWord}(?:\\s+${capsWord})+)\\b`, 'g'),
      // Single capitalized words
      new RegExp(`\\b(${capsWord})\\b`, 'g'),
      // Acronyms
      /\b([A-Z]{2,6})\b/g,
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const phrase = match[1].trim();
        if (meetsMinLength(phrase) && !SKIP_WORDS.has(phrase)) {
          candidates.add(phrase);

          // For greedy matches, also add filler-trimmed version
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

  findMatches(text, debug = false) {
    const candidates = this.extractCandidates(text);
    const matches = [];

    const debugData = debug ? {
      candidates: [...candidates],
      unmatched: [],
      overlapped: [],
      partOfLarger: [],
      sentenceStart: [],
    } : null;

    for (const candidate of candidates) {
      if (this.entities.has(candidate)) {
        matches.push({ text: candidate });
      } else if (debugData) {
        debugData.unmatched.push(candidate);
      }
    }

    // Sort by length (longest first) to handle overlapping matches
    matches.sort((a, b) => b.text.length - a.text.length);

    // Remove overlapping matches (keep longest)
    const result = [];
    const usedRanges = [];

    for (const match of matches) {
      const regex = new RegExp(`\\b${escapeRegExp(match.text)}\\b`);
      const found = regex.exec(text);

      if (found) {
        const start = found.index;
        const end = start + match.text.length;

        // Check if this range overlaps with any used range
        const overlaps = usedRanges.some(([s, e]) =>
          (start >= s && start < e) || (end > s && end <= e) || (start <= s && end >= e)
        );

        if (overlaps) {
          if (debugData) {
            debugData.overlapped.push({ text: match.text });
          }
        } else {
          // Check if this match is part of a larger capitalized phrase
          // e.g., "Forum" in "World Economic Forum" should not match
          const isPartOfLargerPhrase = this.isPartOfLargerPhrase(text, start, end, match.text);

          if (isPartOfLargerPhrase) {
            if (debugData) {
              debugData.partOfLarger.push({ text: match.text });
            }
          } else if (isSentenceStart(text, start)) {
            if (debugData) {
              debugData.sentenceStart.push({ text: match.text });
            }
          } else {
            match.index = start;
            result.push(match);
            usedRanges.push([start, end]);
          }
        }
      }
    }

    // Sort by index for processing order
    result.sort((a, b) => a.index - b.index);

    if (debugData) {
      result._debug = debugData;
    }

    return result;
  }

  // Check if matched text is part of a larger proper noun phrase
  isPartOfLargerPhrase(text, start, end, matchText) {
    // Check character before - is it a capital letter or part of a word?
    if (start > 0) {
      const charBefore = text[start - 1];
      // If preceded by a space and a capitalized word, it's part of larger phrase
      if (charBefore === ' ') {
        // Look back for capitalized word
        const textBefore = text.slice(0, start - 1);
        const lastWord = textBefore.match(/[A-Z][a-zA-Z''\-]*$/);
        if (lastWord) {
          return true;
        }
      }
    }

    // Check character after - is it followed by more capitalized words?
    if (end < text.length) {
      const charAfter = text[end];
      if (charAfter === ' ') {
        // Look ahead for capitalized word
        const textAfter = text.slice(end + 1);
        const nextWord = textAfter.match(/^[A-Z][a-zA-Z''\-]*/);
        if (nextWord) {
          return true;
        }
      }
    }

    return false;
  }

  // Run full candidate extraction + entity matching on article text.
  // Returns a Map of entity name -> match info for use in DOM injection.
  discoverEntities(articleText, debug = false) {
    const matches = this.findMatches(articleText, debug);
    const entityMap = new Map();

    for (const match of matches) {
      if (!entityMap.has(match.text)) {
        entityMap.set(match.text, true);
      }
    }

    return {
      entities: entityMap,
      debugData: matches._debug || null,
    };
  }

  // Find occurrences of known entities in a text node.
  // Used in the Readability pipeline where candidates are pre-discovered.
  findMatchesInText(text, knownEntities) {
    const matches = [];

    for (const [name] of knownEntities) {
      const regex = new RegExp(`\\b${escapeRegExp(name)}\\b`, 'g');
      let found;
      while ((found = regex.exec(text)) !== null) {
        matches.push({
          text: name,
          index: found.index,
        });
      }
    }

    // Sort by length descending for overlap removal
    matches.sort((a, b) => b.text.length - a.text.length);

    // Remove overlapping matches (keep longest)
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

}

// Check if a match position is at the start of a sentence
function isSentenceStart(text, index) {
  if (index === 0) return true;
  // Look backwards past whitespace for sentence-ending punctuation
  let i = index - 1;
  while (i >= 0 && /\s/.test(text[i])) i--;
  if (i < 0) return true;
  return /[.!?;]/.test(text[i]);
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
