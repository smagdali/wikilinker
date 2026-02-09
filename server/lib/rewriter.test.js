// wikilinker/lib/rewriter.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { rewriteLinks } from './rewriter.js';

describe('rewriteLinks', () => {
  test('rewrites internal links to go through proxy', () => {
    const html = '<a href="/news/article">Link</a>';
    const result = rewriteLinks(html, 'https://www.bbc.com/news', '/wikilinker');

    // URL should be encoded when used as query parameter
    assert.ok(result.includes('/wikilinker?url=' + encodeURIComponent('https://www.bbc.com/news/article')));
  });

  test('rewrites absolute same-origin links', () => {
    const html = '<a href="https://www.bbc.com/sport">Sport</a>';
    const result = rewriteLinks(html, 'https://www.bbc.com/news', '/wikilinker');

    // URL should be encoded when used as query parameter
    assert.ok(result.includes('/wikilinker?url=' + encodeURIComponent('https://www.bbc.com/sport')));
  });

  test('preserves external links', () => {
    const html = '<a href="https://example.com/page">External</a>';
    const result = rewriteLinks(html, 'https://www.bbc.com/news', '/wikilinker');

    assert.ok(result.includes('href="https://example.com/page"'));
    assert.ok(!result.includes('/wikilinker?url=https://example.com'));
  });

  test('preserves wikilinks', () => {
    const html = '<a href="https://en.wikipedia.org/wiki/Test" class="wikilink">Test</a>';
    const result = rewriteLinks(html, 'https://www.bbc.com/news', '/wikilinker');

    assert.ok(result.includes('href="https://en.wikipedia.org/wiki/Test"'));
    assert.ok(!result.includes('/wikilinker'));
  });

  test('handles hash links', () => {
    const html = '<a href="#section">Jump</a>';
    const result = rewriteLinks(html, 'https://www.bbc.com/news', '/wikilinker');

    assert.ok(result.includes('href="#section"'));
  });
});
