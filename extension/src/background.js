// extension/src/background.js
//
// Background service worker. Entity data is bundled at build time
// via esbuild JSON import. Serves it to content scripts on demand.

import entities from '../../server/shared/entities.json';

console.log(`Wikilinker: ${entities.length} entities bundled`);

// Serve data to content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getEntities') {
    sendResponse({ set: entities });
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
