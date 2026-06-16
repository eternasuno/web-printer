# Web Printer

Userscript that merges documentation pages into a single HTML for browser print/PDF export.

## Tech Stack

TypeScript 5.7, Vite 6 + vite-plugin-monkey, Vitest, @mozilla/readability, Tampermonkey/Violentmonkey, Biome

## Architecture

```
src/
├── core/
│   ├── entity.ts          # Type definitions
│   ├── port.ts            # Interface contracts
│   └── usecase.ts         # Business logic (link filtering, article extraction)
├── adapter/
│   ├── dom-finder.ts            # DOM link finder
│   ├── gm-fetcher.ts            # Page fetcher (GM_xmlhttpRequest)
│   └── readability-extractor.ts # Content extractor (Readability)
├── gateway/
│   ├── dialog.ts    # Dialog UI (selector input / link list / settings)
│   ├── menu.ts      # GM menu registration
│   ├── printer.ts   # HTML builder + print window
│   ├── progress.ts  # Mini progress bar + cancel + toast
│   ├── storage.ts   # GM_getValue/GM_setValue for custom CSS
│   ├── styles.ts    # CSS styles for UI components
│   └── main.ts      # Entry point (wires adapters, gateways, use cases)
└── readability.d.ts
```

## Flow

1. `init()` → inject styles, init default CSS storage, register GM menu commands
2. User clicks "Web Printer" → selector input dialog
3. Script discovers matching links, shows selectable list
4. User selects pages → progress bar → fetch → extract → build HTML → print window
5. "Web Printer Settings" → edit custom print CSS (persisted via GM storage)

## Conventions

- No callbacks; use async/await
- English only in code, comments, docs, UI text
- No emoji

## Skills

| Skill | When to load |
|-------|-------------|
| `clean-architecture` | Creating files, moving code between modules, adding ports/adapters |
| `clean-code` | Writing new functions/types, naming, deciding functional vs OOP |
| `coding-guidelines` | Editing existing code, refactoring, surgical changes |

## Commands

| Command | Description |
|---------|-------------|
| `pnpm run dev` | Vite dev mode |
| `pnpm run build` | Build `dist/web-printer.user.js` |
| `pnpm run test` | Run tests |
| `pnpm run typecheck` | tsc --noEmit |
| `pnpm run lint` | Biome check |