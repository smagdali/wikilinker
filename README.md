# Wikilinker

Auto-links people, places, and organizations to Wikipedia in news articles.

Two components:

- **[Server proxy](server/)** — a Node.js web proxy at [whitelabel.org/wikilinker](https://whitelabel.org/wikilinker) that fetches news pages and injects Wikipedia links into the article text.
- **[Chrome extension](extension/)** *(WIP, untested)* — a browser extension that does the same thing client-side, directly in your browser.

Both share matching logic (`server/shared/matcher-core.js`) and [skip rules](server/shared/skip-rules.js) that determine which parts of a page to leave alone (navigation, headings, captions, etc.).

## Server

```bash
cd server
npm install
npm test
npm start        # runs on port 3000
```

Deploy to production: `bash scripts/deploy.sh`

## Extension

Build the extension (requires Node.js):

```bash
npm install
npm run build:extension
```

Then load `extension/` as an unpacked extension in Chrome via `chrome://extensions`.

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

2. **Copy the config** to `server/data/sites.json` (keep both in sync for now).

3. **Add host permissions** to `extension/manifest.json` — add `"https://*.example.com/*"` to both the `host_permissions` and `content_scripts.matches` arrays.

4. **Test it** — run the proxy against an article from the site:

   ```
   http://localhost:3000/proxy?url=https://www.example.com/some-article
   ```

   Check that links appear in the article text and not in navigation, headers, or sidebars. If links appear in the wrong places, adjust the `articleSelector` to be more specific.

5. **Rebuild the extension**: `npm run build:extension`

### Tips for finding the right selector

- Open an article on the site and right-click the article text → Inspect.
- Look for the nearest parent element that wraps all the article paragraphs but not the navigation, sidebar, or footer.
- Common patterns: `article`, `.article-body`, `[itemprop="articleBody"]`, `.story-text`.
- Test your selector in the browser console: `document.querySelectorAll('.your-selector')` should return the article container(s).
- Multiple selectors (comma-separated) are tried in order — put the most specific first.

## History

Wikilinker is an updated version of the [Wikiproxy](https://whitelabel.org/2004/10/04/dont-get-me-wrong-i-really-like-bbc-news-online/), a hack originally built in October 2004 that proxied BBC News Online, automatically hyperlinking capitalised phrases and acronyms to Wikipedia.
