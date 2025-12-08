// Content script for Middle-Click Translate
// Handles text selection, middle-click detection, and tooltip display

(function() {
  'use strict';

  let currentTooltip = null;
  let dismissTimeout = null;

  // Create and show the translation tooltip
  function createTooltip(x, y, content, isLoading = false) {
    // Remove any existing tooltip
    removeTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'mct-tooltip';
    
    if (isLoading) {
      tooltip.classList.add('mct-loading');
      tooltip.innerHTML = `
        <span class="mct-spinner"></span>
        <span class="mct-loading-text">Translating...</span>
      `;
    } else {
      tooltip.innerHTML = content;
    }

    document.body.appendChild(tooltip);
    currentTooltip = tooltip;

    // Position tooltip with viewport bounds checking
    requestAnimationFrame(() => {
      const rect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 10;
      const offsetBelow = 15; // Space between cursor and tooltip when below
      const offsetAbove = 10; // Space between cursor and tooltip when above
      
      const tooltipWidth = rect.width;
      const tooltipHeight = rect.height;
      
      let left, top;
      
      // === HORIZONTAL POSITIONING ===
      // Try to center on cursor first
      left = x - (tooltipWidth / 2);
      
      // Check if tooltip would go off the right edge
      if (left + tooltipWidth > viewportWidth - margin) {
        // Position from right edge
        left = viewportWidth - tooltipWidth - margin;
      }
      
      // Check if tooltip would go off the left edge
      if (left < margin) {
        // Position from left edge
        left = margin;
      }
      
      // === VERTICAL POSITIONING ===
      // Calculate potential positions
      const topIfBelow = y + offsetBelow;
      const topIfAbove = y - tooltipHeight - offsetAbove;
      
      // Check if tooltip fits below the cursor
      const fitsBelow = (topIfBelow + tooltipHeight) <= (viewportHeight - margin);
      
      // Check if tooltip fits above the cursor
      const fitsAbove = topIfAbove >= margin;
      
      if (fitsBelow) {
        // Place below cursor
        top = topIfBelow;
      } else if (fitsAbove) {
        // Place above cursor
        top = topIfAbove;
      } else {
        // Doesn't fit either way - place where there's more space
        const spaceBelow = viewportHeight - y;
        const spaceAbove = y;
        
        if (spaceBelow > spaceAbove) {
          // More space below - position at bottom of viewport
          top = Math.max(margin, viewportHeight - tooltipHeight - margin);
        } else {
          // More space above - position at top of viewport
          top = margin;
        }
      }
      
      // Final safety check - ensure tooltip is fully within viewport
      if (top < margin) {
        top = margin;
      }
      if (top + tooltipHeight > viewportHeight - margin) {
        top = viewportHeight - tooltipHeight - margin;
      }
      
      // Apply final position
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;

      // Trigger animation
      tooltip.classList.add('mct-visible');
    });

    // Auto-dismiss after 8 seconds
    dismissTimeout = setTimeout(() => {
      removeTooltip();
    }, 8000);

    // Dismiss on click outside
    document.addEventListener('mousedown', handleOutsideClick);
    // Dismiss on scroll
    document.addEventListener('scroll', removeTooltip, { once: true, passive: true });
  }

  // Update existing tooltip with translation result
  function updateTooltip(translatedText, detectedLang, targetLang, originalText) {
    if (!currentTooltip) return;

    currentTooltip.classList.remove('mct-loading');
    
    const langNames = getLanguageNames();
    const sourceLangName = langNames[detectedLang] || detectedLang;
    
    // Create language options for dropdown
    const languageOptions = getLanguageOptions();
    const selectOptions = languageOptions.map(opt => 
      `<option value="${opt.code}" ${opt.code === targetLang ? 'selected' : ''}>${opt.name}</option>`
    ).join('');

    currentTooltip.innerHTML = `
      <div class="mct-header">
        <span class="mct-title">Translation</span>
        <button class="mct-close" title="Close">✕</button>
      </div>
      <div class="mct-lang-row">
        <div class="mct-lang-field">
          <label class="mct-lang-label">From</label>
          <div class="mct-lang-display">${sourceLangName}</div>
        </div>
        <div class="mct-lang-field">
          <label class="mct-lang-label">To</label>
          <select class="mct-lang-select" id="mct-target-lang">
            ${selectOptions}
          </select>
        </div>
      </div>
      <div class="mct-translation" id="mct-translation-text">${escapeHtml(translatedText)}</div>
      <div class="mct-footer">
        <button class="mct-btn mct-btn-secondary" id="mct-copy-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          Copy
        </button>
        <button class="mct-btn mct-btn-primary" id="mct-done-btn">Done</button>
      </div>
    `;

    // Store data for re-translation
    currentTooltip.dataset.originalText = originalText;
    currentTooltip.dataset.detectedLang = detectedLang;

    // Add event listeners
    const closeBtn = currentTooltip.querySelector('.mct-close');
    const copyBtn = currentTooltip.querySelector('#mct-copy-btn');
    const doneBtn = currentTooltip.querySelector('#mct-done-btn');
    const langSelect = currentTooltip.querySelector('#mct-target-lang');

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeTooltip();
    });

    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyTranslation();
    });

    doneBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeTooltip();
    });

    langSelect.addEventListener('change', (e) => {
      e.stopPropagation();
      handleLanguageChange(e.target.value);
    });
  }

  // Show error in tooltip
  function showTooltipError(errorMessage) {
    if (!currentTooltip) return;

    currentTooltip.classList.remove('mct-loading');
    currentTooltip.classList.add('mct-error');
    currentTooltip.innerHTML = `
      <span class="mct-error-icon">⚠</span>
      <span class="mct-error-text">${escapeHtml(errorMessage)}</span>
    `;
  }

  // Remove the tooltip
  function removeTooltip() {
    if (currentTooltip) {
      currentTooltip.classList.remove('mct-visible');
      currentTooltip.classList.add('mct-hiding');
      
      const tooltipToRemove = currentTooltip;
      setTimeout(() => {
        if (tooltipToRemove.parentNode) {
          tooltipToRemove.parentNode.removeChild(tooltipToRemove);
        }
      }, 200);
      
      currentTooltip = null;
    }

    if (dismissTimeout) {
      clearTimeout(dismissTimeout);
      dismissTimeout = null;
    }

    document.removeEventListener('mousedown', handleOutsideClick);
  }

  // Handle clicks outside the tooltip
  function handleOutsideClick(e) {
    if (currentTooltip && !currentTooltip.contains(e.target)) {
      removeTooltip();
    }
  }

  // Escape HTML to prevent XSS
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Get language display names
  function getLanguageNames() {
    return {
      'en': 'English',
      'es': 'Spanish',
      'fr': 'French',
      'de': 'German',
      'it': 'Italian',
      'pt': 'Portuguese',
      'ru': 'Russian',
      'ja': 'Japanese',
      'ko': 'Korean',
      'zh-CN': 'Chinese (Simplified)',
      'zh-TW': 'Chinese (Traditional)',
      'ar': 'Arabic',
      'hi': 'Hindi',
      'nl': 'Dutch',
      'pl': 'Polish',
      'tr': 'Turkish',
      'vi': 'Vietnamese',
      'th': 'Thai',
      'sv': 'Swedish',
      'da': 'Danish',
      'fi': 'Finnish',
      'no': 'Norwegian',
      'cs': 'Czech',
      'el': 'Greek',
      'he': 'Hebrew',
      'hu': 'Hungarian',
      'id': 'Indonesian',
      'ms': 'Malay',
      'ro': 'Romanian',
      'uk': 'Ukrainian',
      'bg': 'Bulgarian',
      'ca': 'Catalan',
      'hr': 'Croatian',
      'sk': 'Slovak',
      'sl': 'Slovenian',
      'sr': 'Serbian',
      'lt': 'Lithuanian',
      'lv': 'Latvian',
      'et': 'Estonian'
    };
  }

  // Get language options for dropdown
  function getLanguageOptions() {
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'zh-CN', name: 'Chinese (Simplified)' },
      { code: 'zh-TW', name: 'Chinese (Traditional)' },
      { code: 'ar', name: 'Arabic' },
      { code: 'hi', name: 'Hindi' },
      { code: 'nl', name: 'Dutch' },
      { code: 'pl', name: 'Polish' },
      { code: 'tr', name: 'Turkish' },
      { code: 'vi', name: 'Vietnamese' },
      { code: 'th', name: 'Thai' },
      { code: 'sv', name: 'Swedish' },
      { code: 'da', name: 'Danish' },
      { code: 'fi', name: 'Finnish' },
      { code: 'no', name: 'Norwegian' },
      { code: 'cs', name: 'Czech' },
      { code: 'el', name: 'Greek' },
      { code: 'he', name: 'Hebrew' },
      { code: 'hu', name: 'Hungarian' },
      { code: 'id', name: 'Indonesian' },
      { code: 'ms', name: 'Malay' },
      { code: 'ro', name: 'Romanian' },
      { code: 'uk', name: 'Ukrainian' },
      { code: 'bg', name: 'Bulgarian' },
      { code: 'ca', name: 'Catalan' },
      { code: 'hr', name: 'Croatian' },
      { code: 'sk', name: 'Slovak' },
      { code: 'sl', name: 'Slovenian' },
      { code: 'sr', name: 'Serbian' },
      { code: 'lt', name: 'Lithuanian' },
      { code: 'lv', name: 'Latvian' },
      { code: 'et', name: 'Estonian' }
    ];
  }

  // Copy translation to clipboard
  async function copyTranslation() {
    if (!currentTooltip) return;

    const translationText = currentTooltip.querySelector('#mct-translation-text');
    if (!translationText) return;

    try {
      await navigator.clipboard.writeText(translationText.textContent);
      
      // Visual feedback
      const copyBtn = currentTooltip.querySelector('#mct-copy-btn');
      if (copyBtn) {
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Copied!
        `;
        copyBtn.classList.add('mct-copied');
        
        setTimeout(() => {
          copyBtn.innerHTML = originalHTML;
          copyBtn.classList.remove('mct-copied');
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  // Handle language change in dropdown
  async function handleLanguageChange(newTargetLang) {
    if (!currentTooltip) return;

    const originalText = currentTooltip.dataset.originalText;
    const detectedLang = currentTooltip.dataset.detectedLang;
    if (!originalText) return;

    // Show loading state in translation box
    const translationBox = currentTooltip.querySelector('#mct-translation-text');
    if (translationBox) {
      translationBox.innerHTML = '<div class="mct-inline-loading">Translating...</div>';
    }

    // Update "From" field
    const langNames = getLanguageNames();
    const fromDisplay = currentTooltip.querySelector('.mct-lang-display');
    if (fromDisplay) {
      fromDisplay.textContent = langNames[detectedLang] || detectedLang;
    }

    try {
      // Save the new target language preference
      await browser.storage.sync.set({ targetLanguage: newTargetLang });

      const result = await browser.runtime.sendMessage({
        action: 'translate',
        text: originalText
      });

      if (result && result.success) {
        if (translationBox) {
          translationBox.textContent = result.translatedText;
        }
        // Update stored detected language in case it changed
        currentTooltip.dataset.detectedLang = result.detectedLanguage;
        if (fromDisplay) {
          fromDisplay.textContent = langNames[result.detectedLanguage] || result.detectedLanguage;
        }
      } else {
        if (translationBox) {
          translationBox.innerHTML = '<div class="mct-inline-error">Translation failed</div>';
        }
      }
    } catch (error) {
      console.error('Re-translation error:', error);
      if (translationBox) {
        translationBox.innerHTML = '<div class="mct-inline-error">Translation failed</div>';
      }
    }
  }

  // Handle middle-click event
  async function handleMiddleClick(e) {
    // Check if middle button was clicked
    if (e.button !== 1) return;

    // Get selected text
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Only proceed if there's selected text
    if (!selectedText) return;

    // Prevent default middle-click behavior (auto-scroll)
    e.preventDefault();
    e.stopPropagation();

    console.log('Middle-Click Translate: Selected text:', selectedText);

    // Show loading tooltip
    createTooltip(e.clientX, e.clientY, '', true);

    try {
      // Send translation request to background script
      console.log('Sending translation request...');
      const result = await browser.runtime.sendMessage({
        action: 'translate',
        text: selectedText
      });

      console.log('Received result:', result);

      if (result && result.success) {
        updateTooltip(result.translatedText, result.detectedLanguage, result.targetLanguage, selectedText);
      } else {
        showTooltipError(result?.error || 'Translation failed');
      }
    } catch (error) {
      console.error('Middle-Click Translate error:', error);
      console.error('Error stack:', error.stack);
      showTooltipError('Failed to connect to translation service');
    }
  }

  // Prevent default middle-click scroll on mousedown
  function handleMouseDown(e) {
    if (e.button === 1) {
      const selectedText = window.getSelection().toString().trim();
      if (selectedText) {
        e.preventDefault();
      }
    }
  }

  // Initialize
  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('auxclick', handleMiddleClick);
})();

