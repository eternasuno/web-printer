# Web Printer

Web Printer is a personal Tampermonkey userscript that discovers same-origin links on the current page, lets you select pages, extracts their readable content, and combines it into a print-friendly document.

[Install the latest userscript](https://github.com/eternasuno/web-printer/releases/latest/download/web-printer.user.js) · [View releases](https://github.com/eternasuno/web-printer/releases)

## Usage

1. Open a documentation index page.
2. Run **Web Printer** from the Tampermonkey menu.
3. Select the pages to include, then click **Start**.
4. Allow the site to open a popup window.
5. Review the generated document and click **Print** to print it or save it as PDF.

The userscript matches HTTP and HTTPS pages, but does not scan the DOM, send requests, or display controls until invoked from the Tampermonkey menu. It is intended for publicly accessible pages and does not bypass authentication, paywalls, or access controls.

## Behavior

### Link discovery

- Keeps same-origin HTTP and HTTPS links.
- Excludes fragment-only links, invalid URLs, and common document, image, media, font, archive, and executable file types.
- Removes fragments and common tracking parameters such as `utm_*`, `ref`, `source`, `campaign`, `fbclid`, and `gclid`.
- Deduplicates normalized URLs while preserving their first occurrence and DOM order.
- Derives labels from link text, `aria-label`, child image `alt`, pathname, or the full URL.
- Shows a notification instead of an empty dialog when no candidates are found.

The selection dialog starts empty and supports individual selection, selecting all, and inverting the selection. Output always follows the original DOM order.

### Collection

- Uses `GM_xmlhttpRequest` with a concurrency limit of 4 and a 10-second timeout per page.
- Does not retry failed requests.
- Rejects non-2xx responses and explicit non-HTML content types, while attempting to parse responses without a `Content-Type` header.
- Extracts content with `@mozilla/readability` and sanitizes it with DOMPurify.
- Removes inline styles and blocks `iframe`, `object`, `embed`, `script`, and `style` elements.
- Isolates page failures so one failure does not stop the batch.
- Aborts the task and in-flight requests when cancelled or when the preview window closes. Cancelled tasks do not render partial output.

Relative links and images rely on Readability's URL conversion. Lazy-loading attributes receive no additional compatibility handling.

### Preview and printing

- Renders each successful page as a separate article and starts every article after the first on a new page.
- Shows a success/failure summary and failure details.
- Provides **Print** and **Close** controls without opening the print dialog automatically.
- Hides controls when printing and includes styles for text, code blocks, tables, images, and page breaks.
- Does not currently add a separate source link to successful articles.

## Scope

Web Printer does not provide:

- Recursive crawling, sitemap imports, or cross-origin crawling
- XPath/CSS selector input or site-specific adapters
- Extractors other than Readability
- Search, filtering, grouping, drag-and-drop ordering, or saved selections
- Request retries or configurable concurrency, timeouts, and headers
- Source-site styles, fonts, interactions, or configurable print CSS
- Image downloads, offline bundles, built-in PDF generation, or HTML downloads
- Internal-link remapping in the combined document

## Development

Requirements: Node.js 24 and [pnpm](https://pnpm.io/) 11. The repository also includes devenv and direnv configuration.

```sh
pnpm install
pnpm run build
```

Available commands:

```sh
pnpm run dev        # Build once, then start Vite preview; no watch/HMR
pnpm run test       # Run tests
pnpm run test:watch # Run tests in watch mode
pnpm run lint       # Run Biome checks
pnpm run typecheck  # Run TypeScript checks
pnpm run verify     # Run lint, typecheck, and tests
```

Build output is written to `dist/`. Pushing a `v*` tag triggers the release workflow, which verifies that the tag matches the version in `package.json`, runs all checks, builds `web-printer.user.js`, and attaches it to a GitHub Release.

## Architecture

```text
src/
├── entity.ts
├── port.ts
├── usecase/       # Discovery, selection, and collection
├── adapter/       # GM requests, HTML parsing, Readability, DOMPurify
├── presentation/  # Selection dialog, preview window, toast
└── main.ts        # Userscript entry point and dependency composition
```

Effect manages dependencies and cancellation. Tests mirror the `usecase`, `adapter`, and `presentation` layers.

## Compatibility

The primary validation target is the latest Firefox with Tampermonkey. Solid 2 and Effect v4 documentation are the initial manual test sites. Chrome and Safari remain compatibility targets until validated separately.

Before a release, manually verify candidate discovery and selection, popup blocking, batch ordering, isolated failures, cancellation and window closing, content and resource rendering, pagination, and browser print output.
