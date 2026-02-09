(() => {
  // extension/src/background.js
  var entityData = null;
  var entitySet = null;
  async function loadEntities() {
    try {
      const url = chrome.runtime.getURL("data/entities.json");
      const response = await fetch(url);
      entityData = await response.json();
      entitySet = Object.keys(entityData);
      console.log(`Wikilinker: loaded ${entitySet.length} entities`);
    } catch (err) {
      console.error("Wikilinker: failed to load entities", err);
    }
  }
  chrome.runtime.onInstalled.addListener(loadEntities);
  chrome.runtime.onStartup.addListener(loadEntities);
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "getEntities") {
      if (!entityData) {
        loadEntities().then(() => {
          sendResponse({ entities: entityData, set: entitySet });
        });
        return true;
      }
      sendResponse({ entities: entityData, set: entitySet });
      return false;
    }
    if (message.type === "getSettings") {
      chrome.storage.local.get("settings", (data) => {
        sendResponse(data.settings || {});
      });
      return true;
    }
    if (message.type === "setBadge") {
      const count = message.count || 0;
      chrome.action.setBadgeText({
        text: count > 0 ? String(count) : "",
        tabId: sender.tab?.id
      });
      chrome.action.setBadgeBackgroundColor({
        color: "#6366f1",
        tabId: sender.tab?.id
      });
      return false;
    }
  });
})();
