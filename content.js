// Content script for Middle-Click Translate
// Handles text selection, middle-click detection, and tooltip display

(function() {
  'use strict';

  let currentTooltip = null;
  let dismissTimeout = null;

  // Create and show the translation tooltip
  function createTooltip(x, y, isLoading = false) {
    // Remove any existing tooltip
    removeTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'mct-tooltip';
    
    if (isLoading) {
      tooltip.classList.add('mct-loading');
      const spinner = document.createElement('span');
      spinner.className = 'mct-spinner';
      const loadingText = document.createElement('span');
      loadingText.className = 'mct-loading-text';
      loadingText.textContent = 'Translating...';
      tooltip.appendChild(spinner);
      tooltip.appendChild(loadingText);
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
      
      // Apply final position (add scroll offsets for absolute positioning)
      tooltip.style.left = `${left + window.pageXOffset}px`;
      tooltip.style.top = `${top + window.pageYOffset}px`;

      // Trigger animation
      tooltip.classList.add('mct-visible');
    });

    // Dismiss on click outside
    document.addEventListener('mousedown', handleOutsideClick);
  }

  // Update existing tooltip with translation result
  function updateTooltip(translatedText, detectedLang, targetLang, originalText) {
    if (!currentTooltip) return;

    currentTooltip.classList.remove('mct-loading');
    
    const langNames = getLanguageNames();
    const sourceLangName = langNames[detectedLang] || detectedLang;
    
    // Clear existing content
    currentTooltip.textContent = '';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'mct-header';
    const title = document.createElement('span');
    title.className = 'mct-title';
    title.textContent = 'Translation';
    header.appendChild(title);
    
    // Create language row
    const langRow = document.createElement('div');
    langRow.className = 'mct-lang-row';
    
    // From field
    const fromField = document.createElement('div');
    fromField.className = 'mct-lang-field';
    const fromLabel = document.createElement('label');
    fromLabel.className = 'mct-lang-label';
    fromLabel.textContent = 'From';
    const fromDisplay = document.createElement('div');
    fromDisplay.className = 'mct-lang-display';
    fromDisplay.textContent = sourceLangName;
    fromField.appendChild(fromLabel);
    fromField.appendChild(fromDisplay);
    
    // To field
    const toField = document.createElement('div');
    toField.className = 'mct-lang-field';
    const toLabel = document.createElement('label');
    toLabel.className = 'mct-lang-label';
    toLabel.textContent = 'To';
    const langSelect = document.createElement('select');
    langSelect.className = 'mct-lang-select';
    langSelect.id = 'mct-target-lang';
    
    // Add language options
    const languageOptions = getLanguageOptions();
    languageOptions.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.code;
      option.textContent = opt.name;
      if (opt.code === targetLang) {
        option.selected = true;
      }
      langSelect.appendChild(option);
    });
    
    toField.appendChild(toLabel);
    toField.appendChild(langSelect);
    
    langRow.appendChild(fromField);
    langRow.appendChild(toField);
    
    // Create translation text
    const translationDiv = document.createElement('div');
    translationDiv.className = 'mct-translation';
    translationDiv.id = 'mct-translation-text';
    translationDiv.textContent = translatedText;
    
    // Create footer with buttons
    const footer = document.createElement('div');
    footer.className = 'mct-footer';
    
    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'mct-btn mct-btn-secondary';
    copyBtn.id = 'mct-copy-btn';
    const copySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    copySvg.setAttribute('width', '16');
    copySvg.setAttribute('height', '16');
    copySvg.setAttribute('viewBox', '0 0 24 24');
    copySvg.setAttribute('fill', 'none');
    copySvg.setAttribute('stroke', 'currentColor');
    copySvg.setAttribute('stroke-width', '2');
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '9');
    rect.setAttribute('y', '9');
    rect.setAttribute('width', '13');
    rect.setAttribute('height', '13');
    rect.setAttribute('rx', '2');
    rect.setAttribute('ry', '2');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1');
    copySvg.appendChild(rect);
    copySvg.appendChild(path);
    copyBtn.appendChild(copySvg);
    copyBtn.appendChild(document.createTextNode(' Copy'));
    
    // Done button
    const doneBtn = document.createElement('button');
    doneBtn.className = 'mct-btn mct-btn-primary';
    doneBtn.id = 'mct-done-btn';
    doneBtn.textContent = 'Done';
    
    footer.appendChild(copyBtn);
    footer.appendChild(doneBtn);
    
    // Append all elements to tooltip
    currentTooltip.appendChild(header);
    currentTooltip.appendChild(langRow);
    currentTooltip.appendChild(translationDiv);
    currentTooltip.appendChild(footer);

    // Store data for re-translation
    currentTooltip.dataset.originalText = originalText;
    currentTooltip.dataset.detectedLang = detectedLang;

    // Add event listeners
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
    
    // Clear existing content
    currentTooltip.textContent = '';
    
    // Create error icon
    const errorIcon = document.createElement('span');
    errorIcon.className = 'mct-error-icon';
    errorIcon.textContent = '⚠';
    
    // Create error text
    const errorText = document.createElement('span');
    errorText.className = 'mct-error-text';
    errorText.textContent = errorMessage;
    
    // Append elements
    currentTooltip.appendChild(errorIcon);
    currentTooltip.appendChild(errorText);
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
        // Store original state to restore later
        if (!copyBtn.dataset.originalState) {
          copyBtn.dataset.originalState = 'stored';
        }
        
        // Clear and rebuild with "Copied!" message
        copyBtn.textContent = '';
        const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        checkSvg.setAttribute('width', '16');
        checkSvg.setAttribute('height', '16');
        checkSvg.setAttribute('viewBox', '0 0 24 24');
        checkSvg.setAttribute('fill', 'none');
        checkSvg.setAttribute('stroke', 'currentColor');
        checkSvg.setAttribute('stroke-width', '2');
        const checkPath = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        checkPath.setAttribute('points', '20 6 9 17 4 12');
        checkSvg.appendChild(checkPath);
        copyBtn.appendChild(checkSvg);
        copyBtn.appendChild(document.createTextNode(' Copied!'));
        copyBtn.classList.add('mct-copied');
        
        setTimeout(() => {
          // Restore original "Copy" button content
          copyBtn.textContent = '';
          const copySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          copySvg.setAttribute('width', '16');
          copySvg.setAttribute('height', '16');
          copySvg.setAttribute('viewBox', '0 0 24 24');
          copySvg.setAttribute('fill', 'none');
          copySvg.setAttribute('stroke', 'currentColor');
          copySvg.setAttribute('stroke-width', '2');
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', '9');
          rect.setAttribute('y', '9');
          rect.setAttribute('width', '13');
          rect.setAttribute('height', '13');
          rect.setAttribute('rx', '2');
          rect.setAttribute('ry', '2');
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1');
          copySvg.appendChild(rect);
          copySvg.appendChild(path);
          copyBtn.appendChild(copySvg);
          copyBtn.appendChild(document.createTextNode(' Copy'));
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
      translationBox.textContent = '';
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'mct-inline-loading';
      loadingDiv.textContent = 'Translating...';
      translationBox.appendChild(loadingDiv);
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
          translationBox.textContent = '';
          const errorDiv = document.createElement('div');
          errorDiv.className = 'mct-inline-error';
          errorDiv.textContent = 'Translation failed';
          translationBox.appendChild(errorDiv);
        }
      }
    } catch (error) {
      console.error('Re-translation error:', error);
      if (translationBox) {
        translationBox.textContent = '';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'mct-inline-error';
        errorDiv.textContent = 'Translation failed';
        translationBox.appendChild(errorDiv);
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
    createTooltip(e.clientX, e.clientY, true);

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

