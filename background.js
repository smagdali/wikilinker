/**
 * Wikiproxy Background Service Worker
 *
 * Handles:
 * - Loading and caching entity data
 * - Communication with content scripts
 * - Badge updates
 */

// Entity data cache
let entityData = null;
let entitySet = null; // For fast "exists?" checks

// Load entity data on extension install/update
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Wikiproxy installed');
  await loadEntityData();

  // Set default settings
  const settings = await chrome.storage.local.get('settings');
  if (!settings.settings) {
    await chrome.storage.local.set({
      settings: {
        enabled: true,
        showPersons: true,
        showCountries: true,
        showCities: true,
        showOrgs: true,
        showCompanies: true,
        underlineStyle: 'dotted', // dotted, solid, none
        highlightOnHover: true,
      }
    });
  }
});

// Load entity data from bundled JSON
async function loadEntityData() {
  try {
    const url = chrome.runtime.getURL('data/entities.json');
    const response = await fetch(url);
    entityData = await response.json();
    entitySet = new Set(Object.keys(entityData));
    console.log(`Wikiproxy: Loaded ${entitySet.size} entities`);
    return true;
  } catch (err) {
    console.error('Wikiproxy: Failed to load entity data', err);
    return false;
  }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getEntities') {
    // Content script requesting entity data
    if (!entityData) {
      loadEntityData().then(() => {
        sendResponse({ entities: entityData, set: Array.from(entitySet || []) });
      });
      return true; // Keep channel open for async response
    }
    sendResponse({ entities: entityData, set: Array.from(entitySet) });
    return false;
  }

  if (message.type === 'checkEntities') {
    // Check if phrases exist in our entity database
    const results = {};
    for (const phrase of message.phrases) {
      if (entityData && entityData[phrase]) {
        results[phrase] = entityData[phrase];
      }
    }
    sendResponse({ results });
    return false;
  }

  if (message.type === 'getSettings') {
    chrome.storage.local.get('settings').then(data => {
      sendResponse({ settings: data.settings });
    });
    return true;
  }

  if (message.type === 'updateBadge') {
    // Update extension badge with entity count
    const count = message.count;
    if (count > 0) {
      chrome.action.setBadgeText({
        text: count > 99 ? '99+' : String(count),
        tabId: sender.tab.id
      });
      chrome.action.setBadgeBackgroundColor({
        color: '#4a90d9',
        tabId: sender.tab.id
      });
    } else {
      chrome.action.setBadgeText({ text: '', tabId: sender.tab.id });
    }
    return false;
  }
});

// Ensure data is loaded when service worker starts
loadEntityData();
