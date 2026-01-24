// Load and display saved articles
async function loadArticles() {
  const { magazine = [] } = await chrome.storage.local.get('magazine');
  const listEl = document.getElementById('articles-list');
  const countEl = document.getElementById('article-count');

  // Update count
  countEl.textContent = magazine.length === 0
    ? 'No articles saved'
    : `${magazine.length} article${magazine.length === 1 ? '' : 's'}`;

  if (magazine.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📰</div>
        <div class="empty-state-text">No articles yet</div>
        <div class="empty-state-hint">Right-click the extension icon<br>and select "Add to Collection"</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = magazine.map((article, index) => `
    <div class="article-item" data-index="${index}" draggable="true">
      <div class="article-title" data-url="${escapeHTML(article.url)}" style="cursor: pointer;">${escapeHTML(article.title)}</div>
      <div class="article-meta">
        <span class="article-source">${escapeHTML(article.source)}</span>
        <span>${escapeHTML(article.author)}</span>
      </div>
      <div class="article-actions">
        <button class="btn-small move-up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn-small move-down" data-index="${index}" ${index === magazine.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn-small remove" data-index="${index}">✕</button>
      </div>
    </div>
  `).join('');

  // Add event listeners
  setupDragAndDrop();
  setupButtons();
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function setupDragAndDrop() {
  const items = document.querySelectorAll('.article-item');
  let draggedIndex = null;

  items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedIndex = parseInt(item.dataset.index);
      item.style.opacity = '0.5';
    });

    item.addEventListener('dragend', (e) => {
      item.style.opacity = '1';
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    item.addEventListener('drop', async (e) => {
      e.preventDefault();
      const targetIndex = parseInt(item.dataset.index);

      if (draggedIndex !== targetIndex) {
        await reorderArticles(draggedIndex, targetIndex);
      }
    });
  });
}

function setupButtons() {
  // Article title clicks - open URL in new tab, optionally activate reader mode
  document.querySelectorAll('.article-title').forEach(title => {
    title.addEventListener('click', async (e) => {
      const url = e.target.dataset.url;
      if (url) {
        const tab = await chrome.tabs.create({ url, active: true });

        // Check if we should open in reader mode
        const { collectionOpenReader = true } = await chrome.storage.local.get('collectionOpenReader');
        if (!collectionOpenReader) return;

        // Wait for the page to fully load before activating reader mode
        const listener = (tabId, changeInfo, updatedTab) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);

            // Give the content script a moment to initialize
            setTimeout(async () => {
              try {
                await chrome.tabs.sendMessage(tab.id, {
                  action: 'toggleReaderMode'
                });
              } catch (error) {
                console.log('Could not activate reader mode:', error);
              }
            }, 500);
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      }
    });
  });

  // Move up/down buttons
  document.querySelectorAll('.move-up').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const index = parseInt(e.target.dataset.index);
      await reorderArticles(index, index - 1);
    });
  });

  document.querySelectorAll('.move-down').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const index = parseInt(e.target.dataset.index);
      await reorderArticles(index, index + 1);
    });
  });

  // Remove buttons
  document.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const index = parseInt(e.target.dataset.index);
      await removeArticle(index);
    });
  });
}

async function reorderArticles(fromIndex, toIndex) {
  const { magazine = [] } = await chrome.storage.local.get('magazine');
  const [article] = magazine.splice(fromIndex, 1);
  magazine.splice(toIndex, 0, article);
  await chrome.storage.local.set({ magazine });
  loadArticles();
}

async function removeArticle(index) {
  const { magazine = [] } = await chrome.storage.local.get('magazine');
  magazine.splice(index, 1);
  await chrome.storage.local.set({ magazine });
  loadArticles();
}

async function clearAll() {
  await chrome.storage.local.set({ magazine: [] });
  loadArticles();
}

async function exportPDF() {
  try {
    // Get or create a tab to run the export
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // If no suitable tab, create a blank one
    if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      tab = await chrome.tabs.create({ url: 'about:blank', active: true });
      // Wait for content script to be injected
      await new Promise((resolve) => {
        const listener = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
      // Extra wait for content script initialization
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Send message to content script to export
    await chrome.tabs.sendMessage(tab.id, {
      action: 'exportMagazinePDF'
    });
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert('Could not export PDF. Please try opening a regular web page first and try again.');
  }
}

async function exportEPUB() {
  try {
    // Get or create a tab to run the export
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // If no suitable tab, create a blank one
    if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      tab = await chrome.tabs.create({ url: 'about:blank', active: true });
      // Wait for content script to be injected
      await new Promise((resolve) => {
        const listener = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
      // Extra wait for content script initialization
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Send message to content script to export
    await chrome.tabs.sendMessage(tab.id, {
      action: 'exportMagazineEPUB'
    });
  } catch (error) {
    console.error('Error exporting EPUB:', error);
    alert('Could not export EPUB. Please try opening a regular web page first and try again.');
  }
}

async function exportFolio() {
  try {
    const { magazine = [] } = await chrome.storage.local.get('magazine');

    if (magazine.length === 0) {
      alert('No articles in collection to export');
      return;
    }

    // Create .folio content - one URL per line
    const folioContent = magazine
      .map(article => article.url)
      .join('\n');

    // Add header comment
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const header = `# Folio Reading List - Exported ${timestamp}\n# ${magazine.length} article${magazine.length === 1 ? '' : 's'}\n\n`;
    const fullContent = header + folioContent;

    // Create blob and download
    const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = `reading-list-${timestamp}.folio`;

    // Trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  } catch (error) {
    console.error('Error exporting .folio file:', error);
    alert('Could not export .folio file. Please try again.');
  }
}

// Settings management
function toggleSettings() {
  const panel = document.getElementById('settings-panel');
  panel.classList.toggle('active');
}

async function loadSettings() {
  // Load auto-fullscreen setting
  const { autoFullscreen = false } = await chrome.storage.local.get('autoFullscreen');
  document.getElementById('auto-fullscreen').checked = autoFullscreen;

  // Load collection as new tab setting
  const { collectionAsNewTab = false } = await chrome.storage.local.get('collectionAsNewTab');
  document.getElementById('collection-newtab').checked = collectionAsNewTab;

  // Load collection open in reader setting (default true for existing behavior)
  const { collectionOpenReader = true } = await chrome.storage.local.get('collectionOpenReader');
  document.getElementById('collection-open-reader').checked = collectionOpenReader;

  // Load links open in reader setting
  const { linksOpenReader = false } = await chrome.storage.local.get('linksOpenReader');
  document.getElementById('links-open-reader').checked = linksOpenReader;
}

async function loadAutoOpenDomains() {
  const { autoOpenDomains = [] } = await chrome.storage.local.get('autoOpenDomains');
  const listEl = document.getElementById('domain-list');

  if (autoOpenDomains.length === 0) {
    listEl.innerHTML = '<div style="text-align: center; color: #999; font-size: 11px; padding: 20px;">No domains configured</div>';
    return;
  }

  listEl.innerHTML = autoOpenDomains.map(domain => `
    <div class="domain-item">
      <span class="domain-name">${escapeHTML(domain)}</span>
      <button class="domain-remove" data-domain="${escapeHTML(domain)}">Remove</button>
    </div>
  `).join('');

  // Add remove button listeners
  document.querySelectorAll('.domain-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const domain = e.target.dataset.domain;
      await removeDomain(domain);
    });
  });
}

async function addDomain() {
  const input = document.getElementById('domain-input');
  let domain = input.value.trim().toLowerCase();

  if (!domain) return;

  // Remove protocol and www if present
  domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
  // Remove trailing slash
  domain = domain.replace(/\/$/, '');

  if (!domain) return;

  const { autoOpenDomains = [] } = await chrome.storage.local.get('autoOpenDomains');

  if (!autoOpenDomains.includes(domain)) {
    autoOpenDomains.push(domain);
    await chrome.storage.local.set({ autoOpenDomains });
  }

  input.value = '';
  loadAutoOpenDomains();
}

async function removeDomain(domain) {
  const { autoOpenDomains = [] } = await chrome.storage.local.get('autoOpenDomains');
  const filtered = autoOpenDomains.filter(d => d !== domain);
  await chrome.storage.local.set({ autoOpenDomains: filtered });
  loadAutoOpenDomains();
}

async function addCurrentPage() {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      console.error('No active tab found');
      return;
    }

    // Don't run on chrome:// or other restricted pages
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      alert('Cannot add chrome:// pages to collection');
      return;
    }

    // Get article data
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

      // Reload the articles list
      loadArticles();
    }
  } catch (error) {
    console.error('Error adding current page:', error);
    alert('Could not add this page to collection');
  }
}

// Import functionality
let importCancelled = false;

// Parse .folio file content
function parseFolioFile(content) {
  const lines = content.split('\n');
  const urls = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    // Validate URL format
    try {
      new URL(trimmed);
      urls.push(trimmed);
    } catch (error) {
      console.warn('Invalid URL skipped:', trimmed);
    }
  }

  return urls;
}

// Show import progress overlay
function showImportProgress() {
  const overlay = document.getElementById('import-overlay');
  overlay.style.display = 'flex';
  importCancelled = false;
}

// Hide import progress overlay
function hideImportProgress() {
  const overlay = document.getElementById('import-overlay');
  overlay.style.display = 'none';
}

// Update import progress UI
function updateImportProgress(current, total, status, details = '') {
  const progressFill = document.getElementById('import-progress-fill');
  const statusEl = document.getElementById('import-status');
  const detailsEl = document.getElementById('import-details');

  const percentage = total > 0 ? (current / total) * 100 : 0;
  progressFill.style.width = `${percentage}%`;
  statusEl.textContent = status;
  detailsEl.textContent = details;
}

// Fetch article from URL using background tab technique
async function fetchArticleFromURL(url, index, total) {
  return new Promise(async (resolve, reject) => {
    try {
      updateImportProgress(
        index,
        total,
        `Processing ${index}/${total}`,
        `Fetching: ${new URL(url).hostname}`
      );

      // Create background tab
      const tab = await chrome.tabs.create({
        url: url,
        active: false
      });

      // Set timeout for slow-loading pages
      const timeout = setTimeout(() => {
        chrome.tabs.remove(tab.id).catch(() => {});
        reject(new Error('Timeout loading page'));
      }, 30000); // 30 second timeout

      // Wait for page to load
      const listener = async (tabId, changeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeout);

          try {
            // Wait a bit for content script to initialize
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Get article data
            const response = await chrome.tabs.sendMessage(tab.id, {
              action: 'getArticleData'
            });

            // Close tab
            await chrome.tabs.remove(tab.id);

            if (response && response.article) {
              resolve(response.article);
            } else {
              reject(new Error('Could not extract article data'));
            }
          } catch (error) {
            await chrome.tabs.remove(tab.id).catch(() => {});
            reject(error);
          }
        }
      };

      chrome.tabs.onUpdated.addListener(listener);

    } catch (error) {
      reject(error);
    }
  });
}

// Main import function
async function importFolioFile(file) {
  try {
    // Read file content
    const content = await file.text();
    const urls = parseFolioFile(content);

    if (urls.length === 0) {
      alert('No valid URLs found in .folio file');
      return;
    }

    // Show progress overlay
    showImportProgress();

    // Always replace existing collection
    let magazine = [];

    // Track results
    const results = {
      success: [],
      failed: []
    };

    // Process URLs with rate limiting
    for (let i = 0; i < urls.length; i++) {
      if (importCancelled) {
        updateImportProgress(i, urls.length, 'Import cancelled',
          `Imported ${results.success.length} of ${i} attempted`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        break;
      }

      const url = urls[i];

      try {
        const article = await fetchArticleFromURL(url, i + 1, urls.length);
        magazine.push(article);
        results.success.push(url);

        // Save after each successful fetch (in case of crash/cancel)
        await chrome.storage.local.set({ magazine });

      } catch (error) {
        console.error(`Failed to import ${url}:`, error);
        results.failed.push({ url, error: error.message });
      }

      // Rate limiting: wait 1 second between requests
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Final save
    await chrome.storage.local.set({ magazine });

    // Show completion message
    const successCount = results.success.length;
    const failCount = results.failed.length;
    updateImportProgress(
      urls.length,
      urls.length,
      'Import complete!',
      `✓ ${successCount} imported, ✗ ${failCount} failed`
    );

    // Hide overlay after delay
    setTimeout(() => {
      hideImportProgress();
      loadArticles(); // Reload the UI
    }, 3000);

  } catch (error) {
    console.error('Error importing .folio file:', error);
    alert('Could not import .folio file: ' + error.message);
    hideImportProgress();
  }
}

// Drag and drop handlers
const articlesList = document.getElementById('articles-list');

articlesList.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  articlesList.classList.add('drag-over');
});

articlesList.addEventListener('dragleave', (e) => {
  e.preventDefault();
  e.stopPropagation();
  articlesList.classList.remove('drag-over');
});

articlesList.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  articlesList.classList.remove('drag-over');

  const files = e.dataTransfer.files;
  if (files.length === 0) return;

  const file = files[0];

  // Validate file extension
  if (!file.name.endsWith('.folio')) {
    alert('Please drop a .folio file');
    return;
  }

  importFolioFile(file);
});

// Event listeners
document.getElementById('export-pdf').addEventListener('click', exportPDF);
document.getElementById('export-epub').addEventListener('click', exportEPUB);
document.getElementById('export-folio').addEventListener('click', exportFolio);
document.getElementById('import-cancel').addEventListener('click', () => {
  importCancelled = true;
});
document.getElementById('clear-all').addEventListener('click', clearAll);
document.getElementById('settings-toggle').addEventListener('click', toggleSettings);
document.getElementById('add-current').addEventListener('click', addCurrentPage);
document.getElementById('add-domain').addEventListener('click', addDomain);
document.getElementById('domain-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addDomain();
  }
});
document.getElementById('auto-fullscreen').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ autoFullscreen: e.target.checked });
});
document.getElementById('collection-newtab').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ collectionAsNewTab: e.target.checked });
});
document.getElementById('collection-open-reader').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ collectionOpenReader: e.target.checked });
});
document.getElementById('links-open-reader').addEventListener('change', async (e) => {
  await chrome.storage.local.set({ linksOpenReader: e.target.checked });
});

// Listen for storage changes to update magazine in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.magazine) {
    loadArticles();
  }
  if (namespace === 'local' && changes.autoOpenDomains) {
    loadAutoOpenDomains();
  }
  if (namespace === 'local' && (changes.autoFullscreen || changes.collectionAsNewTab || changes.collectionOpenReader || changes.linksOpenReader)) {
    loadSettings();
  }
});

// Load articles and settings on popup open
loadArticles();
loadAutoOpenDomains();
loadSettings();
