# Web Printer

Tampermonkey/Violentmonkey userscript that merges selected documentation pages into a single HTML page for browser print or PDF export.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. [Click to install Web Printer](https://github.com/eternasuno/web-printer/releases/latest/download/web-printer.user.js)

## Usage

1. Visit any documentation site
2. Open Tampermonkey menu → click **Web Printer**
3. Enter a CSS selector (e.g. `nav a`) to discover page links
4. Select the links you want → click **Print Selected**
5. Pages are fetched, content-extracted via Mozilla Readability, merged into a single HTML, and opened in a new window for printing/saving as PDF

A **Web Printer Settings** menu item lets you edit the custom print CSS (stored via `GM_setValue`).

## Development

```bash
pnpm install       # Install dependencies
pnpm run dev       # Build + preview
pnpm run build     # Build dist/web-printer.user.js
pnpm run test      # Run tests
pnpm run lint      # Biome check
pnpm run typecheck # TypeScript check
```

## Release

```bash
git tag v0.1.0
git push origin v0.1.0
```

Pushing a tag triggers GitHub Actions to build and create a Release with `dist/web-printer.user.js` attached.
