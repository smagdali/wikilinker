# Wikilinker

Auto-links 1,000,000 people, places and other names to Wikipedia on any webpage, using a [bloom filter](https://en.wikipedia.org/wiki/Bloom_filter) for compact name lookup, based on string matches against the [wikipedia titles](https://dumps.wikimedia.org/enwiki/latest/). The articles chosen were the most popular 1m (by [pageviews](https://dumps.wikimedia.org/other/pageview_complete/)) on wikipedia during Feb 2026.

There are two versions:

- **[Browser extension](extension/)** — a Chrome, Firefox, and Safari extension that links names to Wikipedia directly in your browser, on any website. Completely self-contained — all matching happens locally using a bloom filter over the top 1M Wikipedia titles (under 2MB), with no API calls, no external requests, and no logging.
- **[Server proxy](server/)** — a Node.js web proxy at [whitelabel.org/wikilinker](https://whitelabel.org/wikilinker) that fetches news pages and injects Wikipedia links into the article text. Really a demo of what the plugin can do.

Both share matching logic (`server/shared/matcher-core.js`) and [skip rules](server/shared/skip-rules.js) that determine which parts of a page to leave alone (navigation, headings, captions, etc.).


## History

Wikilinker is an updated version of the [Wikiproxy](https://whitelabel.org/2004/10/04/dont-get-me-wrong-i-really-like-bbc-news-online/), a hack I originally built in October 2004 that proxied BBC News Online, automatically hyperlinking capitalised phrases and acronyms to Wikipedia.

## Install

Install from the stores:

- [Chrome Web Store](https://chromewebstore.google.com/detail/wikilinker/niflckgdjlcciahgcankljebehnmlpii)
- [Firefox Add-ons](https://addons.mozilla.org/en-GB/firefox/addon/wikilinker/)

Or install manually:

1. Download the [latest release](https://github.com/smagdali/wikilinker/releases/latest)
2. **Chrome**: Go to `chrome://extensions`, enable Developer Mode, and drag in the ZIP (or click "Load unpacked" and select the `extension/` folder)
3. **Firefox**: Go to `about:addons` → gear icon → "Install Add-on From File" and select the ZIP
4. **Safari**: Open `safari/Wikilinker/Wikilinker.xcodeproj` in Xcode, build and run, then enable in Safari → Settings → Extensions

## Development

### Building the extension

Requires Node.js:

```bash
npm install
node extension/build.js            # production build
node extension/build.js --debug    # includes match logging (downloads a TSV per page)
```

Then load `extension/` as an unpacked extension in Chrome (`chrome://extensions`) or Firefox (`about:debugging`). For Safari, open `safari/Wikilinker/Wikilinker.xcodeproj` in Xcode.

A single build produces a package that works in Chrome, Firefox, and Safari.

### Supported sites

The extension runs on any website by default. It has been optimised on 19 news sites including BBC, NPR, CNN, The Guardian, Al Jazeera, and others (see `extension/manifest.json` for the full list), and uses fallback selectors (`article`, `main`, etc.) to find article content on other sites.

### Debug builds

```bash
node extension/build.js --debug
```

Debug builds include match logging that downloads a TSV report for each page, showing every candidate name, its match rule, context, and status (linked, overlapped, not-in-db, etc.). Debug code is completely stripped from normal builds via esbuild's `dropLabels`.

## Server

```bash
cd server
npm install
npm test
npm start        # runs on port 3000
```

Deploy to production: `bash scripts/deploy.sh`

## Adding a new site

To add support for a new news site:

1. **Add the site config** to `server/shared/sites.json`:

   ```json
   "example.com": {
     "name": "Example News",
     "articleSelector": ".article-body, .story-content",
     "homepageUrl": "https://www.example.com"
   }
   ```

   The key is the bare domain (no `www.`). The fields are:
   - `name` — display name, shown on the landing page and in the status bar.
   - `articleSelector` — CSS selector(s) for article body containers. Comma-separate multiple selectors. Use your browser's DevTools to inspect the article text on the site and find the most specific container.
   - `homepageUrl` — link to the site's homepage, shown on the landing page.

2. **Add host permissions** to `extension/manifest.json` — add `"https://*.example.com/*"` to both the `host_permissions` and `content_scripts.matches` arrays.

3. **Test it** — run the proxy against an article from the site:

   ```
   http://localhost:3000/proxy?url=https://www.example.com/some-article
   ```

   Check that links appear in the article text and not in navigation, headers, or sidebars. If links appear in the wrong places, adjust the `articleSelector` to be more specific.

4. **Rebuild the extension**: `node extension/build.js`

### Tips for finding the right selector

- Open an article on the site and right-click the article text → Inspect.
- Look for the nearest parent element that wraps all the article paragraphs but not the navigation, sidebar, or footer.
- Common patterns: `article`, `.article-body`, `[itemprop="articleBody"]`, `.story-text`.
- Test your selector in the browser console: `document.querySelectorAll('.your-selector')` should return the article container(s).
- Multiple selectors (comma-separated) are tried in order — put the most specific first.

More info: [About Wikilinker](https://whitelabel.org/wikilinker/about)

