// extension/popup.js
//
// Handles settings UI and persistence for the popup.

// Replace [data-i18n] text content with chrome.i18n messages.
function applyI18n() {
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const msg = chrome.i18n.getMessage(el.dataset.i18n);
    if (msg) el.textContent = msg;
  }
}

const enabledCheckbox = () => document.getElementById('enabled');
const multiWordOnlyCheckbox = () => document.getElementById('multiWordOnly');
const multiWordSection = () => document.getElementById('multiWordSection');

// Load current settings
async function loadSettings() {
  const data = await chrome.storage.local.get('settings');
  const settings = data.settings || {};

  enabledCheckbox().checked = settings.enabled !== false;
  multiWordOnlyCheckbox().checked = settings.multiWordOnly === true;

  updateToggleStates();
}

// Disable options when main toggle is off
function updateToggleStates() {
  const enabled = enabledCheckbox().checked;
  const section = multiWordSection();
  if (enabled) {
    section.classList.remove('disabled');
  } else {
    section.classList.add('disabled');
  }
}

// Read current settings from the checkboxes
function readSettings() {
  return {
    enabled: enabledCheckbox().checked,
    multiWordOnly: multiWordOnlyCheckbox().checked,
  };
}

// Save settings and notify content script + update icon
async function saveSettings() {
  const settings = readSettings();
  await chrome.storage.local.set({ settings });

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'settingsChanged', settings });
    }
  } catch (e) {
    // Content script may not be loaded on this page
  }
}

// Handle the main enable toggle
async function handleEnabledToggle() {
  updateToggleStates();
  await saveSettings();
}

// Load entity count
async function loadStats() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'getEntities' });
    const count = response.set?.length || response.entityCount || 0;
    document.getElementById('entityCount').textContent = count.toLocaleString();
  } catch (e) {
    document.getElementById('entityCount').textContent = 'Error';
  }

  // Get current page link count from badge
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const badgeText = await chrome.action.getBadgeText({ tabId: tab.id });
      const linkCount = /^\d+$/.test(badgeText) ? badgeText : '0';
      document.getElementById('pageLinks').textContent = linkCount;
    }
  } catch (e) {
    document.getElementById('pageLinks').textContent = '-';
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  applyI18n();
  await loadSettings();
  await loadStats();

  enabledCheckbox().addEventListener('change', handleEnabledToggle);
  multiWordOnlyCheckbox().addEventListener('change', saveSettings);
});
