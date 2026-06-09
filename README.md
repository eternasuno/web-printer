# Web Printer

Merge all pages from a documentation site into a single HTML and invoke browser print/PDF export.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
2. Click the link below — the userscript extension will prompt to install:

[👉 Click to install Web Printer](https://github.com/OWNER/REPO/releases/latest/download/web-printer.user.js)

> Replace `OWNER/REPO` with the actual GitHub repository path.

## Usage

1. Visit any documentation site
2. Click the printer button in the bottom-right corner
3. Enter a CSS selector → select links → print

## Development

```bash
pnpm install       # Install dependencies
pnpm run dev       # Dev mode
pnpm run build     # Build
pnpm run test      # Run tests
pnpm run lint      # Lint
pnpm run typecheck # Type check
```

## Release

```bash
git tag v0.2.0
git push origin v0.2.0
```

Pushing a tag triggers GitHub Actions to build and create a Release. Users can then install via the link above.