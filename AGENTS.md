# AGENTS.md

## Overview

Web Printer is a Tampermonkey userscript that discovers same-origin documentation links, extracts selected pages with Readability, sanitizes their content, and combines them into a print-friendly document.

## Sources of truth

- Domain types: `src/entity.ts`
- Effect service contracts: `src/port.ts`
- Business flows: `src/usecase/`
- External integrations: `src/adapter/`
- UI and popup lifecycle: `src/presentation/`
- Production composition: `src/main.ts`
- Tests and fixtures: `test/`
- Commands and dependencies: `package.json`
- TypeScript constraints: `tsconfig.json`
- Lint and formatting constraints: `biome.json`
- Userscript metadata and bundling: `vite.config.ts`
- CI and release behavior: `.github/workflows/`

Read the relevant implementation and tests before changing behavior. Validate changes with `pnpm run verify` and `pnpm run build`.
