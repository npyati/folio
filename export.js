// Export script - runs when export.html loads
(async function() {
  // Wait for content script to initialize
  await new Promise(resolve => setTimeout(resolve, 500));

  // Check URL hash to determine export type
  const exportType = window.location.hash.substring(1); // Remove #

  // Dispatch a custom event that the content script will listen for
  const event = new CustomEvent('folioExport', {
    detail: {
      action: exportType === 'pdf' ? 'exportMagazinePDF' : 'exportMagazineEPUB'
    }
  });

  window.dispatchEvent(event);
})();
