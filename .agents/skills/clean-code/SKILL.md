---
name: clean-code
description: Code conventions for consistency in formatting, naming, and structure. Use when writing or reviewing code, creating new functions or types, naming variables, or deciding between functional vs OOP patterns. Always load this skill before writing new code to ensure naming, signatures, and style match project conventions.
---

# Code Conventions

General code conventions that apply across all languages.

## Core Principles

### Single Parameter

Every function takes exactly one parameter:
- Logically related inputs → group into a single record/struct parameter
- Independent dependencies → inject via currying

### Pure Functions

Prefer pure functions — deterministic, no side effects, no external dependencies.
When side effects are unavoidable, inject dependencies via currying so the core logic remains testable.

### Function & File Size

- **Function ≤ 20 lines** — if longer, split into smaller functions
- **File ≤ 150 lines** — if larger, split into multiple focused files
- Prefer clarity over arbitrary splitting — a naturally cohesive function is better than two awkwardly divided ones

## Language-Specific Conventions

- [TypeScript](./typescript.md)
