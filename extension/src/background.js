// extension/src/background.js
//
// Background service worker. Loads entity data at install and
// serves it to content scripts on demand.

let entityData = null;  // { name: [typeCode, wikidataId] }
let entitySet = null;   // Array of entity names (for transfer to content script)

async function loadEntities() {
  try {
    const url = chrome.runtime.getURL('data/entities.json');
    const response = await fetch(url);
    entityData = await response.json();
    entitySet = Object.keys(entityData);
    console.log(`Wikilinker: loaded ${entitySet.length} entities`);
  } catch (err) {
    console.error('Wikilinker: failed to load entities', err);
  }
}

// Load on install/update
chrome.runtime.onInstalled.addListener(loadEntities);

// Also load on startup (service worker may have been killed)
chrome.runtime.onStartup.addListener(loadEntities);

// Serve data to content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getEntities') {
    if (!entityData) {
      // Lazy load if not yet loaded
      loadEntities().then(() => {
        sendResponse({ entities: entityData, set: entitySet });
      });
      return true; // async response
    }
    sendResponse({ entities: entityData, set: entitySet });
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
    chrome.action.setBadgeText({
      text: count > 0 ? String(count) : '',
      tabId: sender.tab?.id,
    });
    chrome.action.setBadgeBackgroundColor({
      color: '#6366f1',
      tabId: sender.tab?.id,
    });
    return false;
  }
});
