// extension/src/background-bloom.js
//
// Background service worker (bloom filter variant).
// Loads a compact bloom filter instead of the full entity array.
// The filter is sent to content scripts which do their own .has() lookups.

import bloomBin from '../../server/shared/entities-bloom.bin';
import { BloomFilter } from '../../server/shared/bloom.js';

const bloom = BloomFilter.deserialize(bloomBin);
const entityCount = ENTITY_COUNT;
console.log(`Wikilinker: bloom filter loaded (${(bloomBin.length / 1024 / 1024).toFixed(1)}MB, ${entityCount.toLocaleString()} entities)`);

// Serve data to content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getEntities') {
    // Send the raw bloom filter binary — content script reconstructs it
    sendResponse({ bloom: Array.from(bloomBin), entityCount: Number(entityCount) });
    return false;
  }

  if (message.type === 'getSettings') {
    chrome.storage.local.get('settings', (data) => {
      sendResponse(data.settings || {});
    });
    return true; // async response
  }

  if (message.type === 'setBadge') {
    const count = message.count || 0;
    const tabId = sender.tab?.id;
    chrome.action.setBadgeText({
      text: count > 0 ? String(count) : '',
      tabId,
    });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1', tabId });
    return false;
  }
});
