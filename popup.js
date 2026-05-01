// Popup / side panel script for Folio.
// Depends on folio-store.js being loaded first (exposes self.FolioStore).

let currentStore = null;

// ---- Theme management ----

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
  document.querySelectorAll('.theme-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

async function setTheme(theme) {
  await chrome.storage.local.set({ collectionTheme: theme });
  applyTheme(theme);
  updateThemeButtons(theme);
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
  const { collectionTheme = 'system' } = await chrome.storage.local.get('collectionTheme');
  if (collectionTheme === 'system') applyTheme('system');
});

// ---- Utilities ----

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

// ---- Rendering ----

async function refresh() {
  currentStore = await FolioStore.loadStore();
  renderHeader();
  renderArticles();
  if (document.getElementById('list-dropdown').classList.contains('active')) {
    renderListDropdown();
  }
  const modal = document.getElementById('manage-lists-modal');
  if (modal.classList.contains('active')) renderManageLists();
}

function renderHeader() {
  const list = FolioStore.getActiveList(currentStore);
  document.getElementById('current-list-name').textContent = list.name;
  document.getElementById('article-count').textContent = list.articleIds.length;
}

function renderArticles() {
  const list = FolioStore.getActiveList(currentStore);
  const articles = list.articleIds.map((id) => currentStore.articles[id]).filter(Boolean);
  const listEl = document.getElementById('articles-list');

  if (articles.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📰</div>
        <div class="empty-state-text">No articles in this list</div>
        <div class="empty-state-hint">Right-click the extension icon<br>and select "Add to Collection"</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = articles.map((article, index) => {
    const badges = [];
    if (article.exportedPDF) badges.push('<span class="export-badge">pdf</span>');
    if (article.exportedEPUB) badges.push('<span class="export-badge">epub</span>');
    return `
    <div class="article-item" data-article-id="${escapeHTML(article.id)}" data-index="${index}" draggable="true">
      <div class="article-header">
        <input type="checkbox" class="article-select" data-article-id="${escapeHTML(article.id)}">
        <div style="flex:1;min-width:0;">
          <div class="article-title" data-url="${escapeHTML(article.url)}" style="cursor: pointer;">${escapeHTML(article.title)}</div>
          <div class="article-meta">
            <span class="article-source">${escapeHTML(article.source)}</span>
            <span>${escapeHTML(article.author)}</span>
          </div>
        </div>
        ${badges.length ? `<div class="export-badges">${badges.join('')}</div>` : ''}
      </div>
      <div class="article-actions">
        <button class="btn-small move-up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn-small move-down" data-index="${index}" ${index === articles.length - 1 ? 'disabled' : ''}>↓</button>
        <button class="btn-small btn-lists" data-article-id="${escapeHTML(article.id)}">Lists</button>
        <div class="spacer"></div>
        <button class="btn-small remove" data-article-id="${escapeHTML(article.id)}">✕</button>
      </div>
    </div>`;
  }).join('');

  setupDragAndDrop();
  setupButtons();
}

function setupDragAndDrop() {
  const items = document.querySelectorAll('.article-item');
  let draggedIndex = null;

  items.forEach((item) => {
    item.addEventListener('dragstart', () => {
      draggedIndex = parseInt(item.dataset.index, 10);
      item.style.opacity = '0.5';
    });
    item.addEventListener('dragend', () => {
      item.style.opacity = '1';
    });
    item.addEventListener('dragover', (e) => e.preventDefault());
    item.addEventListener('drop', async (e) => {
      e.preventDefault();
      const targetIndex = parseInt(item.dataset.index, 10);
      if (!Number.isNaN(draggedIndex) && draggedIndex !== targetIndex) {
        await FolioStore.reorderArticleInList(currentStore.activeListId, draggedIndex, targetIndex);
      }
    });
  });
}

function getSelectedArticleIds() {
  return Array.from(document.querySelectorAll('.article-select:checked')).map((cb) => cb.dataset.articleId);
}

function setupButtons() {
  document.querySelectorAll('.article-select').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      e.target.closest('.article-item').classList.toggle('selected', e.target.checked);
    });
  });

  document.querySelectorAll('.article-title').forEach((title) => {
    title.addEventListener('click', async (e) => {
      const url = e.target.dataset.url;
      if (!url) return;
      const tab = await chrome.tabs.create({ url, active: true });
      const { collectionOpenReader = true } = await chrome.storage.local.get('collectionOpenReader');
      if (!collectionOpenReader) return;
      const listener = (tabId, changeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(async () => {
            try {
              await chrome.tabs.sendMessage(tab.id, { action: 'toggleReaderMode' });
            } catch (err) {
              console.log('Could not activate reader mode:', err);
            }
          }, 500);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  });

  document.querySelectorAll('.move-up').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const index = parseInt(e.currentTarget.dataset.index, 10);
      if (index > 0) {
        await FolioStore.reorderArticleInList(currentStore.activeListId, index, index - 1);
      }
    });
  });

  document.querySelectorAll('.move-down').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const index = parseInt(e.currentTarget.dataset.index, 10);
      await FolioStore.reorderArticleInList(currentStore.activeListId, index, index + 1);
    });
  });

  document.querySelectorAll('.remove').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const articleId = e.currentTarget.dataset.articleId;
      await FolioStore.removeArticleFromList(currentStore.activeListId, articleId);
    });
  });

  document.querySelectorAll('.btn-lists').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleArticleListsPopover(e.currentTarget);
    });
  });
}

// ---- Article lists popover ----

function closeAllPopovers() {
  document.querySelectorAll('.article-lists-popover').forEach((el) => el.remove());
}

function toggleArticleListsPopover(btn) {
  const existing = btn.parentElement.querySelector('.article-lists-popover');
  if (existing) {
    existing.remove();
    return;
  }
  closeAllPopovers();

  const articleId = btn.dataset.articleId;
  const membership = new Set(FolioStore.listsContainingArticle(currentStore, articleId));
  const popover = document.createElement('div');
  popover.className = 'article-lists-popover';

  const items = currentStore.lists.map((list) => `
    <label class="popover-item">
      <input type="checkbox" data-list-id="${escapeHTML(list.id)}" ${membership.has(list.id) ? 'checked' : ''}>
      <span class="name">${escapeHTML(list.name)}</span>
    </label>
  `).join('');

  popover.innerHTML = `
    <div class="popover-header">In lists</div>
    ${items}
  `;

  popover.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', async (e) => {
      const listId = e.target.dataset.listId;
      await FolioStore.toggleArticleInList(listId, articleId);
    });
  });

  popover.addEventListener('click', (e) => e.stopPropagation());
  btn.parentElement.appendChild(popover);
}

// ---- List switcher dropdown ----

function toggleListDropdown() {
  const dd = document.getElementById('list-dropdown');
  if (dd.classList.contains('active')) {
    dd.classList.remove('active');
  } else {
    renderListDropdown();
    dd.classList.add('active');
  }
}

function renderListDropdown() {
  const dd = document.getElementById('list-dropdown');
  const items = currentStore.lists.map((list) => `
    <div class="list-dropdown-item ${list.id === currentStore.activeListId ? 'active' : ''}" data-list-id="${escapeHTML(list.id)}">
      <span class="check">✓</span>
      <span class="name">${escapeHTML(list.name)}</span>
      <span class="count">${list.articleIds.length}</span>
    </div>
  `).join('');

  dd.innerHTML = `
    ${items}
    <div class="list-dropdown-divider"></div>
    <div class="list-dropdown-action" data-action="new">+ New list</div>
    <div class="list-dropdown-action" data-action="manage">⋯ Manage lists</div>
  `;

  dd.querySelectorAll('.list-dropdown-item').forEach((el) => {
    el.addEventListener('click', async () => {
      await FolioStore.setActiveList(el.dataset.listId);
      dd.classList.remove('active');
    });
  });

  dd.querySelectorAll('.list-dropdown-action').forEach((el) => {
    el.addEventListener('click', async () => {
      dd.classList.remove('active');
      if (el.dataset.action === 'new') {
        const name = prompt('Name for new list:');
        if (name && name.trim()) {
          const id = await FolioStore.createList(name.trim());
          await FolioStore.setActiveList(id);
        }
      } else if (el.dataset.action === 'manage') {
        openManageLists();
      }
    });
  });
}

// ---- Manage lists modal ----

function openManageLists() {
  const modal = document.getElementById('manage-lists-modal');
  modal.classList.add('active');
  renderManageLists();
}

function closeManageLists() {
  document.getElementById('manage-lists-modal').classList.remove('active');
}

function renderManageLists() {
  const container = document.getElementById('lists-manage-items');
  const canDelete = currentStore.lists.length > 1;
  container.innerHTML = currentStore.lists.map((list, index) => `
    <div class="list-manage-row" draggable="true" data-index="${index}" data-list-id="${escapeHTML(list.id)}">
      <span class="drag-handle">≡</span>
      <input class="list-name-input" type="text" value="${escapeHTML(list.name)}" maxlength="60" data-list-id="${escapeHTML(list.id)}">
      <span class="count">${list.articleIds.length}</span>
      <button class="delete-btn" data-list-id="${escapeHTML(list.id)}" ${canDelete ? '' : 'disabled'} title="${canDelete ? 'Delete list' : 'Cannot delete the last list'}">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('.list-name-input').forEach((input) => {
    input.addEventListener('change', async (e) => {
      await FolioStore.renameList(e.target.dataset.listId, e.target.value);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') e.target.blur();
    });
  });

  container.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const listId = e.currentTarget.dataset.listId;
      const list = currentStore.lists.find((l) => l.id === listId);
      if (!list) return;
      const msg = list.articleIds.length > 0
        ? `Delete "${list.name}"? Articles not in any other list will be removed.`
        : `Delete "${list.name}"?`;
      if (confirm(msg)) {
        await FolioStore.deleteList(listId);
      }
    });
  });

  // Drag reordering of lists
  let draggedIndex = null;
  container.querySelectorAll('.list-manage-row').forEach((row) => {
    row.addEventListener('dragstart', (e) => {
      draggedIndex = parseInt(row.dataset.index, 10);
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
    row.addEventListener('dragover', (e) => e.preventDefault());
    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      const targetIndex = parseInt(row.dataset.index, 10);
      if (!Number.isNaN(draggedIndex) && draggedIndex !== targetIndex) {
        await FolioStore.reorderLists(draggedIndex, targetIndex);
      }
    });
  });
}

async function addNewListFromInput() {
  const input = document.getElementById('new-list-input');
  const name = input.value.trim();
  if (!name) return;
  await FolioStore.createList(name);
  input.value = '';
}

// ---- Actions: clear, add current ----

async function clearCurrentList() {
  const list = FolioStore.getActiveList(currentStore);
  if (!list || list.articleIds.length === 0) return;
  if (confirm(`Clear all articles from "${list.name}"?`)) {
    await FolioStore.clearList(currentStore.activeListId);
  }
}

async function getExportTab() {
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
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return tab;
}

function resolveExportArticleIds() {
  const selected = getSelectedArticleIds();
  if (selected.length > 0) return selected;
  const list = FolioStore.getActiveList(currentStore);
  return [...list.articleIds];
}

async function exportPDF() {
  try {
    const articleIds = resolveExportArticleIds();
    if (articleIds.length === 0) {
      alert('No articles to export');
      return;
    }
    const tab = await getExportTab();
    await chrome.tabs.sendMessage(tab.id, { action: 'exportMagazinePDF', articleIds });
    await FolioStore.markArticlesExported(articleIds, 'pdf');
  } catch (error) {
    console.error('Error exporting PDF:', error);
    alert('Could not export PDF. Please try opening a regular web page first and try again.');
  }
}

async function exportEPUB() {
  try {
    const articleIds = resolveExportArticleIds();
    if (articleIds.length === 0) {
      alert('No articles to export');
      return;
    }
    const tab = await getExportTab();
    await chrome.tabs.sendMessage(tab.id, { action: 'exportMagazineEPUB', articleIds });
    await FolioStore.markArticlesExported(articleIds, 'epub');
  } catch (error) {
    console.error('Error exporting EPUB:', error);
    alert('Could not export EPUB. Please try opening a regular web page first and try again.');
  }
}

async function exportFolio() {
  try {
    const list = FolioStore.getActiveList(currentStore);
    const articles = list.articleIds.map((id) => currentStore.articles[id]).filter(Boolean);
    if (articles.length === 0) {
      alert('No articles in this list to export');
      return;
    }
    const folioContent = articles.map((a) => a.url).join('\n');
    const timestamp = new Date().toISOString().split('T')[0];
    const safeName = (list.name || 'list').replace(/[^a-z0-9\-_]+/gi, '-').toLowerCase();
    const header = `# Folio - ${list.name} - Exported ${timestamp}\n# ${articles.length} article${articles.length === 1 ? '' : 's'}\n\n`;
    const fullContent = header + folioContent;
    const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = `${safeName}-${timestamp}.folio`;
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

// ---- Settings ----

function toggleSettings() {
  document.getElementById('settings-panel').classList.toggle('active');
}

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

async function loadAutoOpenDomains() {
  const { autoOpenDomains = [] } = await chrome.storage.local.get('autoOpenDomains');
  const listEl = document.getElementById('domain-list');
  if (autoOpenDomains.length === 0) {
    listEl.innerHTML = '<div style="text-align: center; color: var(--text-muted); font-size: 11px; padding: 20px;">No domains configured</div>';
    return;
  }
  listEl.innerHTML = autoOpenDomains.map((domain) => `
    <div class="domain-item">
      <span class="domain-name">${escapeHTML(domain)}</span>
      <button class="domain-remove" data-domain="${escapeHTML(domain)}">Remove</button>
    </div>
  `).join('');
  document.querySelectorAll('.domain-remove').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      await removeDomain(e.target.dataset.domain);
    });
  });
}

async function addDomain() {
  const input = document.getElementById('domain-input');
  let domain = input.value.trim().toLowerCase();
  if (!domain) return;
  domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
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
  await chrome.storage.local.set({ autoOpenDomains: autoOpenDomains.filter((d) => d !== domain) });
  loadAutoOpenDomains();
}

async function addCurrentPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      alert('Cannot add chrome:// pages to collection');
      return;
    }
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getArticleData' });
    if (response && response.article) {
      await FolioStore.addArticleToList(currentStore.activeListId, response.article);
    }
  } catch (error) {
    console.error('Error adding current page:', error);
    alert('Could not add this page to collection');
  }
}

// ---- Import .folio ----

let importCancelled = false;

function parseFolioFile(content) {
  const urls = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    try {
      new URL(trimmed);
      urls.push(trimmed);
    } catch (err) {
      console.warn('Invalid URL skipped:', trimmed);
    }
  }
  return urls;
}

function showImportProgress() {
  document.getElementById('import-overlay').style.display = 'flex';
  importCancelled = false;
}
function hideImportProgress() {
  document.getElementById('import-overlay').style.display = 'none';
}
function updateImportProgress(current, total, status, details = '') {
  const pct = total > 0 ? (current / total) * 100 : 0;
  document.getElementById('import-progress-fill').style.width = `${pct}%`;
  document.getElementById('import-status').textContent = status;
  document.getElementById('import-details').textContent = details;
}

async function fetchArticleFromURL(url, index, total) {
  return new Promise(async (resolve, reject) => {
    try {
      updateImportProgress(index, total, `Processing ${index}/${total}`, `Fetching: ${new URL(url).hostname}`);
      const tab = await chrome.tabs.create({ url, active: false });
      const timeout = setTimeout(() => {
        chrome.tabs.remove(tab.id).catch(() => {});
        reject(new Error('Timeout loading page'));
      }, 30000);
      const listener = async (tabId, changeInfo) => {
        if (tabId === tab.id && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timeout);
          try {
            await new Promise((r) => setTimeout(r, 1000));
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getArticleData' });
            await chrome.tabs.remove(tab.id);
            if (response && response.article) resolve(response.article);
            else reject(new Error('Could not extract article data'));
          } catch (err) {
            await chrome.tabs.remove(tab.id).catch(() => {});
            reject(err);
          }
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    } catch (err) {
      reject(err);
    }
  });
}

async function importFolioFile(file) {
  try {
    const content = await file.text();
    const urls = parseFolioFile(content);
    if (urls.length === 0) {
      alert('No valid URLs found in .folio file');
      return;
    }

    const store = await FolioStore.loadStore();
    const targetListId = store.activeListId;

    showImportProgress();
    const results = { success: 0, skipped: 0, failed: 0 };

    for (let i = 0; i < urls.length; i++) {
      if (importCancelled) {
        updateImportProgress(i, urls.length, 'Import cancelled', `${results.success} imported`);
        await new Promise((r) => setTimeout(r, 2000));
        break;
      }
      const url = urls[i];

      const checkStore = await FolioStore.loadStore();
      const checkList = FolioStore.getList(checkStore, targetListId);
      const existingId = FolioStore.findArticleIdByUrl(checkStore, url);
      if (existingId && checkList && checkList.articleIds.includes(existingId)) {
        results.skipped++;
        updateImportProgress(i + 1, urls.length, `Processing ${i + 1}/${urls.length}`, `Already in list: ${new URL(url).hostname}`);
        continue;
      }

      try {
        const article = await fetchArticleFromURL(url, i + 1, urls.length);
        await FolioStore.addArticleToList(targetListId, article);
        results.success++;
      } catch (err) {
        console.error(`Failed to import ${url}:`, err);
        results.failed++;
      }
      if (i < urls.length - 1) await new Promise((r) => setTimeout(r, 1000));
    }

    updateImportProgress(
      urls.length,
      urls.length,
      'Import complete!',
      `✓ ${results.success} imported, ${results.skipped} skipped, ✗ ${results.failed} failed`
    );
    setTimeout(() => hideImportProgress(), 3000);
  } catch (error) {
    console.error('Error importing .folio file:', error);
    alert('Could not import .folio file: ' + error.message);
    hideImportProgress();
  }
}

// ---- File drag and drop ----

const articlesListEl = document.getElementById('articles-list');
articlesListEl.addEventListener('dragover', (e) => {
  if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
    e.preventDefault();
    e.stopPropagation();
    articlesListEl.classList.add('drag-over');
  }
});
articlesListEl.addEventListener('dragleave', (e) => {
  e.preventDefault();
  e.stopPropagation();
  articlesListEl.classList.remove('drag-over');
});
articlesListEl.addEventListener('drop', (e) => {
  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;
  e.preventDefault();
  e.stopPropagation();
  articlesListEl.classList.remove('drag-over');
  const file = files[0];
  if (!file.name.endsWith('.folio')) {
    alert('Please drop a .folio file');
    return;
  }
  importFolioFile(file);
});

// ---- Global event wiring ----

document.getElementById('list-switcher').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleListDropdown();
});
document.addEventListener('click', (e) => {
  const dd = document.getElementById('list-dropdown');
  if (dd.classList.contains('active') && !dd.contains(e.target)) {
    dd.classList.remove('active');
  }
  if (!e.target.closest('.article-lists-popover') && !e.target.closest('.btn-lists')) {
    closeAllPopovers();
  }
});

document.getElementById('new-list-add').addEventListener('click', addNewListFromInput);
document.getElementById('new-list-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addNewListFromInput();
});
document.getElementById('manage-lists-done').addEventListener('click', closeManageLists);
document.getElementById('manage-lists-modal').addEventListener('click', (e) => {
  if (e.target.id === 'manage-lists-modal') closeManageLists();
});

document.getElementById('export-pdf').addEventListener('click', exportPDF);
document.getElementById('export-epub').addEventListener('click', exportEPUB);
document.getElementById('export-folio').addEventListener('click', exportFolio);
document.getElementById('import-cancel').addEventListener('click', () => { importCancelled = true; });
document.getElementById('clear-all').addEventListener('click', clearCurrentList);
document.getElementById('settings-toggle').addEventListener('click', toggleSettings);
document.getElementById('add-current').addEventListener('click', addCurrentPage);
document.getElementById('add-domain').addEventListener('click', addDomain);
document.getElementById('domain-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addDomain();
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

document.querySelectorAll('.theme-btn').forEach((btn) => {
  btn.addEventListener('click', () => setTheme(btn.dataset.theme));
});

// ---- Storage change listener ----

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'local') return;
  if (changes[FolioStore.STORE_KEY]) refresh();
  if (changes.autoOpenDomains) loadAutoOpenDomains();
  if (changes.autoFullscreen || changes.collectionAsNewTab || changes.collectionOpenReader || changes.linksOpenReader) {
    loadSettings();
  }
  if (changes.collectionTheme) loadTheme();
});

// ---- Initialize ----

loadTheme();
loadSettings();
loadAutoOpenDomains();
refresh();
