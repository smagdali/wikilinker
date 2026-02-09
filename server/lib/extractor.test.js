// wikilinker/lib/extractor.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { extractArticleBody, getSiteConfig } from './extractor.js';

describe('getSiteConfig', () => {
  test('returns config for known sites', () => {
    const config = getSiteConfig('https://www.bbc.com/news/article');
    assert.ok(config);
    assert.strictEqual(config.name, 'BBC News');
  });

  test('returns null for unknown sites', () => {
    const config = getSiteConfig('https://unknownsite.com/page');
    assert.strictEqual(config, null);
  });
});

describe('extractArticleBody', () => {
  test('extracts content using selector', () => {
    const html = `
      <html>
        <body>
          <nav>Navigation</nav>
          <article>
            <h1>Article Title</h1>
            <p>Article content here.</p>
          </article>
          <footer>Footer</footer>
        </body>
      </html>
    `;
    const result = extractArticleBody(html, 'article');
    assert.ok(result.includes('Article Title'));
    assert.ok(result.includes('Article content'));
    assert.ok(!result.includes('Navigation'));
    assert.ok(!result.includes('Footer'));
  });

  test('falls back to body for unknown sites', () => {
    const html = `
      <html>
        <body>
          <div>Some content</div>
        </body>
      </html>
    `;
    const result = extractArticleBody(html, null);
    assert.ok(result.includes('Some content'));
  });
});
