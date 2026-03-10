# Wikilinker

Auto-links the most popular 1,000,000 people, places, organizations, and other matchable names to their [Wikipedia](https://en.wikipedia.org/) pages on any webpage, using a [bloom filter](https://en.wikipedia.org/wiki/Bloom_filter) for compact name lookup.

## Browser extension

The best way to use Wikilinker is with the browser extension for **Chrome**, **Firefox**, and **Safari**. It works on any website, runs entirely in your browser, and makes no API calls, no external requests, and no logging. The extension bundles a bloom filter of the top 1M Wikipedia titles (ranked by [pageviews](https://dumps.wikimedia.org/other/pageview_complete/)) in under 2MB.

Install from the stores:

- [Chrome Web Store](https://chromewebstore.google.com/detail/wikilinker/niflckgdjlcciahgcankljebehnmlpii)
- [Firefox Add-ons](https://addons.mozilla.org/en-GB/firefox/addon/wikilinker/)

Or [download the latest release](https://github.com/smagdali/wikilinker/releases/latest) and install manually:

- **Chrome**: Go to `chrome://extensions`, enable Developer Mode, and drag in the ZIP (or click "Load unpacked" and select the `extension/` folder)
- **Firefox**: Go to `about:addons` → gear icon → "Install Add-on From File" and select the ZIP
- **Safari**: Open the Xcode project in `safari/Wikilinker/`, build and run, then enable in Safari → Settings → Extensions

[Source code on GitHub](https://github.com/smagdali/wikilinker)

## Web proxy demo

You can also try Wikilinker as a web proxy here — paste a URL or try one of these articles:

- [US allies looking to China for deals as Trump threatens them with tariffs](https://whitelabel.org/wikilinker?url=https://www.npr.org/2026/01/28/nx-s1-5688905/longtime-u-s-allies-are-shifting-trade-to-asia-due-to-trumps-tariffs-and-rhetoric) (NPR)
- [Trump's 'maximalist demands' for Iran put talks in Oman on uncertain ground](https://whitelabel.org/wikilinker?url=https://www.aljazeera.com/news/2026/2/6/trumps-maximalist-demands-for-iran-put-talks-in-oman-on-uncertain-ground) (Al Jazeera)
- [Machine guns to machetes: Weapons that massacred thousands in Iran](https://whitelabel.org/wikilinker?url=https://www.bbc.co.uk/news/articles/c0mgndkklvmo) (BBC News)
- [Prince and Princess of Wales 'deeply concerned' by Epstein revelations about Andrew](https://whitelabel.org/wikilinker?url=https://www.theguardian.com/uk-news/2026/feb/09/prince-princess-wales-deeply-concerned-epstein-revelations-andrew) (The Guardian)
- [US will exit 66 international organizations](https://whitelabel.org/wikilinker?url=https://www.nbcnews.com/world/north-america/us-will-exit-66-international-organizations-retreats-global-cooperatio-rcna252914) (NBC News)

## How it works

Both the extension and the proxy use the same matching pipeline:

1. **Extract** — The article text is extracted from the page (the extension walks the DOM; the proxy uses Mozilla's [Readability](https://github.com/mozilla/readability) library). The text is scanned for name candidates: capitalised phrases, multi-word proper nouns, and known acronyms (e.g. "European Union", "FBI"). Short words are filtered — mixed-case words need at least 4 characters, ALL CAPS acronyms at least 3 — to avoid false positives on words like "In" or "US".
2. **Match** — Each candidate is checked against a local index of the most popular (by [pageviews](https://dumps.wikimedia.org/other/pageview_complete/)) 1,000,000 [Wikipedia article titles](https://dumps.wikimedia.org/enwiki/latest/). Only exact matches become links — no fuzzy matching, no API calls. The extension uses a [bloom filter](https://en.wikipedia.org/wiki/Bloom_filter), which means there's roughly a 1 in 10,000 chance a link points to a page that doesn't actually exist. If you spot one, [I'd love to hear about it](https://github.com/smagdali/wikilinker/issues/new).
3. **Inject** — Matched names are linked in the original page, using site-specific CSS selectors to target article body containers. Headlines, navigation, captions, and other non-body text are skipped. Each name is linked only on its first occurrence, keeping the reading experience clean.

## History

Wikilinker is an updated version of the Wikiproxy, a hack I originally did in October 2004. Time really does fly. That version proxied [BBC News Online](https://bbc.co.uk/news), automatically hyperlinking capitalised phrases and acronyms to Wikipedia.

I was pleasantly surprised to find [Cory Doctorow](https://pluralistic.net/) mentioned it in a footnote in his book [Enshittification](https://www.versobooks.com/products/3359-enshittification), and so it felt like reviving it would be good project for me and my new code buddy Claude to work on. Terrifyingly, as of Feb 9th 2026, I haven't even looked at the code Claude produced, other than giving feedback on the output. What a way to work.

You can read the original write-up here: [Don't get me wrong, I really like BBC News Online](https://whitelabel.org/2004/10/04/dont-get-me-wrong-i-really-like-bbc-news-online/) (2004). The [original PHP source](https://whitelabel.org/assets/archive/wp/wikiproxy.php.txt) is also still online.

Twenty-two years later, the idea is the same — news articles should connect you to background knowledge — but the implementation has moved from a PHP script to a Node.js proxy with a proper name-matching pipeline. I'm still tweaking it, feedback is welcome.

## Disclaimer

This is a non-commercial technology demo. All news content displayed through this proxy is the copyright of its respective publishers. Wikilinker does not store, redistribute, or claim any ownership of that content — it simply fetches pages on your behalf (much like a browser) and adds hyperlinks to Wikipedia. If you are a rights holder and have concerns, put that lawyer down and ask nicely, and I'll take you off the list.

## Thanks

[George Oates](http://abitofgeorge.com/) for bullying me into thinking about styling.

Stefan Magdalinski
February 2026
