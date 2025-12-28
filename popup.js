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
        <div class="empty-state-hint">Right-click the extension icon<br>and select "Add to Magazine"</div>
      </div>
    `;
    return;
  }

  listEl.innerHTML = magazine.map((article, index) => `
    <div class="article-item" data-index="${index}" draggable="true">
      <div class="article-title">${escapeHTML(article.title)}</div>
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
  // Open export page with PDF hash
  await chrome.tabs.create({
    url: chrome.runtime.getURL('export.html#pdf'),
    active: true
  });

  // Close popup
  window.close();
}

async function exportEPUB() {
  // Open export page with EPUB hash
  await chrome.tabs.create({
    url: chrome.runtime.getURL('export.html#epub'),
    active: true
  });

  // Close popup
  window.close();
}

// Event listeners
document.getElementById('export-pdf').addEventListener('click', exportPDF);
document.getElementById('export-epub').addEventListener('click', exportEPUB);
document.getElementById('clear-all').addEventListener('click', clearAll);

// Listen for storage changes to update magazine in real-time
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.magazine) {
    loadArticles();
  }
});

// Load articles on popup open
loadArticles();
