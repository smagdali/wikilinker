// extension/src/background.js
//
// Background service worker. Entity data is bundled at build time
// via esbuild JSON import. Serves it to content scripts on demand.

import entities from '../../server/shared/entities.json';

console.log(`Wikilinker: ${entities.length} entities bundled`);

// Tint the toolbar icon green when allSites is active
async function updateIcon(allSites) {
  if (!allSites) {
    // Reset to default icons
    chrome.action.setIcon({ path: { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' } });
    return;
  }
  // Tint each icon size green
  for (const size of [16, 48]) {
    try {
      const resp = await fetch(chrome.runtime.getURL(`icons/icon${size}.png`));
      const bitmap = await createImageBitmap(await resp.blob());
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      // Green overlay with multiply blend
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(52, 168, 83, 0.45)';
      ctx.fillRect(0, 0, size, size);
      const imageData = ctx.getImageData(0, 0, size, size);
      chrome.action.setIcon({ imageData: { [size]: imageData } });
    } catch (e) {
      // Fallback: just use default icon
    }
  }
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
    sendResponse({ set: entities });
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
    // Green badge when allSites is on, indigo for supported sites only
    chrome.storage.local.get('settings', (data) => {
      chrome.action.setBadgeBackgroundColor({
        color: data.settings?.allSites ? '#34a853' : '#6366f1',
        tabId,
      });
    });
    return false;
  }
});
