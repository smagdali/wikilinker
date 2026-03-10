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
  allSitesCheckbox().checked = settings.allSites !== false;

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

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'settingsChanged', settings });
    }
  } catch (e) {
    // Content script may not be loaded on this page
  }
}

// Handle the "all sites" toggle — just save the setting
// Content script runs on all URLs via manifest; this setting controls
// whether it processes non-supported sites
async function handleAllSitesToggle() {
  await saveSettings();
}

// Handle the main enable toggle
async function handleEnabledToggle() {
  updateAllSitesState();
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
  await loadSettings();
  await loadStats();

  enabledCheckbox().addEventListener('change', handleEnabledToggle);
  allSitesCheckbox().addEventListener('change', handleAllSitesToggle);
});
