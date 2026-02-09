# Wikilinker Proxy TODO

## Priorities

### 1. Disambiguation with Context
When an entity could link to a Wikipedia disambiguation page:
- Detect if target is a disambiguation page
- Use article context to pick correct target (e.g., "David Davies" + "Parliament" → UK politician)
- Fall back to disambiguation page if uncertain

### 2. Register as Chrome Plugin Developer
Register for a Chrome Web Store developer account to publish the extension.

### 3. Firefox Extension (LATER)
Port Chrome extension to Firefox once bugs are worked out.

---

## Completed

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

## Other Ideas

- Entity matching: add multi-word entities, popularity scoring
- UI/UX: entity count in header, keyboard shortcuts, dark mode, mobile
- Performance: cache processed HTML, service worker
- Site support: more configs, better auto-detection
