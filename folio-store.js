// Shared Folio collection store. Loaded by background service worker
// (importScripts) and by popup/newtab pages (<script src>).

self.FolioStore = (function () {
  const STORE_KEY = 'folioStore';
  const LEGACY_KEY = 'magazine';
  const VERSION = 3;
  const DEFAULT_LIST_NAME = 'Reading List';

  function genId(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function normalizeUrl(url) {
    try {
      const u = new URL(url);
      const path = u.pathname.replace(/\/$/, '');
      return (u.origin + path + u.search).toLowerCase();
    } catch {
      return (url || '').toLowerCase();
    }
  }

  function findArticleIdByUrl(store, url) {
    const target = normalizeUrl(url);
    for (const [id, a] of Object.entries(store.articles)) {
      if (normalizeUrl(a.url) === target) return id;
    }
    return null;
  }

  function gcArticle(store, articleId) {
    const stillUsed = store.lists.some((l) => l.articleIds.includes(articleId));
    if (!stillUsed) delete store.articles[articleId];
  }

  // Dedupe articles by normalized URL inside an existing store.
  // Any article whose URL matches an earlier entry is collapsed onto the
  // surviving ID, and every list's articleIds is rewritten to point to survivors
  // (with order preserved and intra-list duplicates removed).
  function dedupeByUrl(store) {
    const urlToId = {};
    const idRemap = {};
    for (const [id, article] of Object.entries(store.articles)) {
      const key = normalizeUrl(article.url);
      if (!key) {
        urlToId[id] = id;
        continue;
      }
      if (urlToId[key]) {
        idRemap[id] = urlToId[key];
      } else {
        urlToId[key] = id;
      }
    }
    if (Object.keys(idRemap).length === 0) return store;

    for (const oldId of Object.keys(idRemap)) {
      delete store.articles[oldId];
    }
    for (const list of store.lists) {
      const seen = new Set();
      const next = [];
      for (const id of list.articleIds) {
        const survivor = idRemap[id] || id;
        if (!store.articles[survivor]) continue;
        if (seen.has(survivor)) continue;
        seen.add(survivor);
        next.push(survivor);
      }
      list.articleIds = next;
    }
    return store;
  }

  async function loadStore() {
    const data = await chrome.storage.local.get([STORE_KEY, LEGACY_KEY]);
    const existing = data[STORE_KEY];
    if (existing && existing.version === VERSION) {
      return existing;
    }
    if (existing && existing.articles && existing.lists) {
      const repaired = dedupeByUrl(existing);
      repaired.version = VERSION;
      await chrome.storage.local.set({ [STORE_KEY]: repaired });
      return repaired;
    }

    const legacy = Array.isArray(data[LEGACY_KEY]) ? data[LEGACY_KEY] : [];
    const articles = {};
    const articleIds = [];
    const seenUrls = {};
    for (const article of legacy) {
      const key = normalizeUrl(article.url);
      if (key && seenUrls[key]) continue;
      const id = genId('a');
      articles[id] = { ...article, id };
      articleIds.push(id);
      if (key) seenUrls[key] = id;
    }
    const defaultListId = genId('list');
    const store = {
      version: VERSION,
      articles,
      lists: [{ id: defaultListId, name: DEFAULT_LIST_NAME, articleIds }],
      activeListId: defaultListId,
    };
    await chrome.storage.local.set({ [STORE_KEY]: store });
    if (LEGACY_KEY in data) {
      await chrome.storage.local.remove(LEGACY_KEY);
    }
    return store;
  }

  async function saveStore(store) {
    await chrome.storage.local.set({ [STORE_KEY]: store });
  }

  function getList(store, listId) {
    return store.lists.find((l) => l.id === listId);
  }

  function getActiveList(store) {
    return getList(store, store.activeListId) || store.lists[0];
  }

  function getArticlesForList(store, listId) {
    const list = getList(store, listId);
    if (!list) return [];
    return list.articleIds.map((id) => store.articles[id]).filter(Boolean);
  }

  function listsContainingArticle(store, articleId) {
    return store.lists.filter((l) => l.articleIds.includes(articleId)).map((l) => l.id);
  }

  async function setActiveList(listId) {
    const store = await loadStore();
    if (store.lists.some((l) => l.id === listId) && store.activeListId !== listId) {
      store.activeListId = listId;
      await saveStore(store);
    }
  }

  async function createList(name) {
    const store = await loadStore();
    const id = genId('list');
    const trimmed = (name || '').trim() || 'Untitled list';
    store.lists.push({ id, name: trimmed, articleIds: [] });
    await saveStore(store);
    return id;
  }

  async function renameList(listId, name) {
    const store = await loadStore();
    const list = getList(store, listId);
    if (!list) return;
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    list.name = trimmed;
    await saveStore(store);
  }

  async function deleteList(listId) {
    const store = await loadStore();
    if (store.lists.length <= 1) return false;
    const list = getList(store, listId);
    if (!list) return false;
    store.lists = store.lists.filter((l) => l.id !== listId);
    for (const id of list.articleIds) gcArticle(store, id);
    if (store.activeListId === listId) store.activeListId = store.lists[0].id;
    await saveStore(store);
    return true;
  }

  async function reorderLists(fromIndex, toIndex) {
    const store = await loadStore();
    if (fromIndex < 0 || fromIndex >= store.lists.length) return;
    const [item] = store.lists.splice(fromIndex, 1);
    store.lists.splice(toIndex, 0, item);
    await saveStore(store);
  }

  async function addArticleToList(listId, article) {
    const store = await loadStore();
    const list = getList(store, listId);
    if (!list) return null;
    let id = findArticleIdByUrl(store, article.url);
    if (!id) {
      id = genId('a');
      store.articles[id] = { ...article, id };
    }
    if (!list.articleIds.includes(id)) list.articleIds.unshift(id);
    await saveStore(store);
    return id;
  }

  async function removeArticleFromList(listId, articleId) {
    const store = await loadStore();
    const list = getList(store, listId);
    if (!list) return;
    list.articleIds = list.articleIds.filter((id) => id !== articleId);
    gcArticle(store, articleId);
    await saveStore(store);
  }

  async function toggleArticleInList(listId, articleId) {
    const store = await loadStore();
    const list = getList(store, listId);
    if (!list || !store.articles[articleId]) return;
    if (list.articleIds.includes(articleId)) {
      list.articleIds = list.articleIds.filter((id) => id !== articleId);
      gcArticle(store, articleId);
    } else {
      list.articleIds.unshift(articleId);
    }
    await saveStore(store);
  }

  async function reorderArticleInList(listId, fromIndex, toIndex) {
    const store = await loadStore();
    const list = getList(store, listId);
    if (!list) return;
    if (fromIndex < 0 || fromIndex >= list.articleIds.length) return;
    const [id] = list.articleIds.splice(fromIndex, 1);
    list.articleIds.splice(toIndex, 0, id);
    await saveStore(store);
  }

  async function clearList(listId) {
    const store = await loadStore();
    const list = getList(store, listId);
    if (!list) return;
    const toGc = [...list.articleIds];
    list.articleIds = [];
    for (const id of toGc) gcArticle(store, id);
    await saveStore(store);
  }

  async function markArticlesExported(articleIds, format) {
    const store = await loadStore();
    const key = format === 'pdf' ? 'exportedPDF' : 'exportedEPUB';
    for (const id of articleIds) {
      if (store.articles[id]) store.articles[id][key] = true;
    }
    await saveStore(store);
  }

  return {
    STORE_KEY,
    DEFAULT_LIST_NAME,
    loadStore,
    saveStore,
    getList,
    getActiveList,
    getArticlesForList,
    listsContainingArticle,
    setActiveList,
    createList,
    renameList,
    deleteList,
    reorderLists,
    addArticleToList,
    removeArticleFromList,
    toggleArticleInList,
    reorderArticleInList,
    clearList,
    markArticlesExported,
    normalizeUrl,
    findArticleIdByUrl,
  };
})();
