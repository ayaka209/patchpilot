# PatchPilot

[中文文档](./README.zh-CN.md)

![License](https://img.shields.io/github/license/ayaka209/patchpilot)
![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-blue)
![Vue 3](https://img.shields.io/badge/Vue-3-42b883)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)

PatchPilot is a professional Chrome MV3 extension designed for dynamic response override via URL pattern matching and custom user scripts. It provides a powerful way for developers to intercept and modify network traffic on the fly.

## 🚀 Features

- **Dynamic Interception**: Intercept and modify network responses using URL regex rules.
- **User Scripts**: Apply custom JavaScript logic to transform response content.
- **Dual-Engine Architecture**: Choose between Lite Mode for silent operation and Full Mode for complete coverage.
- **Multi-Resource Support**: Works with `fetch`, `XMLHttpRequest`, and dynamically inserted `<script>` or `<link>` tags.
- **I18n Support**: Full English and Chinese support with automatic browser locale detection.
- **Developer Friendly**: Built with modern tech stack and comprehensive testing (Vitest & Playwright).

## What It Does

PatchPilot allows developers and power users to intercept and modify network responses on the fly. By defining URL regex rules and providing custom JavaScript "user scripts," matching responses are passed through your logic before being delivered to the web page.

- Matching network responses are passed through user scripts before delivery to the page.
- **User Script Signature**: `function(content, url) { return modifiedContent; }`
- **Example Use Case**: Patching legacy JS files from `https://host.chanjet.com/tplus/UserFiles/tonggrid-*.js` to fix bugs or add features without server-side changes.

## 🏗️ Dual-Engine Architecture

PatchPilot operates with two distinct interception engines to balance performance and capability:

### Lite Mode (Default)
Uses MAIN world fetch/XHR override combined with a `MutationObserver`.
- **No debugging banner**: Operates silently within the page context.
- **Intercepts**: `fetch()`, `XMLHttpRequest`, and dynamically inserted `<script>` and `<link>` tags.
- **Limitation**: CANNOT intercept synchronous `<script src="...">` tags already present in the HTML when the page loads.

### Full Mode
Uses `chrome.debugger` (Chrome DevTools Protocol) and `Fetch.requestPaused`.
- **Shows Chrome debugging banner**: "PatchPilot is debugging this browser" (cannot be suppressed).
- **Intercepts**: ALL network requests, including synchronous `<script src>` tags.
- **Activation**: User must explicitly enable this mode in the extension settings.

## ⚠️ Known Limitations (CRITICAL)

### `<script src>` Race Condition (Lite Mode)
Content scripts cannot intercept synchronous script tags that are already present in the HTML when the page loads. By the time the MAIN world interception engine initializes, these scripts have already been fetched and executed by the browser. This is a fundamental browser limitation of Manifest V3, not a bug.

- **Workaround**: Switch to **Full Mode** (chrome.debugger) which intercepts at the network level before any script execution begins.
- **Why**: MV3 removed `webRequestBlocking`, and `declarativeNetRequest` cannot modify response bodies. MAIN world script injection happens after HTML parsing begins.

### Other Limitations
- **Timing Dependency**: Lite mode fetch/XHR interception depends on rules being loaded before page scripts fire.
- **Chrome Debugging Banner**: In Full Mode, the banner is a mandatory Chrome security feature and cannot be hidden.
- **Text-Based Only**: Only text-based resources (JS, CSS, HTML, JSON) can be modified. Binary data (images, fonts) is not supported.
- **Browser Support**: Chrome only (requires MV3 and CDP support).

## 🛠️ Installation (Development)

1. Clone the repository:
   ```bash
   git clone https://github.com/ayaka209/patchpilot.git
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Build the extension:
   ```bash
   pnpm build
   ```
4. Load the extension in Chrome:
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `.output/chrome-mv3/` directory.

## Development

- `pnpm dev` — Start development mode with hot reload.
- `pnpm build` — Create a production build.
- `pnpm test` — Run unit tests (59 tests).
- `pnpm test:e2e` — Run Playwright E2E tests (7 tests).

## Project Structure

- `entrypoints/background.ts` — Service worker (Orchestration & Full Mode)
- `entrypoints/content.ts` — Content script (ISOLATED world bridge)
- `entrypoints/injected.ts` — Interception engine (MAIN world / Lite Mode)
- `entrypoints/popup/` — Popup UI (Vue 3)
- `entrypoints/options/` — Options page (Vue 3)
- `utils/storage.ts` — Storage CRUD (chrome.storage.local)
- `utils/matcher.ts` — URL regex matching logic
- `utils/logger.ts` — Match logging (Ring buffer)
- `utils/debugger-engine.ts` — CDP Fetch engine (Full Mode)
- `utils/i18n.ts` — Internationalization utility
- `utils/types.ts` — TypeScript types
- `locales/en.json` — English translations
- `locales/zh-CN.json` — Chinese translations
- `components/` — Vue components
- `components/LanguageSwitcher.vue` — I18n toggle component
- `composables/` — Vue composables

## User Script Examples

### 1. Simple String Replacement
```javascript
function(content, url) {
  return content.replace('oldValue', 'newValue');
}
```

### 2. JSON Response Modification
```javascript
function(content, url) {
  const data = JSON.parse(content);
  data.patchpilot = "modified";
  return JSON.stringify(data);
}
```

### 3. CSS Injection/Override
```javascript
function(content, url) {
  return content + "\nbody { background-color: #f0f0f0 !important; }";
}
```

## Tech Stack

- **WXT 0.20.x**: Vite-based web extension framework.
- **Vue 3**: Composition API for reactive UI.
- **TypeScript**: Type safety across the project.
- **Vitest**: Unit testing framework.
- **Playwright**: E2E testing framework.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'Add some amazing feature'`).
4. Run tests to ensure everything is working (`pnpm test` and `pnpm test:e2e`).
5. Push to the branch (`git push origin feature/amazing-feature`).
6. Open a Pull Request.

## Author

**ayaka209**
- GitHub: [@ayaka209](https://github.com/ayaka209)

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
