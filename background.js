// Create context menus on installation
chrome.runtime.onInstalled.addListener(() => {
  // Extension icon context menu items (right-click on extension icon)
  chrome.contextMenus.create({
    id: 'folio-action-add',
    title: 'Add to Collection',
    contexts: ['action']
  });

  chrome.contextMenus.create({
    id: 'folio-action-organizer',
    title: 'View Collection',
    contexts: ['action']
  });

  // Link context menu (right-click on any link)
  chrome.contextMenus.create({
    id: 'folio-link-add',
    title: 'Add to Collection',
    contexts: ['link']
  });
});

// Handle toolbar icon left-click
chrome.action.onClicked.addListener(async (tab) => {
  // Left-click on extension icon opens current page in reader
  await toggleReaderMode(tab);
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'folio-action-add') {
    // Add current page to collection (from extension icon right-click)
    await addToCollection(tab);
  } else if (info.menuItemId === 'folio-action-organizer') {
    // Open Collection side panel
    await openCollection();
  } else if (info.menuItemId === 'folio-link-add') {
    // Add linked page to collection
    await addLinkToCollection(info.linkUrl);
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

// Add current article to collection
async function addToCollection(tab) {
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
      // Get existing collection
      const { magazine: collection = [] } = await chrome.storage.local.get('magazine');

      // Add new article
      collection.push(response.article);

      // Save to storage
      await chrome.storage.local.set({ magazine: collection });

      console.log('Article added to collection:', response.article.title);
    }
  } catch (error) {
    console.error('Error adding to collection:', error);
  }
}

// Add linked page to collection
async function addLinkToCollection(linkUrl) {
  if (!linkUrl) return;

  try {
    // Open the link in a new background tab
    const newTab = await chrome.tabs.create({
      url: linkUrl,
      active: false
    });

    // Wait for the page to load
    await new Promise((resolve) => {
      const listener = (tabId, changeInfo) => {
        if (tabId === newTab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });

    // Get article data from the new tab
    const response = await chrome.tabs.sendMessage(newTab.id, {
      action: 'getArticleData'
    });

    if (response && response.article) {
      // Get existing collection
      const { magazine: collection = [] } = await chrome.storage.local.get('magazine');

      // Add new article
      collection.push(response.article);

      // Save to storage
      await chrome.storage.local.set({ magazine: collection });

      console.log('Link added to collection:', response.article.title);
    }

    // Close the background tab
    await chrome.tabs.remove(newTab.id);
  } catch (error) {
    console.error('Error adding link to collection:', error);
  }
}

// Open the Collection side panel
async function openCollection() {
  try {
    // Get current window
    const currentWindow = await chrome.windows.getCurrent();

    if (!currentWindow || !currentWindow.id) {
      console.error('No current window found');
      return;
    }

    // Open the side panel for this window
    await chrome.sidePanel.open({ windowId: currentWindow.id });
    console.log('Side panel opened successfully for window', currentWindow.id);
  } catch (error) {
    console.error('Error opening side panel:', error.message, error);
    // Fallback: open in a new popup window
    try {
      await chrome.windows.create({
        url: chrome.runtime.getURL('popup.html'),
        type: 'popup',
        width: 480,
        height: 600
      });
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
    }
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
      await addToCollection(tab);
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
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
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
