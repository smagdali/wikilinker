// wikilinker/lib/fetcher.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { isUrlAllowed, fetchPage } from './fetcher.js';

const allowedDomains = ['bbc.com', 'bbc.co.uk', 'apnews.com', 'npr.org'];

describe('URL validation (domain allowlist)', () => {
  test('allows supported domains', () => {
    assert.strictEqual(isUrlAllowed('https://www.bbc.com/news', allowedDomains), true);
    assert.strictEqual(isUrlAllowed('https://www.bbc.co.uk/news/article-123', allowedDomains), true);
    assert.strictEqual(isUrlAllowed('https://apnews.com/article/test', allowedDomains), true);
    assert.strictEqual(isUrlAllowed('https://www.npr.org/sections/news', allowedDomains), true);
  });

  test('allows subdomains of supported domains', () => {
    assert.strictEqual(isUrlAllowed('https://news.bbc.com/page', allowedDomains), true);
  });

  test('blocks unsupported domains', () => {
    assert.strictEqual(isUrlAllowed('https://example.com/page', allowedDomains), false);
    assert.strictEqual(isUrlAllowed('https://evil.com/', allowedDomains), false);
    assert.strictEqual(isUrlAllowed('https://www.cnn.com/news', allowedDomains), false);
  });

  test('blocks localhost and private IPs', () => {
    assert.strictEqual(isUrlAllowed('http://localhost/', allowedDomains), false);
    assert.strictEqual(isUrlAllowed('http://127.0.0.1/', allowedDomains), false);
    assert.strictEqual(isUrlAllowed('http://192.168.1.1/', allowedDomains), false);
    assert.strictEqual(isUrlAllowed('http://10.0.0.1/', allowedDomains), false);
  });

  test('blocks non-http protocols', () => {
    assert.strictEqual(isUrlAllowed('file:///etc/passwd', allowedDomains), false);
    assert.strictEqual(isUrlAllowed('ftp://bbc.com', allowedDomains), false);
    assert.strictEqual(isUrlAllowed('javascript:alert(1)', allowedDomains), false);
  });

  test('blocks partial domain matches', () => {
    // "fakebbc.com" should not match "bbc.com"
    assert.strictEqual(isUrlAllowed('https://fakebbc.com/news', allowedDomains), false);
  });

  test('handles invalid URLs gracefully', () => {
    assert.strictEqual(isUrlAllowed('not a url', allowedDomains), false);
    assert.strictEqual(isUrlAllowed('', allowedDomains), false);
  });
});

describe('fetchPage', () => {
  test('rejects URLs not in allowlist', async () => {
    await assert.rejects(
      fetchPage('http://evil.com/', { allowedDomains }),
      { message: /not supported/i }
    );
  });

  test('requires allowedDomains option', async () => {
    await assert.rejects(
      fetchPage('https://www.bbc.com/news', {}),
      { message: /allowedDomains required/i }
    );
  });
});
