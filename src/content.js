import { Readability } from '@mozilla/readability';

let readerModeActive = false;
let originalContent = null;
let currentPage = 0;
let totalPages = 0;
let pages = [];
let fontSizeMultiplier = 1.0;
let articleContent = null;
let columnGap = 30;
let lineHeight = 1.58;
let columnCount = 4;

const magazineCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap');

  #folio-reader-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #f9f9f9;
    overflow: hidden;
    z-index: 2147483647;
  }

  .folio-pages-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 60px;
    overflow: hidden;
  }

  .folio-page {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    transition: opacity 0.35s ease;
    padding: 50px 60px;
    box-sizing: border-box;
    overflow: hidden;
  }

  .folio-page.active {
    opacity: 1;
    z-index: 1;
  }

  .folio-page-content {
    height: 100%;
    column-count: 4;
    column-gap: 30px;
    column-fill: auto;
    font-family: 'Libre Caslon Text', Georgia, serif;
    color: #000000;
    line-height: 1.58;
    font-size: 1.05em;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
  }

  .folio-page.first-page {
    padding-left: calc(35% + 60px);
  }

  .folio-page.first-page .folio-page-content {
    column-count: 3;
  }

  .folio-page-decoration {
    position: absolute;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    width: 65%;
    height: 2px;
    background: #2C5F6F;
    opacity: 0.7;
  }

  .folio-page-number {
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 0.85em;
    color: #2C5F6F;
    font-weight: 400;
    letter-spacing: 0.05em;
  }

  .folio-header-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 35%;
    height: calc(100% - 60px);
    background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
    padding: 50px 40px 50px 60px;
    box-sizing: border-box;
    z-index: 10;
    border-right: 2px solid #cccccc;
    display: flex;
    flex-direction: column;
    justify-content: center;
    opacity: 1;
    transition: opacity 0.35s ease;
    box-shadow: 2px 0 12px rgba(0, 0, 0, 0.05);
  }

  .folio-header-overlay.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .folio-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 2.5em;
    font-weight: 700;
    line-height: 1.2;
    margin: 0 0 20px 0;
    padding-bottom: 18px;
    color: #2C5F6F;
    letter-spacing: -0.01em;
    border-bottom: 2px solid #2C5F6F;
  }

  .folio-byline {
    font-size: 0.85em;
    color: #666666;
    font-style: italic;
    margin: 16px 0;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .folio-excerpt {
    font-size: 1.1em;
    line-height: 1.6;
    color: #555555;
    margin: 24px 0 0 0;
    font-weight: 400;
    font-style: italic;
    padding-left: 20px;
    border-left: 2px solid #cccccc;
  }

  .folio-page-content p {
    margin: 0 0 1.2em 0;
    text-align: justify;
    hyphens: auto;
    orphans: 2;
    widows: 2;
  }

  .folio-page-content p:first-of-type::first-letter {
    float: left;
    font-size: 4em;
    line-height: 0.9;
    margin: 0.05em 0.08em 0 0;
    font-weight: 400;
    font-family: 'Libre Caslon Text', Georgia, serif;
    color: #000000;
  }

  .folio-page-content h2 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 1.6em;
    font-weight: 700;
    margin: 1.8em 0 0.6em 0;
    color: #1a1a1a;
    letter-spacing: -0.01em;
    break-after: avoid;
  }

  .folio-page-content h3 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 1.25em;
    font-weight: 600;
    margin: 1.4em 0 0.5em 0;
    color: #1a1a1a;
    font-style: italic;
    letter-spacing: -0.005em;
    break-after: avoid;
  }

  .folio-page-content img {
    max-width: 100%;
    height: auto;
    margin: 25px 0;
    display: block;
    cursor: pointer;
    transition: opacity 0.2s ease;
  }

  .folio-page-content img:hover {
    opacity: 0.8;
  }

  .folio-lightbox {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0);
    z-index: 2147483649;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    visibility: hidden;
    transition: background 0.3s ease, visibility 0s linear 0.3s;
  }

  .folio-lightbox.active {
    background: rgba(0, 0, 0, 0.9);
    visibility: visible;
    transition: background 0.3s ease, visibility 0s linear;
  }

  .folio-lightbox-img {
    max-width: 90%;
    max-height: 90%;
    object-fit: contain;
    box-shadow: 0 0 50px rgba(0, 0, 0, 0.5);
    transform: scale(0.8);
    opacity: 0;
    transition: transform 0.3s ease, opacity 0.3s ease;
  }

  .folio-lightbox.active .folio-lightbox-img {
    transform: scale(1);
    opacity: 1;
  }

  .folio-page-content blockquote {
    font-size: 1.05em;
    font-style: italic;
    margin: 1.5em 0;
    padding: 0 0 0 30px;
    border-left: 2px solid #000000;
    color: #333333;
    font-weight: 400;
  }

  .folio-page-content ul, .folio-page-content ol {
    margin: 1em 0;
    padding-left: 1.8em;
  }

  .folio-page-content li {
    margin: 0.4em 0;
    line-height: 1.58;
  }

  .folio-nav {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 25px;
    z-index: 2147483648;
    border-top: 1px solid #e0e0e0;
    opacity: 1;
    transition: opacity 0.3s ease, transform 0.3s ease;
  }

  .folio-nav.hidden {
    opacity: 0;
    transform: translateY(10px);
    pointer-events: none;
  }

  .folio-nav-btn {
    background-color: #ffffff;
    color: #000000;
    border: 1px solid #000000;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 18px;
    font-family: 'Crimson Text', Georgia, serif;
    border-radius: 0;
    transition: all 0.2s ease;
    min-width: 45px;
    letter-spacing: 0;
    font-weight: 400;
  }

  .folio-nav-btn:hover:not(:disabled) {
    background-color: #000000;
    color: #ffffff;
  }

  .folio-nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .folio-page-indicator {
    color: #000000;
    font-family: 'Crimson Text', Georgia, serif;
    font-size: 13px;
    min-width: 100px;
    text-align: center;
    letter-spacing: 0.02em;
  }

  .folio-font-controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .folio-font-btn {
    background-color: #ffffff;
    color: #000000;
    border: 1px solid #000000;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 16px;
    font-family: 'Crimson Text', Georgia, serif;
    border-radius: 0;
    transition: all 0.2s ease;
    min-width: 38px;
    letter-spacing: 0;
    font-weight: 400;
  }

  .folio-font-btn:hover {
    background-color: #000000;
    color: #ffffff;
  }

  .folio-fullscreen-btn {
    background-color: #ffffff;
    color: #000000;
    border: 1px solid #000000;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 16px;
    font-family: 'Crimson Text', Georgia, serif;
    border-radius: 0;
    transition: all 0.2s ease;
    min-width: 38px;
    letter-spacing: 0;
    font-weight: 400;
  }

  .folio-fullscreen-btn:hover {
    background-color: #000000;
    color: #ffffff;
  }

  .folio-close-btn {
    background-color: #ffffff;
    color: #000000;
    border: 1px solid #000000;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 18px;
    font-family: 'Crimson Text', Georgia, serif;
    border-radius: 0;
    transition: all 0.2s ease;
    min-width: 38px;
    position: absolute;
    right: 25px;
    letter-spacing: 0;
    font-weight: 400;
  }

  .folio-close-btn:hover {
    background-color: #000000;
    color: #ffffff;
  }

  @media (max-width: 1400px) {
    .folio-page-content {
      column-count: 2;
      column-gap: 50px;
    }
  }

  @media (max-width: 1100px) {
    .folio-page-content {
      column-count: 1;
    }

    .folio-page {
      padding: 50px 60px;
    }

    .folio-page.first-page {
      padding-left: 60px;
      padding-top: 400px;
    }

    .folio-header-overlay {
      position: static;
      width: 100%;
      height: 350px;
      border-right: none;
      border-bottom: 3px double #333;
    }
  }
`;

function splitContentIntoPages(content, container) {
  const wrapper = container.querySelector('.folio-pages-wrapper');
  if (!wrapper) return [];

  // Create a temporary div to parse the content
  const contentParser = document.createElement('div');
  contentParser.innerHTML = content;
  const elements = Array.from(contentParser.querySelectorAll('p, h2, h3, blockquote, ul, ol, img'));

  const pages = [];
  let elementIndex = 0;

  // Helper function to measure a page
  function measurePage(isFirstPage) {
    const tempPage = document.createElement('div');
    tempPage.className = isFirstPage ? 'folio-page first-page' : 'folio-page';
    tempPage.style.visibility = 'hidden';
    tempPage.style.position = 'absolute';
    tempPage.style.left = '-9999px';

    const tempMeasure = document.createElement('div');
    tempMeasure.className = 'folio-page-content';
    // Apply dynamic column count (first page uses one less column to account for header)
    tempMeasure.style.columnCount = isFirstPage ? Math.max(1, columnCount - 1) : columnCount;
    tempPage.appendChild(tempMeasure);
    wrapper.appendChild(tempPage);

    const availableHeight = tempMeasure.offsetHeight;
    const availableWidth = tempMeasure.offsetWidth;

    console.log(`Page ${pages.length + 1} (${isFirstPage ? 'first' : 'regular'}) dimensions:`, availableWidth, 'x', availableHeight);

    let currentPageContent = '';

    while (elementIndex < elements.length) {
      const el = elements[elementIndex];
      tempMeasure.innerHTML = currentPageContent + el.outerHTML;

      const hasVerticalOverflow = tempMeasure.scrollHeight > availableHeight;
      const hasHorizontalOverflow = tempMeasure.scrollWidth > availableWidth;

      if ((hasVerticalOverflow || hasHorizontalOverflow) && currentPageContent) {
        // Current page is full, don't increment index
        break;
      } else {
        currentPageContent += el.outerHTML;
        elementIndex++;
      }
    }

    wrapper.removeChild(tempPage);
    return currentPageContent;
  }

  // Measure first page with 2-column layout
  if (elementIndex < elements.length) {
    const firstPageContent = measurePage(true);
    if (firstPageContent) {
      pages.push(firstPageContent);
    }
  }

  // Measure remaining pages with 3-column layout
  while (elementIndex < elements.length) {
    const pageContent = measurePage(false);
    if (pageContent) {
      pages.push(pageContent);
    } else {
      // Safety check: if no content was added, move to next element to avoid infinite loop
      elementIndex++;
    }
  }

  console.log('Split into', pages.length, 'pages');
  return pages.length > 0 ? pages : [content];
}

function goToPage(pageNum) {
  if (pageNum < 0 || pageNum >= totalPages) return;

  // Hide current page
  const currentPageEl = document.querySelector('.folio-page.active');
  if (currentPageEl) {
    currentPageEl.classList.remove('active');
  }

  // Show new page
  currentPage = pageNum;
  const newPageEl = document.querySelectorAll('.folio-page')[currentPage];
  if (newPageEl) {
    newPageEl.classList.add('active');
  }

  // Toggle header visibility
  const header = document.querySelector('.folio-header-overlay');
  if (header) {
    if (currentPage === 0) {
      header.classList.remove('hidden');
    } else {
      header.classList.add('hidden');
    }
  }

  updateNavigation();
}

function updateNavigation() {
  const prevBtn = document.getElementById('folio-prev-btn');
  const nextBtn = document.getElementById('folio-next-btn');
  const indicator = document.getElementById('folio-page-indicator');

  if (prevBtn) prevBtn.disabled = currentPage === 0;
  if (nextBtn) nextBtn.disabled = currentPage === totalPages - 1;
  if (indicator) indicator.textContent = `Page ${currentPage + 1} of ${totalPages}`;
}

function handleKeyPress(e) {
  if (!readerModeActive) return;

  // Check if lightbox is open first
  const lightbox = document.getElementById('folio-lightbox');
  if (lightbox && lightbox.classList.contains('active')) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeLightbox();
      return;
    }
  }

  switch(e.key) {
    case 'ArrowLeft':
    case 'PageUp':
      e.preventDefault();
      goToPage(currentPage - 1);
      break;
    case 'ArrowRight':
    case 'PageDown':
    case ' ':
      e.preventDefault();
      goToPage(currentPage + 1);
      break;
    case 'Home':
      e.preventDefault();
      goToPage(0);
      break;
    case 'End':
      e.preventDefault();
      goToPage(totalPages - 1);
      break;
    case 'Escape':
      e.preventDefault();
      deactivateReaderMode();
      break;
  }
}

let navHideTimeout = null;
let resizeTimeout = null;

function getOptimalColumnCount() {
  const width = window.innerWidth;
  if (width < 600) return 1;
  if (width < 900) return 2;
  if (width < 1200) return 3;
  return 4;
}

function handleResize() {
  if (!readerModeActive || !articleContent) return;

  // Clear existing timeout
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }

  // Wait for resize to finish (500ms after last resize event)
  resizeTimeout = setTimeout(() => {
    // Update column count based on new viewport size
    columnCount = getOptimalColumnCount();
    rebuildPages();
    resizeTimeout = null;
  }, 500);
}

function handleMouseMove(e) {
  if (!readerModeActive) return;

  const nav = document.querySelector('.folio-nav');
  if (!nav) return;

  const windowHeight = window.innerHeight;
  const showThreshold = 100; // Show nav when cursor is within 100px of bottom

  if (windowHeight - e.clientY < showThreshold) {
    // Cursor near bottom - show nav
    nav.classList.remove('hidden');

    // Clear any existing timeout
    if (navHideTimeout) {
      clearTimeout(navHideTimeout);
      navHideTimeout = null;
    }
  } else {
    // Cursor away from bottom - hide nav after delay
    if (!navHideTimeout) {
      navHideTimeout = setTimeout(() => {
        nav.classList.add('hidden');
        navHideTimeout = null;
      }, 1000);
    }
  }
}

function changeFontSize(delta) {
  fontSizeMultiplier = Math.max(0.7, Math.min(1.5, fontSizeMultiplier + delta));

  // Apply font size to header elements
  const title = document.querySelector('.folio-title');
  if (title) {
    title.style.fontSize = `${2.5 * fontSizeMultiplier}em`;
  }

  const byline = document.querySelector('.folio-byline');
  if (byline) {
    byline.style.fontSize = `${0.85 * fontSizeMultiplier}em`;
  }

  const excerpt = document.querySelector('.folio-excerpt');
  if (excerpt) {
    excerpt.style.fontSize = `${1.1 * fontSizeMultiplier}em`;
  }

  // Rebuild pages with new font size
  if (articleContent) {
    rebuildPages();
  }
}

function changeColumnCount(delta) {
  columnCount = Math.max(2, Math.min(6, columnCount + delta));

  // Rebuild pages with new column count
  if (articleContent) {
    rebuildPages();
  }
}

function changeLineHeight(delta) {
  lineHeight = Math.max(1.3, Math.min(2.0, lineHeight + delta));

  // Rebuild pages with new line height
  if (articleContent) {
    rebuildPages();
  }
}

function rebuildPages() {
  const container = document.getElementById('folio-reader-container');
  const wrapper = container.querySelector('.folio-pages-wrapper');
  if (!wrapper) return;

  // Calculate current position as percentage through document
  const positionPercentage = totalPages > 0 ? currentPage / totalPages : 0;

  // Clear existing pages
  wrapper.innerHTML = '';

  // Apply font size, column gap, and line height to a temporary style
  const tempStyle = document.createElement('style');
  tempStyle.textContent = `
    .folio-page-content {
      font-size: ${1.05 * fontSizeMultiplier}em !important;
      column-gap: ${columnGap}px !important;
      line-height: ${lineHeight} !important;
    }
  `;
  container.appendChild(tempStyle);

  // Re-split content with new settings
  pages = splitContentIntoPages(articleContent, container);
  totalPages = pages.length;

  // Create new page elements
  pages.forEach((pageContent, index) => {
    const pageEl = document.createElement('div');
    pageEl.className = 'folio-page';
    if (index === 0) pageEl.classList.add('first-page');

    const pageContentEl = document.createElement('div');
    pageContentEl.className = 'folio-page-content';
    pageContentEl.style.fontSize = `${1.05 * fontSizeMultiplier}em`;
    pageContentEl.style.columnGap = `${columnGap}px`;
    pageContentEl.style.lineHeight = lineHeight;
    pageContentEl.style.columnCount = index === 0 ? Math.max(1, columnCount - 1) : columnCount;
    pageContentEl.innerHTML = pageContent;

    pageEl.appendChild(pageContentEl);

    // Add decorative line
    const decoration = document.createElement('div');
    decoration.className = 'folio-page-decoration';
    pageEl.appendChild(decoration);

    // Add page number
    const pageNumber = document.createElement('div');
    pageNumber.className = 'folio-page-number';
    pageNumber.textContent = index + 1;
    pageEl.appendChild(pageNumber);

    wrapper.appendChild(pageEl);
  });

  // Remove temp style
  container.removeChild(tempStyle);

  // Go to approximately the same position in the document
  const newPage = Math.min(Math.floor(positionPercentage * totalPages), totalPages - 1);
  currentPage = Math.max(0, newPage);
  goToPage(currentPage);

  // Add image click handlers
  addImageClickHandlers();
}

function showImageLightbox(imgSrc) {
  const lightbox = document.getElementById('folio-lightbox');
  const lightboxImg = document.getElementById('folio-lightbox-img');

  if (lightbox && lightboxImg) {
    lightboxImg.src = imgSrc;
    lightbox.classList.add('active');
  }
}

function closeLightbox() {
  const lightbox = document.getElementById('folio-lightbox');
  if (lightbox) {
    lightbox.classList.remove('active');
  }
}

function addImageClickHandlers() {
  const images = document.querySelectorAll('.folio-page-content img');
  images.forEach(img => {
    img.onclick = (e) => {
      e.stopPropagation();
      showImageLightbox(img.src);
    };
  });
}

function toggleFullscreen() {
  const fullscreenBtn = document.getElementById('folio-fullscreen-btn');

  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      if (fullscreenBtn) {
        fullscreenBtn.textContent = 'Exit Fullscreen';
      }
      // Rebuild pages after a short delay to let fullscreen settle
      setTimeout(() => {
        if (articleContent) {
          rebuildPages();
        }
      }, 100);
    }).catch(err => {
      console.error('Error attempting to enable fullscreen:', err);
    });
  } else {
    document.exitFullscreen().then(() => {
      if (fullscreenBtn) {
        fullscreenBtn.textContent = 'Fullscreen';
      }
      // Rebuild pages after a short delay to let fullscreen exit settle
      setTimeout(() => {
        if (articleContent) {
          rebuildPages();
        }
      }, 100);
    }).catch(err => {
      console.error('Error attempting to exit fullscreen:', err);
    });
  }
}

function activateReaderMode() {
  if (readerModeActive) return;

  originalContent = {
    html: document.body.innerHTML,
    overflow: document.body.style.overflow
  };

  const documentClone = document.cloneNode(true);
  const reader = new Readability(documentClone);
  const article = reader.parse();

  if (!article) {
    console.error('Folio Reader: Could not parse article');
    return;
  }

  const container = document.createElement('div');
  container.id = 'folio-reader-container';

  const styleElement = document.createElement('style');
  styleElement.textContent = magazineCSS;
  container.appendChild(styleElement);

  // Create header
  const headerOverlay = document.createElement('div');
  headerOverlay.className = 'folio-header-overlay';

  const title = document.createElement('h1');
  title.className = 'folio-title';
  title.textContent = article.title;
  headerOverlay.appendChild(title);

  if (article.byline) {
    const byline = document.createElement('div');
    byline.className = 'folio-byline';
    byline.textContent = article.byline;
    headerOverlay.appendChild(byline);
  }

  if (article.excerpt) {
    const excerpt = document.createElement('div');
    excerpt.className = 'folio-excerpt';
    excerpt.textContent = article.excerpt;
    headerOverlay.appendChild(excerpt);
  }

  container.appendChild(headerOverlay);

  // Create pages wrapper
  const pagesWrapper = document.createElement('div');
  pagesWrapper.className = 'folio-pages-wrapper';
  container.appendChild(pagesWrapper);

  // Create navigation
  const nav = document.createElement('div');
  nav.className = 'folio-nav';

  const prevBtn = document.createElement('button');
  prevBtn.id = 'folio-prev-btn';
  prevBtn.className = 'folio-nav-btn';
  prevBtn.textContent = '‹';
  prevBtn.title = 'Previous Page';
  prevBtn.onclick = () => goToPage(currentPage - 1);
  nav.appendChild(prevBtn);

  const indicator = document.createElement('div');
  indicator.id = 'folio-page-indicator';
  indicator.className = 'folio-page-indicator';
  indicator.textContent = 'Page 1 of 1';
  nav.appendChild(indicator);

  const nextBtn = document.createElement('button');
  nextBtn.id = 'folio-next-btn';
  nextBtn.className = 'folio-nav-btn';
  nextBtn.textContent = '›';
  nextBtn.title = 'Next Page';
  nextBtn.onclick = () => goToPage(currentPage + 1);
  nav.appendChild(nextBtn);

  const fontControls = document.createElement('div');
  fontControls.className = 'folio-font-controls';

  const decreaseFontBtn = document.createElement('button');
  decreaseFontBtn.className = 'folio-font-btn';
  decreaseFontBtn.textContent = 'A⁻';
  decreaseFontBtn.title = 'Decrease Font Size';
  decreaseFontBtn.onclick = () => changeFontSize(-0.1);
  fontControls.appendChild(decreaseFontBtn);

  const increaseFontBtn = document.createElement('button');
  increaseFontBtn.className = 'folio-font-btn';
  increaseFontBtn.textContent = 'A⁺';
  increaseFontBtn.title = 'Increase Font Size';
  increaseFontBtn.onclick = () => changeFontSize(0.1);
  fontControls.appendChild(increaseFontBtn);

  nav.appendChild(fontControls);

  const columnControls = document.createElement('div');
  columnControls.className = 'folio-font-controls';

  const decreaseColumnBtn = document.createElement('button');
  decreaseColumnBtn.className = 'folio-font-btn';
  decreaseColumnBtn.textContent = '◧';
  decreaseColumnBtn.title = 'Decrease Column Count';
  decreaseColumnBtn.onclick = () => changeColumnCount(-1);
  columnControls.appendChild(decreaseColumnBtn);

  const increaseColumnBtn = document.createElement('button');
  increaseColumnBtn.className = 'folio-font-btn';
  increaseColumnBtn.textContent = '◨';
  increaseColumnBtn.title = 'Increase Column Count';
  increaseColumnBtn.onclick = () => changeColumnCount(1);
  columnControls.appendChild(increaseColumnBtn);

  nav.appendChild(columnControls);

  const lineControls = document.createElement('div');
  lineControls.className = 'folio-font-controls';

  const decreaseLineBtn = document.createElement('button');
  decreaseLineBtn.className = 'folio-font-btn';
  decreaseLineBtn.textContent = '≡';
  decreaseLineBtn.title = 'Decrease Line Spacing';
  decreaseLineBtn.onclick = () => changeLineHeight(-0.1);
  lineControls.appendChild(decreaseLineBtn);

  const increaseLineBtn = document.createElement('button');
  increaseLineBtn.className = 'folio-font-btn';
  increaseLineBtn.textContent = '☰';
  increaseLineBtn.title = 'Increase Line Spacing';
  increaseLineBtn.onclick = () => changeLineHeight(0.1);
  lineControls.appendChild(increaseLineBtn);

  nav.appendChild(lineControls);

  const fullscreenBtn = document.createElement('button');
  fullscreenBtn.id = 'folio-fullscreen-btn';
  fullscreenBtn.className = 'folio-fullscreen-btn';
  fullscreenBtn.textContent = '⛶';
  fullscreenBtn.title = 'Toggle Fullscreen';
  fullscreenBtn.onclick = toggleFullscreen;
  nav.appendChild(fullscreenBtn);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'folio-close-btn';
  closeBtn.textContent = '✕';
  closeBtn.title = 'Close Reader';
  closeBtn.onclick = deactivateReaderMode;
  nav.appendChild(closeBtn);

  container.appendChild(nav);

  // Create lightbox
  const lightbox = document.createElement('div');
  lightbox.id = 'folio-lightbox';
  lightbox.className = 'folio-lightbox';
  lightbox.onclick = closeLightbox;

  const lightboxImg = document.createElement('img');
  lightboxImg.id = 'folio-lightbox-img';
  lightboxImg.className = 'folio-lightbox-img';
  lightboxImg.onclick = (e) => e.stopPropagation(); // Prevent closing when clicking the image itself

  lightbox.appendChild(lightboxImg);
  container.appendChild(lightbox);

  document.body.innerHTML = '';
  document.body.appendChild(container);
  document.body.style.overflow = 'hidden';

  readerModeActive = true;
  document.addEventListener('keydown', handleKeyPress);
  document.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('resize', handleResize);

  // Store article content for rebuilding pages
  articleContent = article.content;

  // Split content into pages
  setTimeout(() => {
    pages = splitContentIntoPages(articleContent, container);
    totalPages = pages.length;

    // Create page elements
    pages.forEach((pageContent, index) => {
      const pageEl = document.createElement('div');
      pageEl.className = 'folio-page';
      if (index === 0) pageEl.classList.add('first-page');

      const pageContentEl = document.createElement('div');
      pageContentEl.className = 'folio-page-content';
      pageContentEl.style.columnCount = index === 0 ? Math.max(1, columnCount - 1) : columnCount;
      pageContentEl.innerHTML = pageContent;

      pageEl.appendChild(pageContentEl);

      // Add decorative line
      const decoration = document.createElement('div');
      decoration.className = 'folio-page-decoration';
      pageEl.appendChild(decoration);

      // Add page number
      const pageNumber = document.createElement('div');
      pageNumber.className = 'folio-page-number';
      pageNumber.textContent = index + 1;
      pageEl.appendChild(pageNumber);

      pagesWrapper.appendChild(pageEl);
    });

    currentPage = 0;
    goToPage(0);

    // Add image click handlers
    addImageClickHandlers();

    // Initially hide the nav
    setTimeout(() => {
      const nav = document.querySelector('.folio-nav');
      if (nav) {
        nav.classList.add('hidden');
      }
    }, 2000); // Show nav for 2 seconds on load, then hide
  }, 100);
}

function deactivateReaderMode() {
  if (!readerModeActive || !originalContent) return;

  document.removeEventListener('keydown', handleKeyPress);
  document.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('resize', handleResize);

  if (navHideTimeout) {
    clearTimeout(navHideTimeout);
    navHideTimeout = null;
  }

  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
    resizeTimeout = null;
  }

  document.body.innerHTML = originalContent.html;
  document.body.style.overflow = originalContent.overflow;

  originalContent = null;
  readerModeActive = false;
  currentPage = 0;
  totalPages = 0;
  pages = [];
  fontSizeMultiplier = 1.0;
  articleContent = null;
  columnGap = 30;
  lineHeight = 1.58;
  columnCount = 4;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleReaderMode') {
    if (readerModeActive) {
      deactivateReaderMode();
    } else {
      activateReaderMode();
    }
    sendResponse({ success: true, active: readerModeActive });
  }
  return true;
});
