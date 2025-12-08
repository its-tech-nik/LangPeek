// Background script for Middle-Click Translate
// Handles translation API calls and settings management

// Import polyfill for service worker compatibility (Chrome)
// When loaded as scripts array (Firefox), polyfill is already loaded via manifest
if (typeof importScripts === 'function') {
  importScripts('browser-polyfill.min.js');
}

const DEFAULT_TARGET_LANGUAGE = 'en';

// Get the target language from storage
async function getTargetLanguage() {
  try {
    const result = await browser.storage.sync.get('targetLanguage');
    return result.targetLanguage || DEFAULT_TARGET_LANGUAGE;
  } catch (error) {
    console.error('Error getting target language:', error);
    return DEFAULT_TARGET_LANGUAGE;
  }
}

// Translate text using Google Translate API
async function translateText(text, targetLang) {
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'auto'); // Auto-detect source language
  url.searchParams.set('tl', targetLang);
  url.searchParams.set('dt', 't'); // Return translated text
  url.searchParams.set('dj', '1'); // JSON response
  url.searchParams.set('q', text);

  console.log('Translating to:', targetLang, 'Text:', text.substring(0, 50));
  console.log('API URL:', url.toString());

  try {
    const response = await fetch(url.toString());
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Translation response:', data);
    
    // Parse the response - Google returns different formats
    let translatedText = '';
    let detectedLanguage = 'unknown';
    
    // Format with dj=1 (JSON format)
    if (data.sentences && Array.isArray(data.sentences)) {
      translatedText = data.sentences
        .filter(s => s.trans)
        .map(s => s.trans)
        .join('');
      detectedLanguage = data.src || 'unknown';
    }
    // Fallback: Format without dj=1 (array format)
    else if (data[0] && Array.isArray(data[0])) {
      translatedText = data[0]
        .filter(segment => segment && segment[0])
        .map(segment => segment[0])
        .join('');
      detectedLanguage = data[2] || 'unknown';
    }
    
    console.log('Translated text:', translatedText);
    console.log('Detected language:', detectedLanguage);
    
    if (!translatedText) {
      throw new Error('No translation text received');
    }
    
    return {
      success: true,
      translatedText,
      detectedLanguage,
      targetLanguage: targetLang
    };
  } catch (error) {
    console.error('Translation error:', error);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}

// Listen for messages from content script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translate') {
    // Handle translation request
    (async () => {
      const targetLang = await getTargetLanguage();
      const result = await translateText(message.text, targetLang);
      sendResponse(result);
    })();
    
    // Return true to indicate we'll send response asynchronously
    return true;
  }
  
  if (message.action === 'getSettings') {
    // Return current settings
    (async () => {
      const targetLang = await getTargetLanguage();
      sendResponse({ targetLanguage: targetLang });
    })();
    
    return true;
  }
});

// Initialize default settings on install
browser.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await browser.storage.sync.set({
      targetLanguage: DEFAULT_TARGET_LANGUAGE
    });
  }
});

