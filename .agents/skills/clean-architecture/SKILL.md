---
name: clean-architecture
description: Architecture guidelines for project structure. Use when designing new features, reviewing code, determining layer boundaries, creating new files, or moving code between modules. Always load this skill before adding new source or test files to ensure correct layer placement and dependency direction.
---

# Clean Architecture

## Dependency Rule

**Dependencies point inward.** Inner layers never import from outer layers.

```
Gateway ─depends on─▶ Usecase ─depends on─▶ Port ─depends on─▶ Entity
    │                                        ▲
    │                                        │ implements
    └──depends on──▶ Adapter ────────────────┘
                        │
                        └──depends on──▶ Infrastructure
```

## Layers

### Entity
Innermost layer. Anemic data models and value objects.

- Pure data structures, no behavior
- Zero external dependencies
- May contain type definitions, enums, constants

### Port
Interface contracts that define capabilities required by use cases.

- Interfaces / contracts only, no implementation
- Name by capability, not technology (e.g. `Repository`, `HttpClient`)
- A single Port can have multiple Adapter implementations

### Usecase
**All business logic lives here.**

- IO operations go through Ports; use cases themselves are pure
- Pure logic (computation, validation, orchestration) is written directly in the use case
- **Must be thoroughly tested** (see Testing section below)
- One use case typically corresponds to one business operation

### Adapter
Concrete implementations of Port interfaces.

- One Port may have multiple Adapters (e.g. MockAdapter, ProductionAdapter)
- Depends on Port (implements the contract) and Infrastructure (uses technical capabilities)
- Only does "adaptation" work — no business logic
- Translates Port contracts into concrete technology implementations

### Infrastructure
Framework initialization, connection management, configuration.

- Database connections, queue setup, external SDK configuration
- Provides underlying capabilities for Adapters

### Gateway
External-facing entry points. Optional layer.

- Web API, message listeners, CLI commands — any external boundary
- Depends on Usecase (calls business logic) and Adapter (uses implementations)
- Contains no business decisions

## Simplified Architecture

When the project or module is small, simplify to two layers:

```
core/     — Entity + Port + Usecase (inner three layers combined)
adapter/  — All Adapter + Infrastructure implementations
```

Use when: ≤3 use cases, single implementation per port, no complex layering needed.

## Monorepo Splitting

As a project grows, split along boundaries into multiple packages:

| Package type | Role | Can depend on |
|-------------|------|---------------|
| `core` | All inner layers (Entity/Port/Usecase) | Nothing |
| `web` / `api` / `cli` | Gateway layer | `core` |
| `infra-*` | Infrastructure / Adapter layer | `core` |

Rules:
- **`core` must always maintain clean architecture** — no external package dependencies
- Other packages are treated as Infrastructure or Gateway layers
- Dependency direction is always outer-to-inner
- Each package has a clear responsibility boundary; avoid circular dependencies

## Testing

### Usecase Testing (Required)

Every Usecase must have a corresponding test.

**Approach**: Integration-style tests using Mock Adapters.

**Coverage requirements**:
- Happy path
- Error / edge cases (invalid input, service unavailable, duplicate operations, insufficient permissions, etc.)
- Idempotency where applicable

### Mock Pattern

Each Port provides a Mock implementation for testing:

- Implements the Port contract with deterministic, configurable behavior
- Supports injecting success / failure scenarios
- Test data is separated from business logic

## Directory Convention

Test directory mirrors source directory — every test file sits alongside the module it tests, at the same relative path.

```
src/
  entity/           data models
  port/             interfaces
  usecase/          business logic
  adapter/<port>/   interface implementations
  infrastructure/   framework bootstrap
  gateway/          external entry points (optional)
test/
  entity/           ← mirrors src/entity/
  port/             ← mirrors src/port/
  usecase/          ← mirrors src/usecase/
  adapter/<port>/   ← mirrors src/adapter/<port>/
  infrastructure/   ← mirrors src/infrastructure/
  gateway/          ← mirrors src/gateway/
```

**Naming rule**: `src/<layer>/<module>.ts` → `test/<layer>/<module>.test.ts`

When using simplified architecture (`core/` + `adapter/`), the test layout simplifies accordingly: `src/core/` → `test/core/`, `src/adapter/` → `test/adapter/`.

## Review Checklist

- [ ] Dependencies point inward (inner layer never imports outer)
- [ ] Usecase contains no IO — all side effects go through Ports
- [ ] Usecase has corresponding tests using Mock Adapters
- [ ] Adapter only implements the Port contract, contains no business logic
- [ ] Infrastructure is for bootstrap/connection only, no business rules
- [ ] Entity is a plain data structure with no framework / infrastructure dependency
- [ ] When using simplified architecture, is the layer boundary clearly defined?
- [ ] Test files mirror source directory structure (`src/<layer>/<module>.ts` → `test/<layer>/<module>.test.ts`)

## Reminders

- **Keep Entity lean**: behavior belongs in Usecases, Entity stays anemic
- **Keep Ports coarse-grained**: each Port represents a set of related capabilities; avoid one-method-one-Port
- **Keep Usecases focused**: one responsibility per use case; complex flows can be split into multiple use cases
- **Keep Adapters honest**: don't sneak business rules or logic into Adapters
- **Test first**: Usecase tests are the safety net for all refactoring
