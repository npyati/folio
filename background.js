// Handle browser action click
chrome.action.onClicked.addListener(async (tab) => {
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
});
