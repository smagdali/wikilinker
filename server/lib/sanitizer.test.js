// wikilinker/lib/sanitizer.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { sanitizeHtml } from './sanitizer.js';

describe('sanitizeHtml', () => {
  test('removes script tags', () => {
    const input = '<div>Hello<script>alert("xss")</script>World</div>';
    const result = sanitizeHtml(input);
    assert.ok(!result.includes('<script'));
    assert.ok(!result.includes('alert'));
    assert.ok(result.includes('Hello'));
    assert.ok(result.includes('World'));
  });

  test('removes iframe tags', () => {
    const input = '<div>Content<iframe src="evil.com"></iframe></div>';
    const result = sanitizeHtml(input);
    assert.ok(!result.includes('<iframe'));
  });

  test('removes inline event handlers', () => {
    const input = '<button onclick="alert(1)">Click</button>';
    const result = sanitizeHtml(input);
    assert.ok(!result.includes('onclick'));
    assert.ok(result.includes('Click'));
  });

  test('removes javascript: hrefs', () => {
    const input = '<a href="javascript:alert(1)">Link</a>';
    const result = sanitizeHtml(input);
    assert.ok(!result.includes('javascript:'));
  });

  test('preserves safe content', () => {
    const input = '<article><h1>Title</h1><p>Paragraph with <a href="https://example.com">link</a></p></article>';
    const result = sanitizeHtml(input);
    assert.ok(result.includes('<article'));
    assert.ok(result.includes('<h1>Title</h1>'));
    assert.ok(result.includes('href="https://example.com"'));
  });
});
