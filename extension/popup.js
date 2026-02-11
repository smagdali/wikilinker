// extension/popup.js
//
// Handles settings UI and persistence for the popup.

const SETTINGS = ['enabled'];

// Load current settings
async function loadSettings() {
  const data = await chrome.storage.local.get('settings');
  const settings = data.settings || {};

  for (const key of SETTINGS) {
    const checkbox = document.getElementById(key);
    if (checkbox) {
      checkbox.checked = settings[key] !== false; // Default to true
    }
  }
}

// Save settings when changed
async function saveSettings() {
  const settings = {};
  for (const key of SETTINGS) {
    const checkbox = document.getElementById(key);
    if (checkbox) {
      settings[key] = checkbox.checked;
    }
  }

  await chrome.storage.local.set({ settings });

  // Notify content script to refresh (if on a supported page)
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'settingsChanged', settings });
    }
  } catch (e) {
    // Content script may not be loaded on this page
  }
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

  // Add change listeners
  for (const key of SETTINGS) {
    const checkbox = document.getElementById(key);
    if (checkbox) {
      checkbox.addEventListener('change', saveSettings);
    }
  }
});
