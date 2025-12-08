// Options page script for Middle-Click Translate

const DEFAULT_TARGET_LANGUAGE = 'en';

// DOM Elements
const targetLanguageSelect = document.getElementById('targetLanguage');
const saveStatus = document.getElementById('saveStatus');

// Load saved settings
async function loadSettings() {
  try {
    const result = await browser.storage.sync.get('targetLanguage');
    const targetLanguage = result.targetLanguage || DEFAULT_TARGET_LANGUAGE;
    targetLanguageSelect.value = targetLanguage;
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('Failed to load settings', 'error');
  }
}

// Save settings
async function saveSettings() {
  try {
    await browser.storage.sync.set({
      targetLanguage: targetLanguageSelect.value
    });
    showStatus('Settings saved', 'success');
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('Failed to save settings', 'error');
  }
}

// Show status message with animation
function showStatus(message, type = 'success') {
  saveStatus.textContent = message;
  saveStatus.className = `save-status ${type} visible`;
  
  // Hide after 2 seconds
  setTimeout(() => {
    saveStatus.classList.remove('visible');
  }, 2000);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  
  // Auto-save on change
  targetLanguageSelect.addEventListener('change', saveSettings);
});

