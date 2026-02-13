// wikilinker/lib/matcher.js
//
// Entity discovery and Wikipedia title matching. Wraps the shared
// matcher-core module with file-based entity loading for the server.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  extractCandidates as _extractCandidates,
  normaliseCurlyQuotes,
  findMatches as _findMatches,
  findMatchesInText as _findMatchesInText,
  isPartOfLargerPhrase,
  isSentenceStart,
  escapeRegExp,
} from '../shared/matcher-core.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    return _extractCandidates(text);
  }

  findMatches(text, debug = false) {
    const normalised = normaliseCurlyQuotes(text);
    const candidates = _extractCandidates(normalised);
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
      const found = regex.exec(normalised);

      if (found) {
        const start = found.index;
        const end = start + match.text.length;

        const overlaps = usedRanges.some(([s, e]) =>
          (start >= s && start < e) || (end > s && end <= e) || (start <= s && end >= e)
        );

        if (overlaps) {
          if (debugData) {
            debugData.overlapped.push({ text: match.text });
          }
        } else {
          const partOfLarger = isPartOfLargerPhrase(normalised, start, end);

          if (partOfLarger) {
            if (debugData) {
              debugData.partOfLarger.push({ text: match.text });
            }
          } else if (isSentenceStart(normalised, start)) {
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

  // Run full candidate extraction + entity matching on article text.
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
  findMatchesInText(text, knownEntities) {
    return _findMatchesInText(text, knownEntities);
  }
}
