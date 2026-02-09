// wikilinker/lib/fetcher.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { isUrlAllowed, fetchPage } from './fetcher.js';

describe('URL validation', () => {
  test('blocks localhost', () => {
    assert.strictEqual(isUrlAllowed('http://localhost/'), false);
    assert.strictEqual(isUrlAllowed('http://127.0.0.1/'), false);
  });

  test('blocks private IPs', () => {
    assert.strictEqual(isUrlAllowed('http://192.168.1.1/'), false);
    assert.strictEqual(isUrlAllowed('http://10.0.0.1/'), false);
    assert.strictEqual(isUrlAllowed('http://172.16.0.1/'), false);
  });

  test('allows public URLs', () => {
    assert.strictEqual(isUrlAllowed('https://www.bbc.com/news'), true);
    assert.strictEqual(isUrlAllowed('https://example.com/page'), true);
  });

  test('blocks non-http protocols', () => {
    assert.strictEqual(isUrlAllowed('file:///etc/passwd'), false);
    assert.strictEqual(isUrlAllowed('ftp://example.com'), false);
  });
});

describe('fetchPage', () => {
  test('rejects blocked URLs', async () => {
    await assert.rejects(
      fetchPage('http://localhost/'),
      { message: /blocked/i }
    );
  });
});
