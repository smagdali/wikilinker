# Wikiproxy

A Chrome extension that auto-links named entities to Wikipedia on news sites.

**A revival of the [original Wikiproxy](https://whitelabel.org/2004/10/04/dont-get-me-wrong-i-really-like-bbc-news-online/) from 2004.**

## Features

- Automatically detects proper nouns and entities in news articles
- Links them to their Wikipedia pages
- Color-coded by entity type:
  - **Blue** - People
  - **Green** - Countries
  - **Teal** - Cities
  - **Purple** - Organizations
  - **Orange** - Companies
- Works on 25+ major news sites
- 343,000+ entities from Wikidata
- No API calls - instant local matching
- Configurable via popup settings

## Supported Sites

BBC, CNN, The Guardian, New York Times, Washington Post, Reuters, AP News, NPR, Al Jazeera, NBC News, CBS News, ABC News, Fox News, USA Today, Daily Mail, The Independent, The Telegraph, The Economist, Financial Times, The Atlantic, The New Yorker, Politico, Axios, Vox

## Installation

### From Source (Developer Mode)

1. Clone this repository
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode" (top right)
4. Click "Load unpacked"
5. Select the `wikiproxy-extension` folder

### Entity Data

The extension includes pre-built entity data. To rebuild from Wikidata:

```bash
# In the whitelabel.org repo
node scripts/download-wikidata-entities.js
cp wikiproxy-data/entities.json ../wikiproxy-extension/data/
```

## How It Works

1. **Content script** scans article text for capitalized phrases and acronyms
2. **Candidate phrases** are matched against a local database of 343K+ Wikidata entities
3. **Matching entities** are wrapped in Wikipedia links with type-specific styling
4. **Badge** shows the count of linked entities on each page

## Privacy

- All entity matching happens locally in your browser
- No data is sent to external servers
- No tracking or analytics

## License

MIT

## Credits

- Original Wikiproxy (2004): [Stefan Magdalinski](https://whitelabel.org)
- Entity data: [Wikidata](https://www.wikidata.org/) (CC0)
