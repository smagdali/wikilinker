// wikilinker/test/skip-rules.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SKIP_TAGS, SKIP_SELECTORS, shouldSkipElement } from '../shared/skip-rules.js';

describe('SKIP_TAGS', () => {
  it('includes navigation-related tags', () => {
    assert.ok(SKIP_TAGS.has('NAV'));
    assert.ok(SKIP_TAGS.has('HEADER'));
    assert.ok(SKIP_TAGS.has('FOOTER'));
    assert.ok(SKIP_TAGS.has('ASIDE'));
  });

  it('includes interactive elements', () => {
    assert.ok(SKIP_TAGS.has('A'));
    assert.ok(SKIP_TAGS.has('BUTTON'));
    assert.ok(SKIP_TAGS.has('INPUT'));
  });

  it('includes code/preformatted elements', () => {
    assert.ok(SKIP_TAGS.has('CODE'));
    assert.ok(SKIP_TAGS.has('PRE'));
    assert.ok(SKIP_TAGS.has('SCRIPT'));
    assert.ok(SKIP_TAGS.has('STYLE'));
  });
});

describe('shouldSkipElement', () => {
  it('skips elements with skip tags', () => {
    const element = { tagName: 'NAV' };
    const closestFn = () => false;
    assert.strictEqual(shouldSkipElement(element, closestFn), true);
  });

  it('skips elements inside navigation role', () => {
    const element = { tagName: 'DIV' };
    const closestFn = (el, sel) => sel === '[role="navigation"]';
    assert.strictEqual(shouldSkipElement(element, closestFn), true);
  });

  it('allows normal paragraph elements', () => {
    const element = { tagName: 'P' };
    const closestFn = () => false;
    assert.strictEqual(shouldSkipElement(element, closestFn), false);
  });

  it('returns true on error (defensive)', () => {
    const element = null;
    const closestFn = () => { throw new Error('test'); };
    assert.strictEqual(shouldSkipElement(element, closestFn), true);
  });
});
