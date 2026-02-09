# Wikilinker

Auto-links people, places, and organizations to [Wikipedia](https://en.wikipedia.org/) in news articles.

## History

Wikilinker is an updated version of the Wikiproxy, a hack I originally did in October 2004. Time really does fly. That version proxied [BBC News Online](https://bbc.co.uk/news), automatically hyperlinking capitalised phrases and acronyms to Wikipedia.

I was pleasantly surprised to find [Cory Doctorow](https://pluralistic.net/) mentioned it in a footnote in his book [Enshittification](https://www.versobooks.com/products/3359-enshittification), and so it felt like reviving it would be good project for me and my new code buddy Claude to work on. Terrifyingly, as of Feb 9th 2026, I haven't even looked at the code Claude produced, other than giving feedback on the output. What a way to work.

You can read the original write-up here: [Don't get me wrong, I really like BBC News Online](https://whitelabel.org/2004/10/04/dont-get-me-wrong-i-really-like-bbc-news-online/) (2004). The [original PHP source](https://whitelabel.org/assets/archive/wp/wikiproxy.php.txt) is also still online.

Twenty-two years later, the idea is the same — news articles should connect you to background knowledge — but the implementation has moved from a PHP script to a Node.js proxy with a proper entity matching pipeline. I'm still tweaking it, feedback is welcome.

## What it does

Wikilinker is a web proxy that takes news articles from any of its supported sites and automatically adds Wikipedia links to the people, places, organizations, and other notable entities mentioned in the text. Each entity is linked only on its first occurrence, keeping the reading experience clean.

Currently supported sites: BBC News, BBC News UK, AP News, NPR, Al Jazeera, NBC News, CBS News, Fox News, USA Today, Daily Mail, The Independent, The Atlantic, The New Yorker, and Vox.

## How it works

1. **Fetch** — The proxy fetches the original news page.
2. **Detect** — Index pages and section fronts are detected and passed through without modification — wikilinks are only added to articles.
3. **Extract** — For articles, Mozilla's [Readability](https://github.com/mozilla/readability) library extracts the main text (like Firefox Reader View), which is then scanned for entity candidates: capitalised phrases, multi-word proper nouns, and known acronyms (e.g. "European Union", "FBI"). Short words are filtered — mixed-case words need at least 4 characters, ALL CAPS at least 2 — to avoid false positives on words like "In" or "It".
4. **Match** — Each candidate is checked against a local index of the most popular (by pageviews) 500,000 Wikipedia article titles. Only exact matches become links — no fuzzy matching, no API calls. There are sometimes false positives, although it does try to link to disambiguation pages where appropriate.
5. **Inject** — The discovered entities are linked in the original page HTML (not the Readability extract), using site-specific CSS selectors to target article body containers. Headlines, navigation, captions, and other non-body text are skipped.
6. **Rewrite** — All links in the page are rewritten to route back through the proxy, so you can keep browsing with wikilinks enabled.

## Disclaimer

This is a non-commercial technology demo. All news content displayed through this proxy is the copyright of its respective publishers. Wikilinker does not store, redistribute, or claim any ownership of that content — it simply fetches pages on your behalf (much like a browser) and adds hyperlinks to Wikipedia. If you are a rights holder and have concerns, put that lawyer down and ask nicely, and I'll take you off the list.

Stefan Magdalinski
February 2026

[Source code on GitHub](https://github.com/smagdali/wikilinker)
