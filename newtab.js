// Theme management
async function loadTheme() {
  const { collectionTheme = 'system' } = await chrome.storage.local.get('collectionTheme');
  applyTheme(collectionTheme);
  updateThemeButtons(collectionTheme);
}

function applyTheme(theme) {
  let effectiveTheme = theme;

  if (theme === 'system') {
    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.documentElement.setAttribute('data-theme', effectiveTheme);
}

function updateThemeButtons(theme) {
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

async function setTheme(theme) {
  await chrome.storage.local.set({ collectionTheme: theme });
  applyTheme(theme);
  updateThemeButtons(theme);
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
  const { collectionTheme = 'system' } = await chrome.storage.local.get('collectionTheme');
  if (collectionTheme === 'system') {
    applyTheme('system');
  }
});

// Check setting and show appropriate view
async function initNewTab() {
  const { collectionAsNewTab = false } = await chrome.storage.local.get('collectionAsNewTab');

  const disabledView = document.getElementById('disabled-view');
  const collectionView = document.getElementById('collection-view');

  if (collectionAsNewTab) {
    disabledView.style.display = 'none';
    collectionView.classList.add('active');
    loadArticles();
  } else {
    disabledView.style.display = 'flex';
    collectionView.classList.remove('active');
  }
}

// Enable new tab feature
document.getElementById('enable-newtab').addEventListener('click', async () => {
  await chrome.storage.local.set({ collectionAsNewTab: true });
  initNewTab();
});

// Settings toggle
function toggleSettings() {
  const panel = document.getElementById('settings-panel');
  panel.classList.toggle('active');
}

// Load settings
async function loadSettings() {
  const { autoFullscreen = false } = await chrome.storage.local.get('autoFullscreen');
  document.getElementById('auto-fullscreen').checked = autoFullscreen;

  const { collectionAsNewTab = false } = await chrome.storage.local.get('collectionAsNewTab');
  document.getElementById('collection-newtab').checked = collectionAsNewTab;

  const { collectionOpenReader = true } = await chrome.storage.local.get('collectionOpenReader');
  document.getElementById('collection-open-reader').checked = collectionOpenReader;

  const { linksOpenReader = false } = await chrome.storage.local.get('linksOpenReader');
  document.getElementById('links-open-reader').checked = linksOpenReader;
}

// Load auto-open domains
async function loadAutoOpenDomains() {
  const { autoOpenDomains = [] } = await chrome.storage.local.get('autoOpenDomains');
  const listEl = document.getElementById('domain-list');

  if (autoOpenDomains.length === 0) {
    listEl.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 20px;">No domains configured</div>';
    return;
  }

  listEl.innerHTML = autoOpenDomains.map(domain => `
    <div class="domain-item">
      <span class="domain-name">${escapeHTML(domain)}</span>
      <button class="domain-remove" data-domain="${escapeHTML(domain)}">Remove</button>
    </div>
  `).join('');

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

  domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
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

async function exportFolio() {
  try {
    const { magazine = [] } = await chrome.storage.local.get('magazine');

    if (magazine.length === 0) {
      alert('No articles in collection to export');
      return;
    }

    const folioContent = magazine.map(article => article.url).join('\n');
    const timestamp = new Date().toISOString().split('T')[0];
    const header = `# Folio Reading List - Exported ${timestamp}\n# ${magazine.length} article${magazine.length === 1 ? '' : 's'}\n\n`;
    const fullContent = header + folioContent;

    const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = `reading-list-${timestamp}.folio`;

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

// Load and display saved articles
async function loadArticles() {
  const { magazine = [] } = await chrome.storage.local.get('magazine');
  const listEl = document.getElementById('articles-list');
  const countEl = document.getElementById('article-count');

  countEl.textContent = magazine.length === 0
    ? 'No articles saved'
    : `${magazine.length} article${magazine.length === 1 ? '' : 's'}`;

  if (magazine.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">folio</div>
        <div class="empty-state-text">No articles yet</div>
        <div class="empty-state-hint">Right-click the Folio extension icon<br>and select "Add to Collection"</div>
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
        <button class="btn-small move-up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>&#8593;</button>
        <button class="btn-small move-down" data-index="${index}" ${index === magazine.length - 1 ? 'disabled' : ''}>&#8595;</button>
        <button class="btn-small remove" data-index="${index}">&#10005;</button>
      </div>
    </div>
  `).join('');

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
    item.addEventListener('dragstart', () => {
      draggedIndex = parseInt(item.dataset.index);
      item.style.opacity = '0.5';
    });

    item.addEventListener('dragend', () => {
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

        const listener = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);

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
  if (confirm('Clear all articles from collection?')) {
    await chrome.storage.local.set({ magazine: [] });
    loadArticles();
  }
}

async function exportPDF() {
  try {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      tab = await chrome.tabs.create({ url: 'about:blank', active: true });
      await new Promise((resolve) => {
        const listener = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    }

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
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      tab = await chrome.tabs.create({ url: 'about:blank', active: true });
      await new Promise((resolve) => {
        const listener = (tabId, changeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await chrome.tabs.sendMessage(tab.id, {
      action: 'exportMagazineEPUB'
    });
  } catch (error) {
    console.error('Error exporting EPUB:', error);
    alert('Could not export EPUB. Please try opening a regular web page first and try again.');
  }
}

// File drag and drop for .folio import
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

articlesList.addEventListener('drop', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  articlesList.classList.remove('drag-over');

  const files = e.dataTransfer.files;
  if (files.length === 0) return;

  const file = files[0];

  if (!file.name.endsWith('.folio')) {
    alert('Please drop a .folio file');
    return;
  }

  // Simple import - just add URLs to collection
  try {
    const content = await file.text();
    const urls = parseFolioFile(content);

    if (urls.length === 0) {
      alert('No valid URLs found in .folio file');
      return;
    }

    alert(`Found ${urls.length} URLs. Opening the extension side panel to import with full article data.`);
  } catch (error) {
    console.error('Error reading .folio file:', error);
    alert('Could not read .folio file');
  }
});

function parseFolioFile(content) {
  const lines = content.split('\n');
  const urls = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    try {
      new URL(trimmed);
      urls.push(trimmed);
    } catch (error) {
      console.warn('Invalid URL skipped:', trimmed);
    }
  }

  return urls;
}

// Event listeners
document.getElementById('export-pdf').addEventListener('click', exportPDF);
document.getElementById('export-epub').addEventListener('click', exportEPUB);
document.getElementById('export-folio').addEventListener('click', exportFolio);
document.getElementById('clear-all').addEventListener('click', clearAll);
document.getElementById('settings-toggle').addEventListener('click', toggleSettings);
document.getElementById('add-domain').addEventListener('click', addDomain);

// Theme button listeners
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => setTheme(btn.dataset.theme));
});
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

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.magazine) {
      loadArticles();
    }
    if (changes.collectionAsNewTab) {
      initNewTab();
    }
    if (changes.autoOpenDomains) {
      loadAutoOpenDomains();
    }
    if (changes.autoFullscreen || changes.collectionAsNewTab || changes.collectionOpenReader || changes.linksOpenReader) {
      loadSettings();
    }
    if (changes.collectionTheme) {
      loadTheme();
    }
  }
});

// Initialize on load
loadTheme();
initNewTab();
loadSettings();
loadAutoOpenDomains();
