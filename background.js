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
    // First, inject the content script if it hasn't been injected yet
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['dist/content.js']
    });

    // Then send message to toggle reader mode
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
    // Inject content script if needed
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['dist/content.js']
    });

    // Get article data
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
