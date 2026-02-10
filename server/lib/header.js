// wikilinker/lib/header.js
//
// Generates the Wikilinker navigation bar injected at the top of every
// proxied page. Includes a URL input form, a site-picker dropdown
// (populated from sites.json), an About link, and an optional debug panel.
import { getAllSites } from './extractor.js';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Load per-site CSS fixes from site-fixes/*.css at startup.
// These fix rendering issues on sites that rely on client-side JS
// (hidden drawers, empty ad slots, broken images, etc.).
const __dirname = dirname(fileURLToPath(import.meta.url));
const siteFixesDir = join(__dirname, 'site-fixes');
let siteFixesCSS = '';
try {
  const files = readdirSync(siteFixesDir).filter(f => f.endsWith('.css')).sort();
  siteFixesCSS = files
    .map(f => readFileSync(join(siteFixesDir, f), 'utf8'))
    .join('\n');
} catch {
  // No site-fixes directory — that's fine
}

export function generateHeader(currentUrl, proxyPath, options = {}) {
  const sites = getAllSites();
  const { isUnsupported = false, aboutUrl = `${proxyPath}/about`, extraHtml = '', debug = false, status = null } = options;

  // Determine which site the current URL belongs to
  let currentDomain = '';
  try {
    currentDomain = new URL(currentUrl).hostname.toLowerCase().replace(/^www\./, '');
  } catch {}

  const siteOptions = Object.entries(sites)
    .map(([domain, config]) => {
      const isCurrentSite = currentDomain === domain || currentDomain.endsWith('.' + domain);
      return `<option value="${config.homepageUrl}"${isCurrentSite ? ' selected' : ''}>${config.name}</option>`;
    })
    .join('\n');

  const warning = isUnsupported
    ? `<div class="wikilinker-warning">This site isn't officially supported &mdash; results may vary.</div>`
    : '';

  // Build status line
  const wl = `<a href="${aboutUrl}" class="wikilinker-status-link">wikilinks</a>`;
  let statusLine = '';
  if (status) {
    const parts = [];
    if (status.status === 'skipped_index_page') {
      parts.push(`Not an article page &mdash; navigate to an article to see ${wl}`);
    } else if (status.status === 'skipped') {
      if (typeof status.linked === 'number') {
        parts.push(`${status.linked} <a href="${aboutUrl}" class="wikilinker-status-link">wikilink${status.linked !== 1 ? 's' : ''}</a> added`);
      }
      parts.push('Readability extraction failed &mdash; using fallback pipeline');
    } else if (status.status === 'active') {
      if (status.entitiesFound != null) {
        parts.push(`${status.entitiesFound} entities discovered`);
      }
      if (typeof status.linked === 'number') {
        parts.push(`${status.linked} <a href="${aboutUrl}" class="wikilinker-status-link">wikilink${status.linked !== 1 ? 's' : ''}</a> added`);
      }
    }
    if (parts.length > 0) {
      statusLine = `<div class="wikilinker-status">${parts.join(' · ')}</div>`;
    }
  }

  return `
    <div id="wikilinker-header">
      <div class="wikilinker-bar">
        <a href="${proxyPath}${debug ? '?debug=1' : ''}" class="wikilinker-title">Wikilinker</a>

        <form class="wikilinker-sites-form" action="${proxyPath}" method="GET">
          <label class="wikilinker-sites-label">Sites:</label>
          <select name="url" class="wikilinker-sites">
            ${siteOptions}
          </select>
          ${debug ? '<input type="hidden" name="debug" value="1">' : ''}
          <button type="submit" class="wikilinker-sites-go">Go</button>
        </form>

        <form class="wikilinker-form" action="${proxyPath}" method="GET">
          <input type="text" name="url" value="${escapeAttr(currentUrl)}"
                 placeholder="Paste a supported site URL..." class="wikilinker-input">
          ${debug ? '<input type="hidden" name="debug" value="1">' : ''}
          <button type="submit" class="wikilinker-button">Go</button>
        </form>

        <div class="wikilinker-links">
          <a href="${aboutUrl}">About</a>
        </div>
      </div>
      ${statusLine}
      ${warning}
      ${extraHtml}
    </div>
    <script>
      (function() {
        try {
          var bg = getComputedStyle(document.body).backgroundColor;
          var m = bg.match(/\\d+/g);
          if (m && m.length >= 3) {
            var lum = (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255;
            if (lum < 0.4) document.body.classList.add('wikilinker-dark');
          }
        } catch(e) {}
      })();
    </script>
  `;
}

export function getHeaderStyles() {
  return `
    <style>
      #wikilinker-header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
      }

      .wikilinker-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 16px;
        background: #1a1a2e;
        color: #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        flex-wrap: wrap;
      }

      .wikilinker-title {
        font-weight: bold;
        font-size: 16px;
        color: #fff;
        text-decoration: underline;
        font-style: italic;
        background-color: rgba(52, 168, 83, 0.25);
        padding: 2px 6px;
        border-radius: 3px;
      }

      .wikilinker-title:hover {
        background-color: rgba(52, 168, 83, 0.4);
        color: #fff;
      }

      .wikilinker-form {
        display: flex;
        flex: 1;
        min-width: 200px;
        max-width: 500px;
      }

      .wikilinker-input {
        flex: 1;
        padding: 6px 10px;
        border: 1px solid #4a4a6a;
        border-radius: 4px 0 0 4px;
        background: #2a2a4a;
        color: #fff;
        font-size: 13px;
      }

      .wikilinker-input:focus {
        outline: none;
        border-color: #6366f1;
      }

      .wikilinker-button {
        padding: 6px 12px;
        background: #6366f1;
        color: #fff;
        border: none;
        border-radius: 0 4px 4px 0;
        cursor: pointer;
        font-size: 13px;
      }

      .wikilinker-button:hover {
        background: #4f46e5;
      }

      .wikilinker-sites-form {
        display: flex;
        align-items: center;
      }

      .wikilinker-sites-label {
        color: #a5b4fc;
        font-size: 13px;
        margin-right: 6px;
      }

      .wikilinker-sites {
        padding: 6px 10px;
        background: #2a2a4a;
        color: #fff;
        border: 1px solid #4a4a6a;
        border-radius: 4px 0 0 4px;
        font-size: 13px;
        cursor: pointer;
      }

      .wikilinker-sites-go {
        padding: 6px 8px;
        background: #6366f1;
        color: #fff;
        border: none;
        border-radius: 0 4px 4px 0;
        cursor: pointer;
        font-size: 12px;
      }

      .wikilinker-sites-go:hover {
        background: #4f46e5;
      }

      .wikilinker-links {
        display: flex;
        gap: 12px;
        margin-left: auto;
      }

      .wikilinker-links a {
        color: #a5b4fc;
        text-decoration: none;
        font-size: 13px;
      }

      .wikilinker-links a:hover {
        text-decoration: underline;
      }

      .wikilinker-status {
        background: #1e1e32;
        color: #c0c0d0;
        padding: 6px 16px;
        font-size: 13px;
        border-top: 1px solid #2a2a4a;
      }

      .wikilinker-status-link {
        color: #c0c0d0;
        font-style: italic;
        text-decoration: underline;
        background-color: rgba(52, 168, 83, 0.2);
        padding: 1px 4px;
        border-radius: 2px;
      }

      .wikilinker-status-link:hover {
        color: #fff;
        background-color: rgba(52, 168, 83, 0.35);
      }

      .wikilinker-warning {
        background: #fef3c7;
        color: #92400e;
        padding: 8px 16px;
        text-align: center;
        font-size: 13px;
      }

      /* Push page content down */
      body {
        margin-top: 60px !important;
      }

      /* Hide placeholder images meant for no-JS fallback (BBC etc.) */
      .hide-when-no-script {
        display: none !important;
      }

      /* Per-site rendering fixes (loaded from lib/site-fixes/*.css) */
      ${siteFixesCSS}

      /* Wikilink styles — Option E: Green tint */
      .wikilink {
        color: #0645ad !important;
        text-decoration: underline !important;
        font-style: italic !important;
        background-color: rgba(52, 168, 83, 0.12) !important;
        padding: 1px 3px !important;
        border-radius: 2px !important;
        font-size: inherit;
        font-weight: inherit;
        line-height: inherit;
        letter-spacing: inherit;
      }

      .wikilink:visited {
        color: #0b0080 !important;
      }

      .wikilink:hover {
        color: #3366bb !important;
        background-color: rgba(52, 168, 83, 0.25) !important;
      }

      /* Dark mode wikilink styles — via OS preference or detected dark background */
      @media (prefers-color-scheme: dark) {
        .wikilink {
          color: #6ea8fe !important;
          background-color: rgba(52, 168, 83, 0.18) !important;
        }
        .wikilink:visited {
          color: #9f8fef !important;
        }
        .wikilink:hover {
          color: #8cb4ff !important;
          background-color: rgba(52, 168, 83, 0.32) !important;
        }
      }
      /* Class-based dark mode for sites with dark backgrounds regardless of OS setting */
      .wikilinker-dark .wikilink {
        color: #6ea8fe !important;
        background-color: rgba(52, 168, 83, 0.18) !important;
      }
      .wikilinker-dark .wikilink:visited {
        color: #9f8fef !important;
      }
      .wikilinker-dark .wikilink:hover {
        color: #8cb4ff !important;
        background-color: rgba(52, 168, 83, 0.32) !important;
      }

      @media (max-width: 768px) {
        .wikilinker-bar {
          padding: 6px 8px;
          gap: 6px;
        }
        .wikilinker-sites-label {
          display: none;
        }
        .wikilinker-form {
          order: 10;
          flex-basis: 100%;
          max-width: none;
        }
        .wikilinker-links a {
          font-size: 12px;
        }
      }

      /* Debug panel */
      #wikilinker-debug {
        background: #12121f;
        border-top: 1px solid #2a2a4a;
        font-size: 13px;
        color: #ccc;
      }

      .wikilinker-debug-toggle {
        cursor: pointer;
        padding: 6px 16px;
        color: #a5b4fc;
        font-size: 13px;
        list-style: none;
      }

      .wikilinker-debug-toggle::-webkit-details-marker {
        display: none;
      }

      .wikilinker-debug-toggle::before {
        content: '\u25B6 ';
      }

      #wikilinker-debug[open] .wikilinker-debug-toggle::before {
        content: '\u25BC ';
      }

      .wikilinker-debug-toggle:hover {
        background: #1a1a2e;
      }

      #wikilinker-debug-content {
        padding: 12px 16px;
        max-height: 60vh;
        overflow-y: auto;
      }

      .wikilinker-debug-section {
        margin-bottom: 12px;
      }

      .wikilinker-debug-section h4 {
        margin: 0 0 6px 0;
        font-size: 12px;
        font-weight: 600;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .wikilinker-debug-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      .wikilinker-debug-tag {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 3px;
        font-size: 12px;
        background: #1a1a2e;
        border: 1px solid #3a3a5a;
      }

      .wikilinker-debug-tag small {
        opacity: 0.7;
      }

      .wikilinker-debug-skip {
        opacity: 0.6;
        border-color: #3a3a5a;
        color: #999;
      }

      .wikilinker-debug-candidate {
        border-color: #4a4a6a;
        color: #aaa;
      }
    </style>
  `;
}

export function generateDebugPanel(debugInfo) {
  const { allCandidates, matched, skippedNoMatch, skippedOverlap, skippedPartOfLarger, skippedAlreadyLinked, skippedSentenceStart = [], readability } = debugInfo;
  const totalSkipped = skippedNoMatch.length + skippedOverlap.length + skippedPartOfLarger.length + skippedAlreadyLinked.length + skippedSentenceStart.length;

  // Readability status section
  let readabilityHtml = '';
  if (readability) {
    if (readability.status === 'active') {
      readabilityHtml = `
        <div class="wikilinker-debug-section">
          <h4>Article Extraction (Readability)</h4>
          <div class="wikilinker-debug-tags">
            <span class="wikilinker-debug-tag" style="border-color: #22c55e; color: #22c55e">Active</span>
            <span class="wikilinker-debug-tag">${escapeAttr(readability.title || 'Untitled')}</span>
            <span class="wikilinker-debug-tag">${readability.textLength.toLocaleString()} chars</span>
            <span class="wikilinker-debug-tag">${readability.entitiesFound} entities discovered</span>
          </div>
        </div>`;
    } else {
      readabilityHtml = `
        <div class="wikilinker-debug-section">
          <h4>Article Extraction (Readability)</h4>
          <div class="wikilinker-debug-tags">
            <span class="wikilinker-debug-tag wikilinker-debug-skip">Skipped (page not readerable)</span>
          </div>
        </div>`;
    }
  }

  const matchedHtml = matched.map(m =>
    `<span class="wikilinker-debug-tag" style="border-color: #6366f1; color: #a5b4fc">${escapeAttr(m.text)}</span>`
  ).join(' ') || '<em>None</em>';

  const noMatchHtml = skippedNoMatch.map(t =>
    `<span class="wikilinker-debug-tag wikilinker-debug-skip">${escapeAttr(t)}</span>`
  ).join(' ') || '<em>None</em>';

  const overlapHtml = skippedOverlap.map(m =>
    `<span class="wikilinker-debug-tag wikilinker-debug-skip">${escapeAttr(m.text)}</span>`
  ).join(' ') || '<em>None</em>';

  const partOfLargerHtml = skippedPartOfLarger.map(m =>
    `<span class="wikilinker-debug-tag wikilinker-debug-skip">${escapeAttr(m.text)}</span>`
  ).join(' ') || '<em>None</em>';

  const sentenceStartHtml = skippedSentenceStart.map(m =>
    `<span class="wikilinker-debug-tag wikilinker-debug-skip">${escapeAttr(m.text)}</span>`
  ).join(' ') || '<em>None</em>';

  const alreadyLinkedHtml = skippedAlreadyLinked.map(m =>
    `<span class="wikilinker-debug-tag wikilinker-debug-skip">${escapeAttr(m.text)} <small>(2nd+ occurrence)</small></span>`
  ).join(' ') || '<em>None</em>';

  const allCandidatesHtml = allCandidates.map(c =>
    `<span class="wikilinker-debug-tag wikilinker-debug-candidate">${escapeAttr(c)}</span>`
  ).join(' ') || '<em>None</em>';

  return `
    <details id="wikilinker-debug">
      <summary class="wikilinker-debug-toggle">
        Debug (${matched.length} linked, ${totalSkipped} skipped)
      </summary>
      <div id="wikilinker-debug-content">
        ${readabilityHtml}
        <div class="wikilinker-debug-section">
          <h4>Linked Entities (${matched.length})</h4>
          <div class="wikilinker-debug-tags">${matchedHtml}</div>
        </div>
        <div class="wikilinker-debug-section">
          <h4>Skipped: No Entity Match (${skippedNoMatch.length})</h4>
          <div class="wikilinker-debug-tags">${noMatchHtml}</div>
        </div>
        <div class="wikilinker-debug-section">
          <h4>Skipped: Overlap with Longer Match (${skippedOverlap.length})</h4>
          <div class="wikilinker-debug-tags">${overlapHtml}</div>
        </div>
        <div class="wikilinker-debug-section">
          <h4>Skipped: Part of Larger Phrase (${skippedPartOfLarger.length})</h4>
          <div class="wikilinker-debug-tags">${partOfLargerHtml}</div>
        </div>
        <div class="wikilinker-debug-section">
          <h4>Skipped: Sentence Start (${skippedSentenceStart.length})</h4>
          <div class="wikilinker-debug-tags">${sentenceStartHtml}</div>
        </div>
        <div class="wikilinker-debug-section">
          <h4>Skipped: Already Linked (${skippedAlreadyLinked.length})</h4>
          <div class="wikilinker-debug-tags">${alreadyLinkedHtml}</div>
        </div>
        <div class="wikilinker-debug-section">
          <h4>All Candidates Extracted (${allCandidates.length})</h4>
          <div class="wikilinker-debug-tags">${allCandidatesHtml}</div>
        </div>
      </div>
    </details>
  `;
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
