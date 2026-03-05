// extension/src/background.js
//
// Background service worker. Entity data is bundled at build time
// via esbuild JSON import. Serves it to content scripts on demand.

import entities from '../../server/shared/entities.json';

console.log(`Wikilinker: ${entities.length} entities bundled`);

// Re-register dynamic content script if allSites was enabled before reload
chrome.storage.local.get('settings', (data) => {
  if (data.settings?.allSites !== false && data.settings?.enabled !== false) {
    chrome.scripting.registerContentScripts([{
      id: 'wikilinker-all-sites',
      matches: ['<all_urls>'],
      js: ['dist/content.js'],
      css: ['styles.css'],
      runAt: 'document_idle',
    }]).catch(() => {}); // already registered
  }
});

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

  if (message.type === 'registerAllSites') {
    chrome.scripting.registerContentScripts([{
      id: 'wikilinker-all-sites',
      matches: ['<all_urls>'],
      js: ['dist/content.js'],
      css: ['styles.css'],
      runAt: 'document_idle',
    }]).then(() => sendResponse({ ok: true }))
      .catch(err => {
        // Already registered — update instead
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
      .catch(() => sendResponse({ ok: true })); // already gone
    return true;
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
