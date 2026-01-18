/**
 * Wikiproxy Content Script
 *
 * Scans article text for named entities and links them to Wikipedia
 */

(function() {
  'use strict';

  // Prevent double-execution
  if (window.__wikiproxyLoaded) return;
  window.__wikiproxyLoaded = true;

  // Type code to name mapping
  const TYPE_NAMES = {
    1: 'person',
    2: 'country',
    3: 'city',
    4: 'org',
    5: 'company'
  };

  // Entity data (loaded from background)
  let entities = null;
  let entitySet = null;
  let settings = null;
  let linkedCount = 0;

  // Selectors for article content (site-specific)
  const ARTICLE_SELECTORS = [
    'article',
    '[role="article"]',
    '.article-body',
    '.article__body',
    '.story-body',
    '.post-content',
    '.entry-content',
    '.content-body',
    '.article-content',
    '.story-content',
    '[data-component="text-block"]',
    '.ssrcss-11r1m41-RichTextComponentWrapper', // BBC
    '.pg-rail-tall__body', // CNN
    '.article-body-commercial-selector', // Guardian
    '.meteredContent', // NYT
    'main p',
  ];

  // Elements to skip
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED',
    'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'CODE', 'PRE',
    'SVG', 'MATH', 'HEAD', 'TITLE', 'META', 'LINK'
  ]);

  // Common words that shouldn't be linked even if they match
  const SKIP_WORDS = new Set([
    'The', 'This', 'That', 'There', 'Their', 'They', 'What', 'When',
    'Where', 'Which', 'Who', 'Why', 'How', 'Monday', 'Tuesday',
    'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]);

  // Initialize
  async function init() {
    // Get settings
    const settingsResponse = await chrome.runtime.sendMessage({ type: 'getSettings' });
    settings = settingsResponse.settings || {};

    if (!settings.enabled) {
      console.log('Wikiproxy: Disabled');
      return;
    }

    // Get entity data
    const entityResponse = await chrome.runtime.sendMessage({ type: 'getEntities' });
    entities = entityResponse.entities;
    entitySet = new Set(entityResponse.set);

    if (!entities || entitySet.size === 0) {
      console.log('Wikiproxy: No entity data available');
      return;
    }

    console.log(`Wikiproxy: Ready with ${entitySet.size} entities`);

    // Wait for page to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', processPage);
    } else {
      processPage();
    }
  }

  // Find article content on the page
  function findArticleContent() {
    for (const selector of ARTICLE_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        return Array.from(elements);
      }
    }
    // Fallback: all paragraphs in main or body
    const main = document.querySelector('main') || document.body;
    return Array.from(main.querySelectorAll('p'));
  }

  // Extract candidate phrases from text
  function extractCandidates(text) {
    const candidates = new Set();

    // Pattern for proper noun phrases (1-5 capitalized words)
    const capsWord = "[A-Z][a-zA-Z'\\-]+";
    const connector = "(?:of|and|the|for|in|on)";

    const patterns = [
      // Multi-word phrases with connectors
      new RegExp(`\\b(${capsWord}(?:\\s+(?:${connector}\\s+)?${capsWord}){1,4})\\b`, 'g'),
      // Two-word phrases
      new RegExp(`\\b(${capsWord}\\s+${capsWord})\\b`, 'g'),
      // Single capitalized words (but be more selective)
      new RegExp(`\\b(${capsWord})\\b`, 'g'),
      // Acronyms
      /\b([A-Z]{2,6})\b/g,
    ];

    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const phrase = match[1].trim();
        if (phrase.length > 1 && !SKIP_WORDS.has(phrase)) {
          candidates.add(phrase);
        }
      }
    }

    return candidates;
  }

  // Check if an entity type should be shown based on settings
  function shouldShowType(typeCode) {
    const typeMap = {
      1: settings.showPersons !== false,
      2: settings.showCountries !== false,
      3: settings.showCities !== false,
      4: settings.showOrgs !== false,
      5: settings.showCompanies !== false,
    };
    return typeMap[typeCode] !== false;
  }

  // Create Wikipedia link element
  function createWikiLink(text, entityInfo) {
    const [typeCode, wikidataId] = entityInfo;
    const typeName = TYPE_NAMES[typeCode] || 'entity';

    const link = document.createElement('a');
    link.href = `https://en.wikipedia.org/wiki/${encodeURIComponent(text.replace(/ /g, '_'))}`;
    link.className = `wikiproxy-link wikiproxy-${typeName}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = text;
    link.dataset.wikidataId = wikidataId;
    link.dataset.entityType = typeName;
    link.title = `${text} (${typeName}) - Click to view on Wikipedia`;

    return link;
  }

  // Process a text node
  function processTextNode(textNode) {
    const text = textNode.textContent;
    if (!text || text.trim().length < 3) return;

    // Extract candidates
    const candidates = extractCandidates(text);
    if (candidates.size === 0) return;

    // Find matches in our entity database
    const matches = [];
    for (const candidate of candidates) {
      if (entitySet.has(candidate)) {
        const entityInfo = entities[candidate];
        if (shouldShowType(entityInfo[0])) {
          matches.push({ text: candidate, info: entityInfo });
        }
      }
    }

    if (matches.length === 0) return;

    // Sort by length (longest first) to handle overlapping matches
    matches.sort((a, b) => b.text.length - a.text.length);

    // Track what we've already linked to avoid duplicates in same paragraph
    const linked = new Set();

    // Create document fragment with replacements
    let currentText = text;
    const replacements = [];

    for (const match of matches) {
      if (linked.has(match.text)) continue;

      // Find first occurrence
      const index = currentText.indexOf(match.text);
      if (index === -1) continue;

      // Check if it's at a word boundary
      const before = currentText[index - 1];
      const after = currentText[index + match.text.length];
      const wordBoundaryBefore = !before || /[\s.,;:!?'"()\[\]{}]/.test(before);
      const wordBoundaryAfter = !after || /[\s.,;:!?'"()\[\]{}]/.test(after);

      if (!wordBoundaryBefore || !wordBoundaryAfter) continue;

      replacements.push({
        index,
        length: match.text.length,
        match
      });

      linked.add(match.text);
      linkedCount++;
    }

    if (replacements.length === 0) return;

    // Sort by index
    replacements.sort((a, b) => a.index - b.index);

    // Build new content
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    for (const rep of replacements) {
      // Add text before this match
      if (rep.index > lastIndex) {
        fragment.appendChild(document.createTextNode(currentText.slice(lastIndex, rep.index)));
      }

      // Add the link
      fragment.appendChild(createWikiLink(rep.match.text, rep.match.info));

      lastIndex = rep.index + rep.length;
    }

    // Add remaining text
    if (lastIndex < currentText.length) {
      fragment.appendChild(document.createTextNode(currentText.slice(lastIndex)));
    }

    // Replace original text node
    textNode.parentNode.replaceChild(fragment, textNode);
  }

  // Walk DOM tree and process text nodes
  function walkAndProcess(element) {
    if (!element) return;

    // Skip certain elements
    if (element.nodeType === Node.ELEMENT_NODE) {
      if (SKIP_TAGS.has(element.tagName)) return;
      if (element.classList.contains('wikiproxy-link')) return;
      if (element.closest('.wikiproxy-link')) return;
    }

    // Process text nodes
    if (element.nodeType === Node.TEXT_NODE) {
      processTextNode(element);
      return;
    }

    // Recurse into children (copy array since we may modify DOM)
    const children = Array.from(element.childNodes);
    for (const child of children) {
      walkAndProcess(child);
    }
  }

  // Main processing function
  function processPage() {
    console.log('Wikiproxy: Processing page...');

    const startTime = performance.now();
    linkedCount = 0;

    // Find article content
    const contentElements = findArticleContent();
    if (contentElements.length === 0) {
      console.log('Wikiproxy: No article content found');
      return;
    }

    // Process each content element
    for (const element of contentElements) {
      walkAndProcess(element);
    }

    const elapsed = (performance.now() - startTime).toFixed(1);
    console.log(`Wikiproxy: Linked ${linkedCount} entities in ${elapsed}ms`);

    // Update badge
    chrome.runtime.sendMessage({
      type: 'updateBadge',
      count: linkedCount
    });
  }

  // Start
  init().catch(err => {
    console.error('Wikiproxy: Initialization error', err);
  });

})();
