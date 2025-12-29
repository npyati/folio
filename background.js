// Create context menus on installation
chrome.runtime.onInstalled.addListener(() => {
  // Page context menu items
  chrome.contextMenus.create({
    id: 'folio-view',
    title: 'View in Reader',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'folio-page-add',
    title: 'Add to Magazine',
    contexts: ['page']
  });

  // Reader mode controls (shown when in reader mode)
  chrome.contextMenus.create({
    id: 'folio-remove-paragraph',
    title: 'Remove this paragraph',
    contexts: ['selection', 'link', 'image']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'folio-remove-paragraph') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'removeParagraph'
    });
  } else if (info.menuItemId === 'folio-view') {
    await toggleReaderMode(tab);
  } else if (info.menuItemId === 'folio-page-add') {
    await addToMagazine(tab);
  }
});

// Toggle reader mode on current tab
async function toggleReaderMode(tab) {
  // Don't run on chrome:// or other restricted pages
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    console.log('Folio Reader: Cannot run on chrome:// pages');
    return;
  }

  try {
    // Send message to toggle reader mode (content script is now auto-injected)
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'toggleReaderMode'
    });

    console.log('Reader mode toggled:', response);
  } catch (error) {
    console.error('Error toggling reader mode:', error);
  }
}

// Add current article to magazine collection
async function addToMagazine(tab) {
  // Don't run on chrome:// or other restricted pages
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    console.log('Folio Reader: Cannot run on chrome:// pages');
    return;
  }

  try {
    // Get article data (content script is now auto-injected)
    const response = await chrome.tabs.sendMessage(tab.id, {
      action: 'getArticleData'
    });

    if (response && response.article) {
      // Get existing magazine
      const { magazine = [] } = await chrome.storage.local.get('magazine');

      // Add new article
      magazine.push(response.article);

      // Save to storage
      await chrome.storage.local.set({ magazine });

      console.log('Article added to magazine:', response.article.title);
    }
  } catch (error) {
    console.error('Error adding to magazine:', error);
  }
}

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) return;

  switch (command) {
    case 'toggle-reader':
      await toggleReaderMode(tab);
      break;
    case 'add-to-magazine':
      await addToMagazine(tab);
      break;
    case 'toggle-fullscreen':
      // Send message to content script to toggle fullscreen
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'toggleFullscreen'
        });
      } catch (error) {
        console.error('Error toggling fullscreen:', error);
      }
      break;
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchImage') {
    // Fetch image through background service worker to bypass CORS
    fetch(request.url, {
      credentials: 'omit',
      cache: 'default'
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.blob();
      })
      .then(blob => {
        // Convert blob to base64 for transmission
        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({
            success: true,
            data: reader.result,
            type: blob.type
          });
        };
        reader.onerror = () => {
          sendResponse({ success: false, error: 'Failed to read blob' });
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
});
