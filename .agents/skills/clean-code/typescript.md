# TypeScript Code Conventions

## Arrow Functions

All functions use arrow syntax:

```ts
const fn = (param: Type): ReturnType => { ... }
```

## Single Parameter

Every function takes exactly one parameter:
- Logically related inputs → group into a Record parameter type (`XxxParams`)
- Independent dependencies → inject via currying

```ts
// Logically related → Record
const parseConfig = ({ url, base }: ParseConfigParams): string => { ... }

// Independent → currying
const fetchUser = (id: string) => (deps: FetchUserDeps) => ...;
```

## Pure Functions

Prefer pure functions. When side effects are unavoidable, inject dependencies via currying:

```ts
const fn = (mainArg) => (deps: { /* side-effecty things */ }) => result;
```

A pure function is called with the main argument only. The injected deps are only needed in tests or special environments.

## Naming

| Category | Convention | Example |
|----------|-----------|---------|
| Functions | camelCase | `fetchUser`, `parseConfig` |
| Types | PascalCase | `User`, `FetchUserDeps` |
| Record parameters | `XxxParams` | `ParseConfigParams`, `BuildQueryParams` |
| Dependency types | `XxxDeps` | `FetchUserDeps` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |

## Function Signatures

```ts
// Single-param Record (logically grouped inputs)
export const parseConfig = ({ url, base }: ParseConfigParams): string => { ... };
export const buildQuery = ({ items }: BuildQueryParams): string => { ... };

// Curried with dependency injection
export const fetchUser = (id: string) =>
  async (deps: FetchUserDeps): Promise<User | null> => { ... };

// Single simple parameter (no Record needed)
export const escapeText = (text: string): string => { ... };

// No parameters
export const openDialog = (): void => { ... };
```

## Functional over OOP

Prefer functional programming; avoid OOP constructs:

- **Use `type` instead of `interface`** — `type X = { ... }` not `interface X { ... }`
- **No `class`** — use plain functions, closures, and currying instead
- **No `this`** — use explicit parameters or closures for state

```ts
// ✅ Functional
type FetcherDeps = { fetchPage: (url: string) => Promise<string> };
const createFetcher = (deps: FetcherDeps) => ({
  fetchAll: (urls: string[]) => Promise.all(urls.map(deps.fetchPage)),
});

// ❌ OOP
interface FetcherDeps { fetchPage: (url: string) => Promise<string> }
class Fetcher {
  constructor(private deps: FetcherDeps) {}
  async fetchAll(urls: string[]) { ... }
}
```

## Imports

Group and sort imports by type, then alphabetically:

```ts
import type { ... } from './types';
import { defaultDeps, fetchUser } from './fetcher';
import { createPanel, setStatus } from './panel';
```

- Type-only imports use `import type`
- Built-in/bundled deps before internal modules
- Internal modules sorted by path alphabetically

## Testing

- Test files mirror source directory structure
- Mock external dependencies via the curried injection pattern
