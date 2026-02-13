(() => {
  // server/shared/skip-rules.js
  var SKIP_TAGS = /* @__PURE__ */ new Set([
    // Script/style
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    // Interactive elements
    "A",
    "BUTTON",
    "INPUT",
    "TEXTAREA",
    "SELECT",
    "LABEL",
    // Navigation/chrome
    "NAV",
    "HEADER",
    "FOOTER",
    "ASIDE",
    // Headlines - these are navigation, not body text
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    // Code/preformatted
    "CODE",
    "PRE",
    "KBD",
    "SAMP",
    // Media/embedded
    "SVG",
    "MATH",
    "IFRAME",
    "OBJECT",
    "EMBED",
    "CANVAS",
    // Document structure (non-content)
    "HEAD",
    "TITLE",
    "META",
    "LINK",
    // Figure captions - usually photo credits/descriptions
    "FIGCAPTION",
    // List elements - in news sites, lists are usually navigation/teasers
    "LI",
    // Table elements - usually data, not article text
    "TH",
    "TD"
  ]);
  var SKIP_SELECTORS = [
    // ARIA roles
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="complementary"]',
    '[role="search"]',
    '[role="menu"]',
    '[role="menubar"]',
    '[role="toolbar"]',
    '[role="button"]',
    '[aria-hidden="true"]',
    // Data attributes
    '[data-component="nav"]',
    '[data-component="navigation"]',
    '[data-component="header"]',
    '[data-testid="promo"]',
    '[data-testid="card"]',
    // Commerce/shopping sections
    "[data-commerce]",
    "[data-affiliate]"
  ];
  var SKIP_CLASS_PATTERNS = [
    // Navigation/menus
    "menu",
    "nav-",
    "-nav",
    // Headlines/titles (when not skipped by tag)
    "headline",
    "title",
    "heading",
    // Teasers/decks/leads
    "teaser",
    "dek",
    "lede",
    "leadin",
    "lead-in",
    "standfirst",
    "summary",
    "excerpt",
    // Cards/promos
    "card",
    "promo",
    "tout",
    "featured",
    "spotlight",
    // Credits/captions
    "credit",
    "caption",
    "byline",
    "author",
    "source",
    // Interactive/widgets
    "widget",
    "embed",
    "video-",
    "-video",
    "interactive",
    // Note: 'module' removed - too broad, matches CSS Modules class names (e.g. article-body-module__wrapper)
    // Item listings
    "item-info",
    "item-image",
    "list-item",
    // Common grid/layout patterns that aren't article body
    "rail",
    "sidebar",
    "related",
    // Note: 'grid' removed - too broad, matches CSS Grid layout classes (e.g. container--grid)
    // Intro/outro sections
    "intro",
    "outro",
    "leadin",
    "g-intro",
    "g-leadin",
    // Commerce/shopping content (affiliate links, product listings)
    "commerce",
    "shopping",
    "buyline",
    "affiliate",
    "product",
    // Structured data
    "speakable",
    "schema",
    "ld-json"
  ];
  function hasSkipClassPattern(element, getClassFn) {
    const className = getClassFn(element);
    if (className) {
      const classLower = className.toLowerCase();
      for (const pattern of SKIP_CLASS_PATTERNS) {
        if (classLower.includes(pattern)) {
          return true;
        }
      }
    }
    return false;
  }
  function shouldSkipElement(element, closestFn, getClassFn) {
    try {
      const tagName = element?.tagName?.toUpperCase?.() || element?.tagName;
      if (tagName && SKIP_TAGS.has(tagName)) {
        return true;
      }
      for (const selector of SKIP_SELECTORS) {
        if (closestFn(element, selector)) {
          return true;
        }
      }
      if (getClassFn && hasSkipClassPattern(element, getClassFn)) {
        return true;
      }
      return false;
    } catch {
      return true;
    }
  }

  // server/shared/matcher-core.js
  var SKIP_WORDS = /* @__PURE__ */ new Set([
    // Pronouns and determiners
    "The",
    "This",
    "That",
    "There",
    "Their",
    "They",
    "What",
    "When",
    "Where",
    "Which",
    "Who",
    "Why",
    "How",
    "He",
    "She",
    "His",
    "Her",
    "Him",
    "Its",
    "We",
    "Our",
    "You",
    "Your",
    "My",
    // Days and months
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
    // Common English words that are also Wikipedia titles
    "About",
    "After",
    "Again",
    "Album",
    "Also",
    "Ammunition",
    "Another",
    "Archive",
    "Assault",
    "Before",
    "Being",
    "Both",
    "But",
    "Cash",
    "Cast",
    "Category",
    "Christmas",
    "Code",
    "Contact",
    "Control",
    "Copyright",
    "Despite",
    "Download",
    "Each",
    "Email",
    "Error",
    "Even",
    "Every",
    "Everything",
    "Evidence",
    "Expect",
    "Family",
    "Film",
    "Fireworks",
    "First",
    "Following",
    "Former",
    "Free",
    "Freedom",
    "From",
    "General",
    "Golden",
    "Good",
    "Great",
    "Greatness",
    "Greed",
    "Here",
    "Image",
    "Indeed",
    "Just",
    "Keep",
    "Language",
    "Last",
    "Life",
    "Like",
    "Link",
    "List",
    "Live",
    "Machine",
    "Many",
    "Media",
    "Meanwhile",
    "Minutes",
    "More",
    "Most",
    "Much",
    "Name",
    "Nation",
    "Never",
    "New",
    "News",
    "Next",
    "Night",
    "Nobody",
    "None",
    "Nothing",
    "Number",
    "Office",
    "Often",
    "Only",
    "Other",
    "Over",
    "Page",
    "People",
    "Play",
    "Please",
    "Pointless",
    "Police",
    "Power",
    "Productivity",
    "Public",
    "Question",
    "Radio",
    "Real",
    "Same",
    "Service",
    "Several",
    "Sign",
    "Since",
    "Sniper",
    "Some",
    "South",
    "Special",
    "Stalemate",
    "State",
    "Steam",
    "Still",
    "Success",
    "Such",
    "Sunrise",
    "Time",
    "Title",
    "Today",
    "Together",
    "Very",
    "Watch",
    "Website",
    "Wedding",
    "Welcome",
    "Well",
    "While",
    "White",
    "Whole",
    "Woman",
    "Wood",
    "World",
    "Writer",
    "Year",
    "Zero",
    // Compass/directional (match as part of multi-word like "South Korea")
    "North",
    "East",
    "West",
    // Demonym adjectives — link the country instead
    "African",
    "American",
    "Arab",
    "Asian",
    "Australian",
    "Brazilian",
    "British",
    "Canadian",
    "Chinese",
    "Dutch",
    "Egyptian",
    "English",
    "European",
    "French",
    "German",
    "Greek",
    "Indian",
    "Iranian",
    "Iraqi",
    "Irish",
    "Islamic",
    "Israeli",
    "Italian",
    "Japanese",
    "Korean",
    "Latin",
    "Mexican",
    "Palestinian",
    "Polish",
    "Russian",
    "Scottish",
    "Spanish",
    "Swedish",
    "Turkish",
    "Ukrainian",
    "Vietnamese",
    "Welsh",
    // Institutional/role words (too generic alone, valid in multi-word phrases)
    "Academic",
    "Athletes",
    "Bureaucrat",
    "Cabinet",
    "Commons",
    "Conservative",
    "Constitution",
    "Creativity",
    "Customs",
    "Democracy",
    "Deputy",
    "Environment",
    "Geography",
    "Health",
    "History",
    "House",
    "Immigration",
    "Justice",
    "Liberal",
    "Ministry",
    "Opposition",
    "Parliament",
    "Partnership",
    "Poetry",
    "Prince",
    "Princess",
    "Producer",
    "Professor",
    "Republic",
    "Secretary",
    "Security",
    "Transparency",
    "Treasury",
    // Stock photo attribution words
    "Alamy",
    "Getty",
    "Shutterstock"
  ]);
  function meetsMinLength(phrase) {
    if (phrase.includes(" ")) return true;
    if (/^[A-Z]+$/.test(phrase)) return phrase.length >= 3;
    return phrase.length >= 4;
  }
  var FILLER_LEADING = /^(?:of|and|in|on|under|the|for)\s+/i;
  var FILLER_TRAILING = /\s+(?:of|and|in|on|under|the|for)$/i;
  function trimFillers(phrase) {
    let result = phrase;
    while (FILLER_LEADING.test(result)) {
      result = result.replace(FILLER_LEADING, "");
    }
    while (FILLER_TRAILING.test(result)) {
      result = result.replace(FILLER_TRAILING, "");
    }
    return result;
  }
  function normaliseCurlyQuotes(text) {
    return text.replace(/[\u2018\u2019]/g, "'");
  }
  function extractCandidates(text) {
    const candidates = /* @__PURE__ */ new Set();
    const capsWord = "[A-Z][a-zA-Z'\\-]+";
    const filler = "(?:of|and|in|on|under|the|for)";
    const greedyRe = new RegExp(`\\b(${capsWord}(?:\\s+(?:${filler}|${capsWord}))*\\s+${capsWord})\\b`, "g");
    const patterns = [
      greedyRe,
      new RegExp(`\\b(${capsWord}(?:\\s+${capsWord})+)\\b`, "g"),
      new RegExp(`\\b(${capsWord})\\b`, "g"),
      /\b([A-Z]{2,6})\b/g
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
  function isSentenceStart(text, index) {
    if (index === 0) return true;
    let i = index - 1;
    while (i >= 0 && /\s/.test(text[i])) i--;
    if (i < 0) return true;
    return /[.!?;]/.test(text[i]);
  }
  function isPartOfLargerPhrase(text, start, end) {
    if (start > 0) {
      const charBefore = text[start - 1];
      if (charBefore === " ") {
        const textBefore = text.slice(0, start - 1);
        const lastWord = textBefore.match(/[A-Z][a-zA-Z''\-]*$/);
        if (lastWord) return true;
      }
    }
    if (end < text.length) {
      const charAfter = text[end];
      if (charAfter === " ") {
        const textAfter = text.slice(end + 1);
        const nextWord = textAfter.match(/^[A-Z][a-zA-Z''\-]*/);
        if (nextWord) return true;
      }
    }
    return false;
  }
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function findMatches(text, entitySet2) {
    const normalised = normaliseCurlyQuotes(text);
    const candidates = extractCandidates(normalised);
    const matches = [];
    for (const candidate of candidates) {
      if (entitySet2.has(candidate)) {
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
        const overlaps = usedRanges.some(
          ([s, e]) => start >= s && start < e || end > s && end <= e || start <= s && end >= e
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
  function toWikiUrl(entityName) {
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(entityName.replace(/ /g, "_"))}`;
  }

  // server/shared/sites.json
  var sites_default = {
    "bbc.com": {
      name: "BBC News",
      articleSelector: 'article, [data-component="text-block"], .ssrcss-11r1m41-RichTextComponentWrapper',
      homepageUrl: "https://www.bbc.com/news"
    },
    "bbc.co.uk": {
      name: "BBC News UK",
      articleSelector: 'article, [data-component="text-block"], .ssrcss-11r1m41-RichTextComponentWrapper',
      homepageUrl: "https://www.bbc.co.uk/news"
    },
    "apnews.com": {
      name: "AP News",
      articleSelector: ".RichTextStoryBody, .Article",
      homepageUrl: "https://apnews.com"
    },
    "npr.org": {
      name: "NPR",
      articleSelector: ".storytext, #storytext, .story-text",
      homepageUrl: "https://www.npr.org"
    },
    "aljazeera.com": {
      name: "Al Jazeera",
      articleSelector: ".wysiwyg, .article-p-wrapper",
      homepageUrl: "https://www.aljazeera.com"
    },
    "nbcnews.com": {
      name: "NBC News",
      articleSelector: ".article-body, .article-body__content",
      homepageUrl: "https://www.nbcnews.com"
    },
    "cbsnews.com": {
      name: "CBS News",
      articleSelector: ".content__body, .article-content",
      homepageUrl: "https://www.cbsnews.com"
    },
    "foxnews.com": {
      name: "Fox News",
      articleSelector: ".article-body, .article-content",
      homepageUrl: "https://www.foxnews.com"
    },
    "usatoday.com": {
      name: "USA Today",
      articleSelector: ".gnt_ar_b, .article-body",
      homepageUrl: "https://www.usatoday.com"
    },
    "dailymail.co.uk": {
      name: "Daily Mail",
      articleSelector: '[itemprop="articleBody"], .article-text',
      homepageUrl: "https://www.dailymail.co.uk"
    },
    "independent.co.uk": {
      name: "The Independent",
      articleSelector: "article, #main-content, .article-body",
      homepageUrl: "https://www.independent.co.uk"
    },
    "newyorker.com": {
      name: "The New Yorker",
      articleSelector: ".body__inner-container, .article__body",
      homepageUrl: "https://www.newyorker.com"
    },
    "vox.com": {
      name: "Vox",
      articleSelector: ".c-entry-content, .article-body",
      homepageUrl: "https://www.vox.com"
    },
    "theguardian.com": {
      name: "The Guardian",
      articleSelector: ".article-body-commercial-selector, [data-gu-name='body'], #maincontent",
      homepageUrl: "https://www.theguardian.com"
    },
    "cnn.com": {
      name: "CNN",
      articleSelector: ".article__content, [itemprop='articleBody'], .article__content-container",
      homepageUrl: "https://edition.cnn.com"
    },
    "abcnews.go.com": {
      name: "ABC News",
      articleSelector: "[data-testid='prism-article-body'], .FITT_Article_main__body",
      homepageUrl: "https://abcnews.go.com"
    },
    "sky.com": {
      name: "Sky News",
      articleSelector: ".sdc-article-body",
      homepageUrl: "https://news.sky.com"
    },
    "unherd.com": {
      name: "UnHerd",
      articleSelector: ".article-body, article",
      homepageUrl: "https://unherd.com"
    }
  };

  // extension/src/content.js
  var ALLOW_INSIDE_ARTICLE = /* @__PURE__ */ new Set(["LI", "TH", "TD"]);
  var entitySet = null;
  var settings = {};
  async function init() {
    if (window.__wikilinkerInit) return;
    window.__wikilinkerInit = true;
    try {
      const [entityResponse, settingsResponse] = await Promise.all([
        chrome.runtime.sendMessage({ type: "getEntities" }),
        chrome.runtime.sendMessage({ type: "getSettings" })
      ]);
      entitySet = new Set(entityResponse.set);
      settings = settingsResponse || {};
      if (settings.enabled === false) return;
      if (isBlockedSite()) return;
      processPage();
    } catch (err) {
      console.error("Wikilinker: init failed", err);
    }
  }
  var BLOCKED_SITES = ["wikipedia.org", "wikimedia.org", "wiktionary.org"];
  function isBlockedSite() {
    const hostname = location.hostname.replace(/^www\./, "");
    return BLOCKED_SITES.some((d) => hostname === d || hostname.endsWith("." + d));
  }
  function isSupportedSite() {
    const hostname = location.hostname.replace(/^www\./, "");
    return !!(sites_default[hostname] || Object.entries(sites_default).find(
      ([domain]) => hostname === domain || hostname.endsWith("." + domain)
    )?.[1]);
  }
  function findArticleContainers() {
    const hostname = location.hostname.replace(/^www\./, "");
    const siteConfig = sites_default[hostname] || Object.entries(sites_default).find(
      ([domain]) => hostname === domain || hostname.endsWith("." + domain)
    )?.[1];
    if (siteConfig?.articleSelector) {
      const selectors = siteConfig.articleSelector.split(",").map((s) => s.trim());
      for (const sel of selectors) {
        const elements = document.querySelectorAll(sel);
        if (elements.length > 0) return Array.from(elements);
      }
    }
    const fallbacks = [
      "article",
      '[role="article"]',
      ".article-body",
      ".article__body",
      ".story-body",
      "main"
    ];
    for (const sel of fallbacks) {
      const elements = document.querySelectorAll(sel);
      if (elements.length > 0) return Array.from(elements);
    }
    return [];
  }
  function processPage() {
    const containers = findArticleContainers();
    if (containers.length === 0) return;
    const linkedEntities = /* @__PURE__ */ new Set();
    let linkCount = 0;
    for (const container of containers) {
      linkCount += walkAndProcess(container, linkedEntities, false, true);
    }
    if (linkCount > 0) {
      chrome.runtime.sendMessage({ type: "setBadge", count: linkCount });
    }
  }
  function walkAndProcess(element, linkedEntities, insideLink = false, isRoot = false) {
    if (!element) return 0;
    let count = 0;
    if (!isRoot && element.nodeType === Node.ELEMENT_NODE) {
      const tag = element.tagName?.toUpperCase();
      const insideArticle = true;
      const allowedInArticle = insideArticle && ALLOW_INSIDE_ARTICLE.has(tag);
      if (!allowedInArticle && shouldSkipElement(
        element,
        (el, sel) => !!el.closest?.(sel),
        (el) => el.className || ""
      )) {
        return 0;
      }
    }
    if (element.classList?.contains("wikilink")) return 0;
    const isLink = element.tagName?.toUpperCase() === "A";
    const nowInsideLink = insideLink || isLink;
    const children = Array.from(element.childNodes);
    for (const node of children) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (nowInsideLink) continue;
        const text = node.textContent;
        if (text.trim().length < 3) continue;
        const matches = findMatches(text, entitySet);
        if (matches.length === 0) continue;
        count += replaceTextNode(node, text, matches, linkedEntities);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        count += walkAndProcess(node, linkedEntities, nowInsideLink, false);
      }
    }
    return count;
  }
  function replaceTextNode(textNode, text, matches, linkedEntities) {
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let count = 0;
    for (const match of matches) {
      if (linkedEntities.has(match.text)) continue;
      if (match.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      fragment.appendChild(createWikiLink(match.text));
      lastIndex = match.index + match.text.length;
      linkedEntities.add(match.text);
      count++;
    }
    if (count === 0) return 0;
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    textNode.parentNode.replaceChild(fragment, textNode);
    return count;
  }
  function createWikiLink(entityName) {
    const link = document.createElement("a");
    link.href = toWikiUrl(entityName);
    link.className = "wikilink";
    link.title = `${entityName} \u2014 Wikipedia`;
    link.target = "_blank";
    link.rel = "noopener";
    link.appendChild(document.createTextNode(entityName));
    return link;
  }
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "settingsChanged") {
      settings = message.settings;
      document.querySelectorAll(".wikilink").forEach((link) => {
        const text = document.createTextNode(link.textContent);
        link.parentNode.replaceChild(text, link);
      });
      if (settings.enabled !== false && !isBlockedSite() && (isSupportedSite() || settings.allSites)) {
        processPage();
      }
    }
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
