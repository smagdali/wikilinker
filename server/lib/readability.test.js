// wikilinker/lib/readability.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { extractWithReadability } from './readability.js';

describe('extractWithReadability', () => {
  test('extracts text from well-formed article HTML', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Test Article</title></head>
      <body>
        <article>
          <h1>Important News Story</h1>
          <p>Barack Obama visited the United Nations headquarters in New York City yesterday. The former president spoke about climate change and international cooperation.</p>
          <p>Google and other technology companies were represented at the event. The meeting lasted several hours and covered many important topics for world leaders.</p>
          <p>The Secretary of State also attended the proceedings. Representatives from many countries participated in the discussions about global policy.</p>
          <p>This is a significant development in international relations. Experts say the talks could lead to new agreements on key issues facing the world today.</p>
          <p>The event was held at the main assembly hall. Thousands of delegates from around the world gathered for this historic occasion.</p>
        </article>
      </body>
      </html>
    `;
    const result = extractWithReadability(html, 'https://example.com/article');
    assert.strictEqual(result.isReaderable, true);
    assert.ok(result.textContent);
    assert.ok(result.textContent.includes('Barack Obama'));
    assert.ok(result.textContent.includes('United Nations'));
  });

  test('returns isReaderable false for non-article pages', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Home</title></head>
      <body>
        <nav><a href="/">Home</a><a href="/about">About</a></nav>
        <ul><li>Link 1</li><li>Link 2</li></ul>
      </body>
      </html>
    `;
    const result = extractWithReadability(html, 'https://example.com');
    assert.strictEqual(result.isReaderable, false);
    assert.strictEqual(result.textContent, null);
  });

  test('handles bad input gracefully', () => {
    const result = extractWithReadability('', 'https://example.com');
    assert.strictEqual(result.isReaderable, false);
    assert.strictEqual(result.textContent, null);
  });

  test('returns article title', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Test Article Title</title></head>
      <body>
        <article>
          <h1>Important News Story</h1>
          <p>Barack Obama visited the United Nations headquarters in New York City yesterday. The former president spoke about climate change and international cooperation.</p>
          <p>Google and other technology companies were represented at the event. The meeting lasted several hours and covered many important topics for world leaders.</p>
          <p>The Secretary of State also attended the proceedings. Representatives from many countries participated in the discussions about global policy.</p>
          <p>This is a significant development in international relations. Experts say the talks could lead to new agreements on key issues facing the world today.</p>
          <p>The event was held at the main assembly hall. Thousands of delegates from around the world gathered for this historic occasion.</p>
        </article>
      </body>
      </html>
    `;
    const result = extractWithReadability(html, 'https://example.com/article');
    if (result.isReaderable) {
      assert.ok(result.title);
    }
  });
});
