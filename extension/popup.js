// extension/popup.js
//
// Handles settings UI and persistence for the popup.

const enabledCheckbox = () => document.getElementById('enabled');
const allSitesCheckbox = () => document.getElementById('allSites');
const allSitesSection = () => document.getElementById('allSitesSection');

// Load current settings
async function loadSettings() {
  const data = await chrome.storage.local.get('settings');
  const settings = data.settings || {};

  enabledCheckbox().checked = settings.enabled !== false;
  allSitesCheckbox().checked = settings.allSites === true;

  updateAllSitesState();
}

// Update allSites section enabled/disabled based on main toggle
function updateAllSitesState() {
  const section = allSitesSection();
  if (enabledCheckbox().checked) {
    section.classList.remove('disabled');
  } else {
    section.classList.add('disabled');
  }
}

// Read current settings from the checkboxes
function readSettings() {
  return {
    enabled: enabledCheckbox().checked,
    allSites: allSitesCheckbox().checked,
  };
}

// Save settings and notify content script + update icon
async function saveSettings() {
  const settings = readSettings();
  await chrome.storage.local.set({ settings });

  const allSites = settings.allSites && settings.enabled;
  chrome.runtime.sendMessage({ type: 'updateIcon', allSites });

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'settingsChanged', settings });
    }
  } catch (e) {
    // Content script may not be loaded on this page
  }
}

// Handle the "all sites" toggle — request permission, register/unregister
async function handleAllSitesToggle() {
  const checkbox = allSitesCheckbox();

  if (checkbox.checked) {
    // Request broad host permission (requires user gesture — we have it from the click)
    let granted = false;
    try {
      granted = await chrome.permissions.request({ origins: ['<all_urls>'] });
    } catch (e) {
      granted = false;
    }

    if (!granted) {
      checkbox.checked = false;
      return;
    }

    // Register dynamic content script for all URLs
    await chrome.runtime.sendMessage({ type: 'registerAllSites' });
    await saveSettings();

    // Inject into the current tab immediately for instant feedback
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['styles.css'] });
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['dist/content.js'] });
      }
    } catch (e) {
      // May fail on chrome:// pages etc — that's fine
    }
  } else {
    // Unregister dynamic content script
    await chrome.runtime.sendMessage({ type: 'unregisterAllSites' });
    await saveSettings();
  }
}

// Handle the main enable toggle
async function handleEnabledToggle() {
  updateAllSitesState();

  // If disabling and allSites is on, also unregister the dynamic script
  if (!enabledCheckbox().checked && allSitesCheckbox().checked) {
    await chrome.runtime.sendMessage({ type: 'unregisterAllSites' });
  }

  // If re-enabling and allSites is on, re-register
  if (enabledCheckbox().checked && allSitesCheckbox().checked) {
    await chrome.runtime.sendMessage({ type: 'registerAllSites' });
  }

  await saveSettings();
}

// Load entity count
async function loadStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'getEntities' });
    const count = response.set?.length || 0;
    document.getElementById('entityCount').textContent = count.toLocaleString();
  } catch (e) {
    document.getElementById('entityCount').textContent = 'Error';
  }

  // Get current page link count from badge
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const badgeText = await chrome.action.getBadgeText({ tabId: tab.id });
      document.getElementById('pageLinks').textContent = badgeText || '0';
    }
  } catch (e) {
    document.getElementById('pageLinks').textContent = '-';
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await loadStats();

  enabledCheckbox().addEventListener('change', handleEnabledToggle);
  allSitesCheckbox().addEventListener('change', handleAllSitesToggle);
});
