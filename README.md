# Folio Reader

A Chrome extension that transforms web pages into beautifully formatted, magazine-style reading experiences.

## Features

- **Content Extraction**: Uses Mozilla's Readability library to extract main article content, removing ads and clutter
- **Viewport-Based Pagination**: Magazine-style pages that fit your screen - read columns within the viewport, then flip to the next page
- **Magazine-Style Layout**: Premium typography with multi-column layout (3 columns on desktop, 2 on tablet, 1 on mobile)
- **Smooth Page Navigation**: Navigate with buttons or keyboard shortcuts (arrow keys, space, page up/down)
- **One-Click Toggle**: Simple browser action button to activate/deactivate reader mode
- **Beautiful Typography**: Playfair Display for headings, Georgia for body text
- **Drop Caps**: Classic magazine-style drop caps on first paragraphs
- **Page Indicators**: Always know where you are in the article

## Installation

1. **Build the extension**:
   ```bash
   npm install
   npm run build
   ```

2. **Load in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select this project folder

3. **Use the extension**:
   - Navigate to any article or blog post
   - Click the Folio Reader icon in your toolbar
   - Read within the viewport, navigate pages with arrow keys or buttons
   - Press Escape or click the × button to exit reader mode

## Navigation

**Keyboard Shortcuts:**
- `→` or `Space` or `Page Down` - Next page
- `←` or `Page Up` - Previous page
- `Home` - First page
- `End` - Last page
- `Escape` - Exit reader mode

**Mouse:**
- Click "Previous" or "Next" buttons at the bottom
- Click the × button (top right) to exit

## Development

- **Build once**: `npm run build`
- **Watch mode**: `npm run watch` (rebuilds automatically on file changes)

## Project Structure

```
folio/
├── src/
│   └── content.js          # Main content script with Readability integration
├── dist/
│   └── content.js          # Bundled output (generated)
├── icons/
│   └── border-48.png       # Extension icon
├── background.js           # Service worker for browser action
├── manifest.json           # Extension manifest (V3)
└── package.json           # Dependencies and build scripts
```

## Customization

You can customize the magazine styling by editing the `magazineCSS` constant in [src/content.js](src/content.js). The CSS includes:

- Typography (fonts, sizes, line heights)
- Layout (column count, gaps, margins)
- Colors and spacing
- Responsive breakpoints

## Technologies

- Chrome Extension Manifest V3
- @mozilla/readability for content extraction
- esbuild for bundling
- Vanilla JavaScript (no framework)

## License

ISC
