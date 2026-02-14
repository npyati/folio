# Folio

Transform any web article into a beautiful, magazine-style reading experience — right in your browser.

Folio is a Chrome extension that strips away clutter and reflows content into elegant paginated columns with customizable typography, themes, and reading modes.

## Installation

1. **Download** — Click the green **Code** button on this page, then **Download ZIP**. Unzip the folder somewhere on your computer.

2. **Open Chrome Extensions** — Go to `chrome://extensions` in your address bar.

3. **Enable Developer Mode** — Toggle the **Developer mode** switch in the top-right corner.

4. **Load the extension** — Click **Load unpacked** and select the unzipped `folio` folder.

5. **Pin it** — Click the puzzle piece icon in Chrome's toolbar, then pin **folio** for quick access.

> To update, download the latest ZIP, replace the old folder, and click the refresh icon on the Folio card at `chrome://extensions`.

## Usage

**Activate reader mode** on any article page using one of these methods:
- Click the Folio icon in the toolbar
- Press `Alt+Shift+R`

Once in reader mode, the article is extracted, cleaned, and presented in a paginated multi-column layout.

## Features

### Reader Mode

- Extracts article content using Mozilla Readability
- Paginated multi-column layout (responsive: 1–4 columns based on screen width)
- Drop caps on opening paragraphs
- Justified text with automatic hyphenation
- Clean typography with serif fonts

**Page Navigation:**

| Key | Action |
|-----|--------|
| `→` / `Page Down` / `Space` | Next page |
| `←` / `Page Up` | Previous page |
| `Home` | First page |
| `End` | Last page |
| `Escape` | Exit reader mode |

### Themes

- **Shuffle** — randomly generates a new theme combining colors, fonts, and styles
- **Light / Dark toggle** — switch between modes with one click
- Light and dark themes are saved separately and persist across sessions
- Magazine-quality font pairings (Playfair Display, Georgia, Libre Caslon Text, and more)

### Typography Controls

All accessible from the bottom navigation bar:

- **Font size** — increase/decrease (0.7x–1.5x), also adjustable via pinch-to-zoom on trackpad
- **Column count** — 2 to 6 columns
- **Line height** — 1.3 to 2.0
- **Width** — adjust viewport width percentage

### Fullscreen Mode

- Click the fullscreen button or press `Alt+Shift+F`
- Auto-hides cursor after 2 seconds of inactivity
- Exit with `Escape`

### Speed Reading (RSVP)

Rapid Serial Visual Presentation — displays one word at a time with an optimal recognition point highlighted.

**Activate:** Right-click selected text > **Speed read from here**

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `↑` / `↓` | Adjust speed (100–800 WPM) |
| `←` / `→` | Seek backward/forward 10 words |
| `Escape` | Close |

Includes a context preview, progress bar, word counter, and time remaining estimate.

### Image Lightbox

Click any image in reader mode to open a fullscreen lightbox with thumbnail gallery and arrow key navigation.

### Article Collection

Save articles to a personal reading list accessible from the side panel or new tab page.

**Open the side panel:** Right-click the Folio icon in the toolbar and select **View Collection**. To keep it pinned as a sidebar, click the pin icon at the top of the side panel.

**Add articles:**
- `Alt+Shift+M`
- Right-click extension icon > **Add to Collection**
- Right-click any link > **Add to Collection**

**Manage collection:**
- Drag-and-drop to reorder
- Click a title to open (optionally in reader mode)
- Remove individual articles

### Export

Export your collection in three formats:

| Format | Description |
|--------|-------------|
| **PDF** | Preserves magazine styling and multi-column layout |
| **EPUB** | Standard e-reader format with images and styling |
| **.folio** | Plain text URL list — easy to share and version control |

### Import

Drag and drop a `.folio` file onto the collection panel to batch-import articles.

### Auto-Open Reader Mode

Configure specific domains to automatically activate reader mode. Folio uses smart detection to distinguish articles from homepages and listing pages.

Manage your auto-open domain list in the settings panel.

### New Tab Page

Optionally replace Chrome's new tab page with your Folio collection. Supports light, dark, and system themes. Toggle this in settings.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Shift+R` | Toggle reader mode |
| `Alt+Shift+M` | Add page to collection |
| `Alt+Shift+F` | Toggle fullscreen (in reader) |

These can be customized at `chrome://extensions/shortcuts`.

## Built With

- [Mozilla Readability](https://github.com/mozilla/readability) — article extraction
- [JSZip](https://stuk.github.io/jszip/) — EPUB generation
