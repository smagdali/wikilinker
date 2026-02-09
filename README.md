# Wikilinker

Auto-links people, places, and organizations to Wikipedia in news articles.

Two components:

- **[Server proxy](server/)** — a Node.js web proxy at [whitelabel.org/wikilinker](https://whitelabel.org/wikilinker) that fetches news pages and injects Wikipedia links into the article text.
- **[Chrome extension](extension/)** — a browser extension that does the same thing client-side, directly in your browser.

Both share a set of [skip rules](server/shared/skip-rules.js) that determine which parts of a page to leave alone (navigation, headings, captions, etc.).

## Server

```bash
cd server
npm install
npm test
npm start        # runs on port 3000
```

Deploy to production: `bash scripts/deploy.sh`

## Extension

Load `extension/` as an unpacked extension in Chrome via `chrome://extensions`.

## History

Wikilinker is an updated version of the [Wikiproxy](https://whitelabel.org/2004/10/04/dont-get-me-wrong-i-really-like-bbc-news-online/), a hack originally built in October 2004 that proxied BBC News Online, automatically hyperlinking capitalised phrases and acronyms to Wikipedia.
