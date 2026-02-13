# Wikilinker Proxy TODO

## Priorities

(None — remaining items tracked in the wikilinker repo)

---

## Completed

- [x] Disambiguation with Context
- [x] Register as Chrome Plugin Developer
- [x] Firefox Extension

- [x] Core proxy with entity matching (343K entities)
- [x] Support for 25+ news sites
- [x] Color-coded links by type
- [x] Header bar with legend and controls
- [x] Skip rules (headlines, navigation, captions)
- [x] Remove `target="_blank"` (preserves back button)
- [x] Match longest phrase first
- [x] Link first occurrence only
- [x] Hide icons by default with toggle
- [x] Fix Guardian black space
- [x] Fix proxy link routing
- [x] Fix header injection (WHOLE_DOCUMENT)
- [x] Test suite (sampler, runner, analyzer, reporter)
- [x] Debug mode (`?debug=1`) — collapsible panel showing all candidate phrases, linked entities with types, and skipped candidates with reasons (no match, overlap, part of larger phrase, already linked)
- [x] Improved matching — greedy/frugal dual-pass regex ported from original PHP `wikipedize()`. Greedy bridges filler words ("President of the United States"), frugal splits at fillers ("Amnesty International and Human Rights Watch"). Filler trimming for greedy captures.
- [x] Mozilla Readability integration — two-phase pipeline: Readability extracts article `textContent`, matcher discovers entities on plain text, injector links them in original DOM. Falls back to per-node extraction if Readability fails. Debug panel shows Readability status.

## In Progress

- **English skip word refinement** — using `--debug` build to log match data from real pages, identify false positives, and expand the skip word list

## Other Ideas

- **Internationalisation** — build language-specific versions (French, German, Spanish, Arabic, etc.). Pipeline: grab Wikipedia pageview dumps for target language → build entity list → sample ~100 pages from top news sites in that language → analyse matches to build language-specific skip word list → test and iterate. Candidate regex works for Latin-script languages; Arabic/CJK would need different extraction patterns.
- Entity matching: popularity scoring
- UI/UX: entity count in header, keyboard shortcuts, dark mode, mobile
- Performance: cache processed HTML, service worker
- Site support: more configs, better auto-detection
