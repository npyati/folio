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
let viewportWidthPercent = 1.0;
let currentTheme = null;
let allImages = [];
let currentLightboxIndex = 0;

// Site-specific ending marks for content truncation
const siteEndingMarks = {
  'economist.com': '■'
};

// Design element pools for generative combinations
const themeElements = {
  backgrounds: [
    '#ffffff', '#fefefe', '#fafafa', '#f9f9f9', '#f5f5f5',
    '#f5f1e8', '#faf7f0', '#fff8f0', '#f8f9fa', '#f4f6f8',
    '#0a0a0a', '#1c1c1e', '#1a1a1a', '#2a2a2a',
    '#fff5eb', '#fef3e2', '#f0e6d2'
  ],

  textColors: [
    '#000000', '#1a1a1a', '#2a2419', '#3c3530', '#3e3330',
    '#2b3e50', '#1e3a52', '#333333', '#2f2f2f',
    '#e8e8e8', '#d4c5a0', '#f5f5f5', '#cccccc'
  ],

  accentColors: [
    '#8b6b47', '#a04f3c', '#ff6b35', '#4a90a4', '#c9a961',
    '#d4684f', '#2e5c7a', '#c24f38', '#7a5c47', '#b39958',
    '#5a7f8c', '#e89b7e', '#c9a97a', '#d4a574', '#b8d4e0'
  ],

  titleFonts: [
    "'Playfair Display', Georgia, serif",
    "'Georgia', serif",
    "'Libre Caslon Text', Georgia, serif",
    "'Helvetica Neue', Arial, sans-serif",
    "'Futura', 'Trebuchet MS', sans-serif",
    "'Times New Roman', Times, serif",
    "'Baskerville', 'Libre Baskerville', serif"
  ],

  bodyFonts: [
    "'Libre Caslon Text', Georgia, serif",
    "'Georgia', serif",
    "'Garamond', 'Libre Baskerville', serif",
    "'Charter', 'Bitstream Charter', serif",
    "'Iowan Old Style', 'Palatino Linotype', serif",
    "'Hoefler Text', 'Baskerville Old Face', serif"
  ],

  titleSizes: ['2.4em', '2.6em', '2.8em', '3em', '3.2em', '3.4em', '3.6em', '4em'],

  titleWeights: ['300', '400', '600', '700', '800', '900'],

  borderStyles: [
    '1px solid',
    '2px solid',
    '3px solid',
    '2px double',
    '3px double',
    '1px dashed'
  ]
};

function pickRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// Truncate article content at site-specific ending marks
function truncateAtEndingMark(content) {
  const hostname = window.location.hostname;

  // Check if current site has an ending mark configured
  for (const [domain, endingMark] of Object.entries(siteEndingMarks)) {
    if (hostname.includes(domain)) {
      const endingMarkIndex = content.indexOf(endingMark);
      if (endingMarkIndex !== -1) {
        console.log(`Folio: Truncating content at ending mark "${endingMark}" for ${domain}`);
        // Include the ending mark itself, then truncate everything after
        return content.substring(0, endingMarkIndex + endingMark.length);
      }
    }
  }

  return content;
}

function generateRandomTheme(preserveSettings = false) {
  const bg = pickRandom(themeElements.backgrounds);
  const text = pickRandom(themeElements.textColors);
  const accent = pickRandom(themeElements.accentColors);
  const titleFont = pickRandom(themeElements.titleFonts);
  const bodyFont = pickRandom(themeElements.bodyFonts);
  const titleSize = pickRandom(themeElements.titleSizes);
  const titleWeight = pickRandom(themeElements.titleWeights);
  const borderStyle = pickRandom(themeElements.borderStyles);

  // Ensure good contrast
  const isDarkBg = bg.startsWith('#0') || bg.startsWith('#1') || bg.startsWith('#2');
  const titleColor = isDarkBg ? (text.startsWith('#e') || text.startsWith('#d') || text.startsWith('#f') ? text : '#f5f5f5') : text;
  const bylineColor = accent;
  const excerptColor = text;
  const decorationColor = accent;
  const pageNumberColor = accent;

  return {
    name: `Generated ${Date.now()}`,
    background: bg,
    textColor: text,
    accentColor: accent,
    titleFont: titleFont,
    bodyFont: bodyFont,
    titleSize: titleSize,
    titleWeight: titleWeight,
    titleColor: titleColor,
    bylineColor: bylineColor,
    excerptColor: excerptColor,
    decorationColor: decorationColor,
    pageNumberColor: pageNumberColor,
    borderStyle: `${borderStyle} ${accent}`,
    // User preferences - preserve current values when shuffling, or use defaults
    fontSizeMultiplier: preserveSettings && currentTheme ? currentTheme.fontSizeMultiplier : 1.0,
    columnCount: preserveSettings && currentTheme ? currentTheme.columnCount : 4,
    lineHeight: preserveSettings && currentTheme ? currentTheme.lineHeight : 1.58,
    viewportWidthPercent: preserveSettings && currentTheme ? currentTheme.viewportWidthPercent : 1.0
  };
}

const magazineCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap');

  :root {
    --bg-color: #f9f9f9;
    --text-color: #000000;
    --accent-color: #2C5F6F;
    --title-font: 'Playfair Display', Georgia, serif;
    --body-font: 'Libre Caslon Text', Georgia, serif;
    --title-size: 2.8em;
    --title-weight: 700;
    --title-color: #2C5F6F;
    --byline-color: #666666;
    --excerpt-color: #555555;
    --decoration-color: #2C5F6F;
    --page-number-color: #2C5F6F;
    --border-style: 2px solid #e0e0e0;
  }

  #folio-reader-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--bg-color);
    overflow: hidden;
    z-index: 2147483647;
    display: flex;
    justify-content: center;
    transition: background 0.3s ease;
  }

  #folio-content-wrapper {
    position: relative;
    width: 100%;
    max-width: 100%;
    height: 100%;
    background: var(--bg-color);
    transition: background 0.3s ease;
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
    font-family: var(--body-font);
    color: var(--text-color);
    line-height: 1.58;
    font-size: 1.05em;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    transition: color 0.3s ease, font-family 0.3s ease;
  }

  .folio-page-number {
    position: absolute;
    bottom: 3px;
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--title-font);
    font-size: 0.85em;
    color: var(--page-number-color);
    font-weight: 400;
    letter-spacing: 0.05em;
    transition: color 0.3s ease, font-family 0.3s ease;
  }

  .folio-article-title {
    font-family: var(--title-font);
    font-size: var(--title-size);
    font-weight: var(--title-weight);
    line-height: 1.15;
    margin: 0 0 0.4em 0;
    color: var(--title-color);
    letter-spacing: -0.02em;
    text-align: center;
    column-span: all;
    break-after: avoid;
    transition: color 0.3s ease, font-family 0.3s ease, font-size 0.3s ease, font-weight 0.3s ease;
  }

  .folio-article-byline {
    font-size: 0.9em;
    color: var(--byline-color);
    font-style: italic;
    margin: 0 0 0.8em 0;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    text-align: center;
    column-span: all;
    break-after: avoid;
    transition: color 0.3s ease;
  }

  .folio-article-excerpt {
    font-size: 1.15em;
    line-height: 1.6;
    color: var(--excerpt-color);
    margin: 0 0 2em 0;
    font-weight: 400;
    font-style: italic;
    text-align: center;
    column-span: all;
    padding-bottom: 1em;
    border-bottom: var(--border-style);
    transition: color 0.3s ease, border-bottom 0.3s ease;
  }

  .folio-page-content p {
    margin: 0 0 1.2em 0;
    text-align: justify;
    hyphens: auto;
    orphans: 2;
    widows: 2;
  }

  .folio-page-content p.has-drop-cap {
    margin-top: 2em;
  }

  .folio-page-content p.has-drop-cap::first-letter {
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
    margin: 1.0em 0 0.6em 0;
    color: #1a1a1a;
    letter-spacing: -0.01em;
  }

  .folio-page-content h3 {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 1.25em;
    font-weight: 600;
    margin: 0.8em 0 0.5em 0;
    color: #1a1a1a;
    font-style: italic;
    letter-spacing: -0.005em;
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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    visibility: hidden;
    transition: background 0.3s ease, visibility 0s linear 0.3s;
  }

  .folio-lightbox.active {
    background: rgba(0, 0, 0, 0.95);
    visibility: visible;
    transition: background 0.3s ease, visibility 0s linear;
  }

  .folio-lightbox-main {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    width: 100%;
    cursor: default;
  }

  .folio-lightbox-img {
    max-width: 85%;
    max-height: 85vh;
    object-fit: contain;
    box-shadow: 0 0 50px rgba(0, 0, 0, 0.5);
    transform: scale(0.8);
    opacity: 0;
    transition: transform 0.3s ease, opacity 0.3s ease;
    cursor: default;
  }

  .folio-lightbox.active .folio-lightbox-img {
    transform: scale(1);
    opacity: 1;
  }

  .folio-lightbox-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: #ffffff;
    font-size: 32px;
    width: 50px;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s ease;
    user-select: none;
  }

  .folio-lightbox-nav:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .folio-lightbox-nav.prev {
    left: 20px;
  }

  .folio-lightbox-nav.next {
    right: 20px;
  }

  .folio-lightbox-nav:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .folio-lightbox-thumbnails {
    display: flex;
    gap: 10px;
    padding: 20px;
    max-width: 90%;
    overflow-x: auto;
    overflow-y: hidden;
    cursor: default;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.3s ease, transform 0.3s ease;
  }

  .folio-lightbox.active .folio-lightbox-thumbnails {
    opacity: 1;
    transform: translateY(0);
  }

  .folio-lightbox-thumbnails::-webkit-scrollbar {
    height: 6px;
  }

  .folio-lightbox-thumbnails::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
  }

  .folio-lightbox-thumbnails::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 3px;
  }

  .folio-lightbox-thumbnail {
    flex-shrink: 0;
    width: 80px;
    height: 80px;
    object-fit: cover;
    cursor: pointer;
    border: 2px solid transparent;
    transition: border-color 0.2s ease, opacity 0.2s ease;
    opacity: 0.6;
  }

  .folio-lightbox-thumbnail:hover {
    opacity: 1;
  }

  .folio-lightbox-thumbnail.active {
    border-color: #ffffff;
    opacity: 1;
  }

  .folio-lightbox-counter {
    position: absolute;
    top: 20px;
    right: 20px;
    color: #ffffff;
    background: rgba(0, 0, 0, 0.5);
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    font-family: monospace;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .folio-lightbox.active .folio-lightbox-counter {
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

  .folio-width-control {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .folio-width-label {
    font-family: 'Crimson Text', Georgia, serif;
    font-size: 12px;
    color: #000000;
    white-space: nowrap;
  }

  .folio-width-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100px;
    height: 4px;
    background: #e0e0e0;
    outline: none;
    border-radius: 2px;
  }

  .folio-width-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    background: #000000;
    cursor: pointer;
    border-radius: 0;
    transition: background 0.2s ease;
  }

  .folio-width-slider::-webkit-slider-thumb:hover {
    background: #333333;
  }

  .folio-width-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: #000000;
    cursor: pointer;
    border-radius: 0;
    border: none;
    transition: background 0.2s ease;
  }

  .folio-width-slider::-moz-range-thumb:hover {
    background: #333333;
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

    .folio-nav {
      gap: 15px;
    }

    .folio-nav-btn {
      padding: 6px 12px;
      min-width: 38px;
      font-size: 16px;
    }

    .folio-font-controls {
      gap: 6px;
    }

    .folio-font-btn, .folio-fullscreen-btn {
      padding: 5px 10px;
      min-width: 32px;
      font-size: 14px;
    }

    .folio-page-indicator {
      min-width: 85px;
      font-size: 12px;
    }

    .folio-close-btn {
      right: 15px;
      padding: 5px 10px;
      min-width: 32px;
      font-size: 16px;
    }
  }

  @media (max-width: 800px) {
    .folio-nav {
      gap: 10px;
      padding: 0 10px;
    }

    .folio-nav-btn {
      padding: 5px 10px;
      min-width: 32px;
      font-size: 15px;
    }

    .folio-font-controls {
      gap: 4px;
    }

    .folio-font-btn, .folio-fullscreen-btn {
      padding: 4px 8px;
      min-width: 28px;
      font-size: 13px;
    }

    .folio-page-indicator {
      min-width: 70px;
      font-size: 11px;
    }

    .folio-close-btn {
      right: 10px;
      padding: 4px 8px;
      min-width: 28px;
      font-size: 15px;
    }

    /* Hide line height controls on medium-small screens */
    .folio-font-controls.line-controls {
      display: none;
    }

    .folio-width-slider {
      width: 80px;
    }

    .folio-width-label {
      font-size: 11px;
    }
  }

  @media (max-width: 600px) {
    .folio-nav {
      gap: 8px;
      padding: 0 5px;
    }

    .folio-nav-btn {
      padding: 4px 8px;
      min-width: 28px;
      font-size: 14px;
    }

    .folio-font-controls {
      gap: 3px;
    }

    .folio-font-btn, .folio-fullscreen-btn {
      padding: 3px 6px;
      min-width: 24px;
      font-size: 12px;
    }

    .folio-page-indicator {
      min-width: 60px;
      font-size: 10px;
    }

    .folio-close-btn {
      right: 5px;
      padding: 3px 6px;
      min-width: 24px;
      font-size: 14px;
    }

    /* Hide column and line controls on small screens */
    .folio-font-controls.column-controls,
    .folio-font-controls.line-controls {
      display: none;
    }

    .folio-fullscreen-btn {
      display: none;
    }

    .folio-width-control {
      display: none;
    }
  }

  @media print {
    @page {
      size: letter;
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: var(--bg-color);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    #folio-reader-container {
      position: static;
      overflow: visible;
      background: var(--bg-color);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      min-height: 100vh;
    }

    #folio-content-wrapper {
      position: static;
      width: 100%;
      max-width: 100% !important;
      height: auto;
      background: var(--bg-color);
    }

    .folio-pages-wrapper {
      position: static;
      overflow: visible;
      height: auto;
      display: block;
      column-count: var(--print-columns, 2);
      column-gap: 30px;
      padding: 0.5in;
      box-sizing: border-box;
    }

    .folio-page {
      display: contents;
    }

    .folio-page-content {
      display: contents;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color: var(--text-color);
    }

    .folio-page-content > * {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .folio-article-title {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color: var(--title-color);
    }

    .folio-article-byline {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color: var(--byline-color);
    }

    .folio-article-excerpt {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color: var(--excerpt-color);
      border-bottom: var(--border-style);
    }

    .folio-page-number {
      display: none;
    }

    .folio-page-content blockquote {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      border-left: 2px solid var(--accent-color);
    }

    .folio-page-content img {
      max-width: 100%;
      page-break-inside: avoid;
      break-inside: avoid;
      cursor: default;
    }

    .folio-page-content h2,
    .folio-page-content h3 {
      page-break-after: avoid;
      break-after: avoid;
    }

    .folio-page-content p {
      orphans: 3;
      widows: 3;
    }

    /* Hide UI elements */
    .folio-nav,
    .folio-lightbox,
    .folio-lightbox-thumbnails {
      display: none !important;
    }
  }
`;

function pickRandomTheme() {
  // Preserve user settings when generating new theme
  currentTheme = generateRandomTheme(true);
  return currentTheme;
}

function applyTheme(theme) {
  const container = document.getElementById('folio-reader-container');
  if (!container) return;

  // Apply theme using CSS custom properties
  container.style.setProperty('--bg-color', theme.background);
  container.style.setProperty('--text-color', theme.textColor);
  container.style.setProperty('--accent-color', theme.accentColor);
  container.style.setProperty('--title-font', theme.titleFont);
  container.style.setProperty('--body-font', theme.bodyFont);
  container.style.setProperty('--title-size', theme.titleSize);
  container.style.setProperty('--title-weight', theme.titleWeight);
  container.style.setProperty('--title-color', theme.titleColor);
  container.style.setProperty('--byline-color', theme.bylineColor);
  container.style.setProperty('--excerpt-color', theme.excerptColor);
  container.style.setProperty('--decoration-color', theme.decorationColor);
  container.style.setProperty('--page-number-color', theme.pageNumberColor);
  container.style.setProperty('--border-style', theme.borderStyle);

  // Apply user preferences
  if (theme.fontSizeMultiplier !== undefined) {
    fontSizeMultiplier = theme.fontSizeMultiplier;
  }
  if (theme.columnCount !== undefined) {
    columnCount = theme.columnCount;
  }
  if (theme.lineHeight !== undefined) {
    lineHeight = theme.lineHeight;
  }
  if (theme.viewportWidthPercent !== undefined) {
    viewportWidthPercent = theme.viewportWidthPercent;
    const contentWrapper = document.getElementById('folio-content-wrapper');
    if (contentWrapper) {
      contentWrapper.style.maxWidth = `${viewportWidthPercent * 100}%`;
    }
  }

  currentTheme = theme;
  console.log(`Applied theme: ${theme.name}`);
}

function shuffleTheme() {
  const newTheme = pickRandomTheme();
  applyTheme(newTheme);
  saveTheme(newTheme);
}

function saveTheme(theme) {
  // Save theme to chrome storage
  chrome.storage.local.set({ folioTheme: theme }, () => {
    console.log('Theme saved to storage');
  });
}

function loadTheme(callback) {
  chrome.storage.local.get(['folioTheme'], (result) => {
    if (result.folioTheme) {
      console.log('Loaded saved theme from storage');
      callback(result.folioTheme);
    } else {
      console.log('No saved theme, generating new one');
      const newTheme = pickRandomTheme();
      saveTheme(newTheme);
      callback(newTheme);
    }
  });
}

// Helper function to split a paragraph across pages
function splitParagraph(paragraphEl, currentPageContent, tempMeasure, availableHeight, availableWidth) {
  const fullText = paragraphEl.innerHTML;
  const words = fullText.split(/(\s+)/); // Split on whitespace but keep the whitespace

  if (words.length <= 1) {
    // Can't split a single word
    return null;
  }

  // Binary search to find how many words fit
  let left = 0;
  let right = words.length;
  let bestFit = 0;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    const testText = words.slice(0, mid).join('');

    // Test if this amount of text fits
    const testP = document.createElement('p');
    if (paragraphEl.className) testP.className = paragraphEl.className;
    testP.innerHTML = testText;

    tempMeasure.innerHTML = currentPageContent + testP.outerHTML;

    const hasVerticalOverflow = tempMeasure.scrollHeight > availableHeight;
    const hasHorizontalOverflow = tempMeasure.scrollWidth > availableWidth;

    if (!hasVerticalOverflow && !hasHorizontalOverflow) {
      // This fits, try to fit more
      bestFit = mid;
      left = mid + 1;
    } else {
      // This doesn't fit, try less
      right = mid;
    }
  }

  // If we can't fit any words, return null
  if (bestFit === 0) {
    return null;
  }

  // Create the two parts
  const firstPartText = words.slice(0, bestFit).join('');
  const remainderText = words.slice(bestFit).join('');

  // Create the HTML for the first part
  const firstP = document.createElement('p');
  if (paragraphEl.className) firstP.className = paragraphEl.className;
  firstP.innerHTML = firstPartText;

  return {
    firstPart: firstP.outerHTML,
    remainder: remainderText
  };
}

function splitContentIntoPages(content, container) {
  const wrapper = container.querySelector('.folio-pages-wrapper');
  if (!wrapper) return [];

  // Create a temporary div to parse the content
  const contentParser = document.createElement('div');
  contentParser.innerHTML = content;
  const allElements = Array.from(contentParser.querySelectorAll('h1, h2, h3, p, blockquote, ul, ol, img, div.folio-article-byline, div.folio-article-excerpt'));

  // Filter out <p> elements that are inside <blockquote> to avoid duplicates
  const elements = allElements.filter(el => {
    if (el.tagName === 'P' && el.closest('blockquote')) {
      return false; // Skip paragraphs inside blockquotes
    }
    return true;
  });

  const pages = [];
  let elementIndex = 0;

  // Helper function to measure a page
  function measurePage() {
    const tempPage = document.createElement('div');
    tempPage.className = 'folio-page';
    tempPage.style.visibility = 'hidden';
    tempPage.style.position = 'absolute';
    tempPage.style.top = '0';
    tempPage.style.left = '0';
    tempPage.style.width = '100%';
    tempPage.style.height = '100%';

    const tempMeasure = document.createElement('div');
    tempMeasure.className = 'folio-page-content';
    tempMeasure.style.columnCount = columnCount;
    tempPage.appendChild(tempMeasure);
    wrapper.appendChild(tempPage);

    const availableHeight = tempMeasure.offsetHeight;
    const availableWidth = tempMeasure.offsetWidth;

    console.log(`Page ${pages.length + 1} dimensions:`, availableWidth, 'x', availableHeight);

    let currentPageContent = '';

    while (elementIndex < elements.length) {
      const el = elements[elementIndex];
      tempMeasure.innerHTML = currentPageContent + el.outerHTML;

      const hasVerticalOverflow = tempMeasure.scrollHeight > availableHeight;
      const hasHorizontalOverflow = tempMeasure.scrollWidth > availableWidth;

      if ((hasVerticalOverflow || hasHorizontalOverflow) && currentPageContent) {
        // Try to split paragraphs across pages
        if (el.tagName === 'P') {
          const splitResult = splitParagraph(el, currentPageContent, tempMeasure, availableHeight, availableWidth);
          if (splitResult) {
            // Add the part that fits to current page
            currentPageContent += splitResult.firstPart;
            // Insert the remainder back into elements array for next page
            const remainderP = document.createElement('p');
            remainderP.innerHTML = splitResult.remainder;
            // Copy any classes from original paragraph EXCEPT drop cap
            if (el.className) {
              const classes = el.className.split(' ').filter(c => c !== 'has-drop-cap');
              if (classes.length > 0) {
                remainderP.className = classes.join(' ');
              }
            }
            elements.splice(elementIndex, 1, remainderP);
            break;
          }
        }

        // Element doesn't fit and couldn't be split, leave it for next page
        break;
      } else {
        currentPageContent += el.outerHTML;
        elementIndex++;
      }
    }

    wrapper.removeChild(tempPage);
    return currentPageContent;
  }

  // Measure all pages with same layout
  while (elementIndex < elements.length) {
    const pageContent = measurePage();
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
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateLightbox(-1);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateLightbox(1);
      return;
    }
    // Don't handle other keys when lightbox is open
    return;
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

  // Update and save theme with new setting
  if (currentTheme) {
    currentTheme.fontSizeMultiplier = fontSizeMultiplier;
    saveTheme(currentTheme);
  }

  // Rebuild pages with new font size
  if (articleContent) {
    rebuildPages();
  }
}

function changeColumnCount(delta) {
  columnCount = Math.max(2, Math.min(6, columnCount + delta));

  // Update and save theme with new setting
  if (currentTheme) {
    currentTheme.columnCount = columnCount;
    saveTheme(currentTheme);
  }

  // Rebuild pages with new column count
  if (articleContent) {
    rebuildPages();
  }
}

function changeLineHeight(delta) {
  lineHeight = Math.max(1.3, Math.min(2.0, lineHeight + delta));

  // Update and save theme with new setting
  if (currentTheme) {
    currentTheme.lineHeight = lineHeight;
    saveTheme(currentTheme);
  }

  // Rebuild pages with new line height
  if (articleContent) {
    rebuildPages();
  }
}

function changeViewportWidth(percent) {
  viewportWidthPercent = Math.max(0.5, Math.min(1.0, percent));

  // Update the content wrapper width
  const contentWrapper = document.getElementById('folio-content-wrapper');
  if (contentWrapper) {
    contentWrapper.style.maxWidth = `${viewportWidthPercent * 100}%`;
  }

  // Update and save theme with new setting
  if (currentTheme) {
    currentTheme.viewportWidthPercent = viewportWidthPercent;
    saveTheme(currentTheme);
  }

  // Rebuild pages with new width
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

    const pageContentEl = document.createElement('div');
    pageContentEl.className = 'folio-page-content';
    pageContentEl.style.fontSize = `${1.05 * fontSizeMultiplier}em`;
    pageContentEl.style.columnGap = `${columnGap}px`;
    pageContentEl.style.lineHeight = lineHeight;
    pageContentEl.style.columnCount = columnCount;
    pageContentEl.innerHTML = pageContent;

    pageEl.appendChild(pageContentEl);

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

function showImageLightbox(index) {
  currentLightboxIndex = index;
  const lightbox = document.getElementById('folio-lightbox');
  const lightboxImg = document.getElementById('folio-lightbox-img');
  const prevBtn = document.getElementById('folio-lightbox-prev');
  const nextBtn = document.getElementById('folio-lightbox-next');
  const counter = document.getElementById('folio-lightbox-counter');

  if (lightbox && lightboxImg && allImages.length > 0) {
    lightboxImg.src = allImages[index];
    lightbox.classList.add('active');

    // Update counter
    if (counter) {
      counter.textContent = `${index + 1} / ${allImages.length}`;
    }

    // Update prev/next buttons
    if (prevBtn) {
      prevBtn.disabled = index === 0;
    }
    if (nextBtn) {
      nextBtn.disabled = index === allImages.length - 1;
    }

    // Update thumbnail highlights
    updateThumbnailHighlight(index);
  }
}

function closeLightbox() {
  const lightbox = document.getElementById('folio-lightbox');
  if (lightbox) {
    lightbox.classList.remove('active');
  }
}

function navigateLightbox(direction) {
  const newIndex = currentLightboxIndex + direction;
  if (newIndex >= 0 && newIndex < allImages.length) {
    showImageLightbox(newIndex);
  }
}

function updateThumbnailHighlight(index) {
  const thumbnails = document.querySelectorAll('.folio-lightbox-thumbnail');
  thumbnails.forEach((thumb, i) => {
    if (i === index) {
      thumb.classList.add('active');
      // Scroll thumbnail into view
      thumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } else {
      thumb.classList.remove('active');
    }
  });
}

function addImageClickHandlers() {
  const images = document.querySelectorAll('.folio-page-content img');
  allImages = Array.from(images).map(img => img.src);

  images.forEach((img, index) => {
    img.onclick = (e) => {
      e.stopPropagation();
      showImageLightbox(index);
    };
  });

  // Populate lightbox thumbnails
  const thumbnailsContainer = document.getElementById('folio-lightbox-thumbnails');
  if (thumbnailsContainer) {
    thumbnailsContainer.innerHTML = '';
    allImages.forEach((src, index) => {
      const thumbnail = document.createElement('img');
      thumbnail.src = src;
      thumbnail.className = 'folio-lightbox-thumbnail';
      thumbnail.onclick = (e) => {
        e.stopPropagation();
        showImageLightbox(index);
      };
      thumbnailsContainer.appendChild(thumbnail);
    });
  }
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

function exportToPDF() {
  if (!readerModeActive) return;

  const container = document.getElementById('folio-reader-container');
  if (!container) return;

  // Store current active page
  const previousPage = currentPage;

  // Calculate current column width to preserve it in print
  const pageContent = document.querySelector('.folio-page-content');
  if (pageContent) {
    const currentWidth = pageContent.offsetWidth;
    const gapSpace = (columnCount - 1) * columnGap;
    const columnWidth = (currentWidth - gapSpace) / columnCount;

    // Adjusted for wider screens to maintain ~3:4 ratio
    const printPageWidth = 1300;
    const printGapSpace = columnGap;

    // Calculate how many columns of this width fit on print page
    const printColumns = Math.max(1, Math.floor((printPageWidth + printGapSpace) / (columnWidth + printGapSpace)));

    console.log(`Column width: ${columnWidth.toFixed(0)}px, Print columns: ${printColumns}`);
    container.style.setProperty('--print-columns', printColumns);
  } else {
    // Fallback to 2 columns if we can't measure
    container.style.setProperty('--print-columns', 2);
  }

  // Make all pages visible for printing
  const allPages = document.querySelectorAll('.folio-page');
  allPages.forEach(page => {
    page.classList.add('active');
  });

  // Hide the navigation temporarily
  const nav = document.querySelector('.folio-nav');
  if (nav) {
    nav.style.display = 'none';
  }

  // Open print dialog
  window.print();

  // Restore state after print dialog closes
  // Note: There's no reliable cross-browser way to detect when print dialog closes,
  // but we can restore immediately as the print styles only apply during actual printing
  setTimeout(() => {
    // Restore only the previously active page
    allPages.forEach((page, index) => {
      if (index === previousPage) {
        page.classList.add('active');
      } else {
        page.classList.remove('active');
      }
    });

    // Show navigation again
    if (nav) {
      nav.style.display = '';
    }
  }, 100);
}

function activateReaderMode() {
  if (readerModeActive) return;

  originalContent = {
    html: document.body.innerHTML,
    overflow: document.body.style.overflow
  };

  // Before Readability strips classes, find paragraphs with drop caps
  const dropCapParagraphs = [];
  const originalDropCaps = document.querySelectorAll('p.has-drop-cap, p[class*="drop"], p[class*="Drop"]');
  originalDropCaps.forEach(p => {
    // Store first 100 chars of text to match later
    const text = p.textContent.trim().substring(0, 100);
    if (text) {
      dropCapParagraphs.push(text);
    }
  });

  const documentClone = document.cloneNode(true);
  const reader = new Readability(documentClone);
  const article = reader.parse();

  if (!article) {
    console.error('Folio Reader: Could not parse article');
    return;
  }

  // Truncate content at site-specific ending marks
  article.content = truncateAtEndingMark(article.content);

  // Reapply drop cap classes to matching paragraphs in the cleaned content
  if (dropCapParagraphs.length > 0) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = article.content;
    const allParagraphs = tempDiv.querySelectorAll('p');

    allParagraphs.forEach(p => {
      const pText = p.textContent.trim().substring(0, 100);
      if (dropCapParagraphs.includes(pText)) {
        p.classList.add('has-drop-cap');
      }
    });

    // Update article content with drop cap classes restored
    article.content = tempDiv.innerHTML;
  }

  const container = document.createElement('div');
  container.id = 'folio-reader-container';

  const styleElement = document.createElement('style');
  styleElement.textContent = magazineCSS;
  container.appendChild(styleElement);

  // Create content wrapper
  const contentWrapper = document.createElement('div');
  contentWrapper.id = 'folio-content-wrapper';
  contentWrapper.style.maxWidth = `${viewportWidthPercent * 100}%`;

  // Prepend title, byline, and excerpt to article content
  let headerHTML = '';
  if (article.title) {
    headerHTML += `<h1 class="folio-article-title">${article.title}</h1>`;
  }
  if (article.byline) {
    headerHTML += `<div class="folio-article-byline">${article.byline}</div>`;
  }
  if (article.excerpt) {
    headerHTML += `<div class="folio-article-excerpt">${article.excerpt}</div>`;
  }

  // Create pages wrapper
  const pagesWrapper = document.createElement('div');
  pagesWrapper.className = 'folio-pages-wrapper';
  contentWrapper.appendChild(pagesWrapper);

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
  columnControls.className = 'folio-font-controls column-controls';

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
  lineControls.className = 'folio-font-controls line-controls';

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

  const widthControl = document.createElement('div');
  widthControl.className = 'folio-width-control';

  const widthLabel = document.createElement('span');
  widthLabel.className = 'folio-width-label';
  widthLabel.textContent = 'Width';
  widthControl.appendChild(widthLabel);

  const widthSlider = document.createElement('input');
  widthSlider.type = 'range';
  widthSlider.className = 'folio-width-slider';
  widthSlider.min = '50';
  widthSlider.max = '100';
  widthSlider.value = '100';
  widthSlider.title = 'Adjust Viewing Width';
  widthSlider.oninput = (e) => changeViewportWidth(parseInt(e.target.value) / 100);
  widthControl.appendChild(widthSlider);

  nav.appendChild(widthControl);

  const printBtn = document.createElement('button');
  printBtn.id = 'folio-print-btn';
  printBtn.className = 'folio-fullscreen-btn';
  printBtn.textContent = '🖨';
  printBtn.title = 'Export to PDF';
  printBtn.onclick = exportToPDF;
  nav.appendChild(printBtn);

  const shuffleBtn = document.createElement('button');
  shuffleBtn.id = 'folio-shuffle-btn';
  shuffleBtn.className = 'folio-fullscreen-btn';
  shuffleBtn.textContent = '🎨';
  shuffleBtn.title = 'Shuffle Theme';
  shuffleBtn.onclick = shuffleTheme;
  nav.appendChild(shuffleBtn);

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

  // Append content wrapper to container
  container.appendChild(contentWrapper);

  // Append nav to container (not contentWrapper) so it stays full width
  container.appendChild(nav);

  // Create lightbox
  const lightbox = document.createElement('div');
  lightbox.id = 'folio-lightbox';
  lightbox.className = 'folio-lightbox';
  lightbox.onclick = closeLightbox;

  // Main image container
  const lightboxMain = document.createElement('div');
  lightboxMain.className = 'folio-lightbox-main';

  // Previous button
  const lightboxPrevBtn = document.createElement('button');
  lightboxPrevBtn.id = 'folio-lightbox-prev';
  lightboxPrevBtn.className = 'folio-lightbox-nav prev';
  lightboxPrevBtn.textContent = '‹';
  lightboxPrevBtn.onclick = (e) => {
    e.stopPropagation();
    navigateLightbox(-1);
  };
  lightboxMain.appendChild(lightboxPrevBtn);

  // Main image
  const lightboxImg = document.createElement('img');
  lightboxImg.id = 'folio-lightbox-img';
  lightboxImg.className = 'folio-lightbox-img';
  lightboxImg.onclick = (e) => e.stopPropagation();
  lightboxMain.appendChild(lightboxImg);

  // Next button
  const lightboxNextBtn = document.createElement('button');
  lightboxNextBtn.id = 'folio-lightbox-next';
  lightboxNextBtn.className = 'folio-lightbox-nav next';
  lightboxNextBtn.textContent = '›';
  lightboxNextBtn.onclick = (e) => {
    e.stopPropagation();
    navigateLightbox(1);
  };
  lightboxMain.appendChild(lightboxNextBtn);

  // Counter
  const lightboxCounter = document.createElement('div');
  lightboxCounter.id = 'folio-lightbox-counter';
  lightboxCounter.className = 'folio-lightbox-counter';
  lightboxMain.appendChild(lightboxCounter);

  lightbox.appendChild(lightboxMain);

  // Thumbnails container
  const thumbnails = document.createElement('div');
  thumbnails.id = 'folio-lightbox-thumbnails';
  thumbnails.className = 'folio-lightbox-thumbnails';
  thumbnails.onclick = (e) => e.stopPropagation();
  lightbox.appendChild(thumbnails);

  container.appendChild(lightbox);

  document.body.innerHTML = '';
  document.body.appendChild(container);
  document.body.style.overflow = 'hidden';

  // Load and apply saved theme (or generate new one if none exists)
  loadTheme((theme) => {
    applyTheme(theme);
  });

  readerModeActive = true;
  document.addEventListener('keydown', handleKeyPress);
  document.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('resize', handleResize);

  // Store article content with header prepended
  articleContent = headerHTML + article.content;

  // Split content into pages
  setTimeout(() => {
    pages = splitContentIntoPages(articleContent, container);
    totalPages = pages.length;

    // Create page elements
    pages.forEach((pageContent, index) => {
      const pageEl = document.createElement('div');
      pageEl.className = 'folio-page';

      const pageContentEl = document.createElement('div');
      pageContentEl.className = 'folio-page-content';
      pageContentEl.style.columnCount = columnCount;
      pageContentEl.innerHTML = pageContent;

      pageEl.appendChild(pageContentEl);

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
  viewportWidthPercent = 1.0;
  currentTheme = null;
  allImages = [];
  currentLightboxIndex = 0;
  lastThemeIndex = -1;
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
