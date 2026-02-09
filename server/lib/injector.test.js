// wikilinker/lib/injector.test.js
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { injectWikilinks } from './injector.js';

describe('injectWikilinks', () => {
  const testEntities = ['Barack Obama', 'Google'];

  test('injects wikilinks for matches', () => {
    const html = '<p>the reporter met Barack Obama at Google today.</p>';
    const result = injectWikilinks(html, 'p', testEntities);

    assert.ok(result.html.includes('href="https://en.wikipedia.org/wiki/Barack_Obama"'));
    assert.ok(result.html.includes('class="wikilink"'));
    assert.ok(result.html.includes('href="https://en.wikipedia.org/wiki/Google"'));
  });

  test('skips text already inside links', () => {
    const html = '<p>see <a href="/bio">Barack Obama</a> page.</p>';
    const result = injectWikilinks(html, 'p', testEntities);

    const obamaMatches = result.html.match(/Barack Obama/g);
    assert.strictEqual(obamaMatches.length, 1);
    assert.ok(!result.html.includes('class="wikilink"'));
  });

  test('only processes article selector content', () => {
    const html = `
      <nav><a>Barack Obama</a></nav>
      <article><p>the reporter met Barack Obama.</p></article>
    `;
    const result = injectWikilinks(html, 'article', testEntities);

    const wikilinks = result.html.match(/class="wikilink"/g);
    assert.strictEqual(wikilinks?.length || 0, 1);
  });

  test('always returns { html, stats } object', () => {
    const html = '<p>the reporter met Barack Obama.</p>';
    const result = injectWikilinks(html, 'p', testEntities);
    assert.strictEqual(typeof result, 'object');
    assert.ok(typeof result.html === 'string');
    assert.ok(typeof result.stats === 'object');
    assert.strictEqual(typeof result.stats.linked, 'number');
  });

  test('returns { html, stats, debugInfo } when debug=true', () => {
    const html = '<p>the reporter met Barack Obama at Google today.</p>';
    const result = injectWikilinks(html, 'p', testEntities, true);
    assert.strictEqual(typeof result, 'object');
    assert.ok(typeof result.html === 'string');
    assert.ok(result.stats);
    assert.ok(result.debugInfo);
    assert.ok(Array.isArray(result.debugInfo.matched));
    assert.ok(result.debugInfo.matched.some(m => m.text === 'Barack Obama'));
    assert.ok(result.debugInfo.matched.some(m => m.text === 'Google'));
  });

  test('stats.linked counts unique linked entities', () => {
    const html = '<p>the reporter met Barack Obama at Google today.</p>';
    const result = injectWikilinks(html, 'p', testEntities);
    assert.strictEqual(result.stats.linked, 2);
  });

  test('debug tracks already-linked skips', () => {
    const html = '<p>the reporter met Barack Obama.</p><p>then Barack Obama left.</p>';
    const result = injectWikilinks(html, 'p', testEntities, true);
    assert.ok(result.debugInfo.skippedAlreadyLinked.some(m => m.text === 'Barack Obama'));
  });

  test('debug includes allCandidates', () => {
    const html = '<p>the reporter met Barack Obama at Google today.</p>';
    const result = injectWikilinks(html, 'p', testEntities, true);
    assert.ok(result.debugInfo.allCandidates.includes('Barack Obama'));
    assert.ok(result.debugInfo.allCandidates.includes('Google'));
  });

  test('knownEntities pipeline only links pre-discovered entities', () => {
    const knownEntities = new Map([['Barack Obama', true]]);
    const html = '<p>the reporter met Barack Obama at Google today.</p>';
    const result = injectWikilinks(html, 'p', testEntities, false, knownEntities);
    assert.ok(result.html.includes('Barack_Obama'));
    assert.ok(!result.html.includes('wiki/Google'));
  });

  test('knownEntities pipeline with debug returns debugInfo', () => {
    const knownEntities = new Map([['Barack Obama', true]]);
    const html = '<p>the reporter met Barack Obama today.</p>';
    const result = injectWikilinks(html, 'p', testEntities, true, knownEntities);
    assert.ok(result.debugInfo);
    assert.ok(result.debugInfo.matched.some(m => m.text === 'Barack Obama'));
  });
});
