// extension/src/background-bloom.js
//
// Background service worker (bloom filter variant).
// Loads a compact bloom filter instead of the full entity array.
// The filter is sent to content scripts which do their own .has() lookups.

import bloomBin from '../../server/shared/entities-bloom.bin';
import { BloomFilter } from '../../server/shared/bloom.js';

const bloom = BloomFilter.deserialize(bloomBin);
const entityCount = (bloom.m / 19.17).toFixed(0); // approximate from m/n ratio
console.log(`Wikilinker: bloom filter loaded (${(bloomBin.length / 1024 / 1024).toFixed(1)}MB, ~${Number(entityCount).toLocaleString()} entities)`);

// Show "all" badge when allSites is active
function updateIcon(allSites) {
  chrome.action.setBadgeText({ text: allSites ? 'all' : '' });
  chrome.action.setBadgeBackgroundColor({ color: allSites ? '#34a853' : '#6366f1' });
}

// Watch for settings changes to update icon
chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    updateIcon(changes.settings.newValue?.allSites && changes.settings.newValue?.enabled !== false);
  }
});

// Re-register dynamic content script if allSites was enabled before reload
chrome.storage.local.get('settings', (data) => {
  if (data.settings?.allSites && data.settings?.enabled !== false) {
    chrome.scripting.registerContentScripts([{
      id: 'wikilinker-all-sites',
      matches: ['<all_urls>'],
      js: ['dist/content.js'],
      css: ['styles.css'],
      runAt: 'document_idle',
    }]).catch(() => {}); // already registered
  }
  updateIcon(data.settings?.allSites && data.settings?.enabled !== false);
});

// Serve data to content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getEntities') {
    // Send the raw bloom filter binary — content script reconstructs it
    sendResponse({ bloom: Array.from(bloomBin) });
    return false;
  }

  if (message.type === 'getSettings') {
    chrome.storage.local.get('settings', (data) => {
      sendResponse(data.settings || {});
    });
    return true; // async response
  }

  if (message.type === 'updateIcon') {
    updateIcon(message.allSites);
    return false;
  }

  if (message.type === 'registerAllSites') {
    chrome.scripting.registerContentScripts([{
      id: 'wikilinker-all-sites',
      matches: ['<all_urls>'],
      js: ['dist/content.js'],
      css: ['styles.css'],
      runAt: 'document_idle',
    }]).then(() => sendResponse({ ok: true }))
      .catch(err => {
        if (err.message?.includes('already registered')) {
          sendResponse({ ok: true });
        } else {
          sendResponse({ error: err.message });
        }
      });
    return true;
  }

  if (message.type === 'unregisterAllSites') {
    chrome.scripting.unregisterContentScripts({ ids: ['wikilinker-all-sites'] })
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.type === 'setBadge') {
    const count = message.count || 0;
    const tabId = sender.tab?.id;
    chrome.action.setBadgeText({
      text: count > 0 ? String(count) : '',
      tabId,
    });
    chrome.storage.local.get('settings', (data) => {
      chrome.action.setBadgeBackgroundColor({
        color: data.settings?.allSites ? '#34a853' : '#6366f1',
        tabId,
      });
    });
    return false;
  }
});
