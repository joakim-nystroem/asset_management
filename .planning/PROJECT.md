# Project: Collaborative Inventory Grid — Architecture Rehaul

## Overview

A comprehensive architectural rehaul of the existing SvelteKit asset management system to align with the "To-Be Architecture" specification. The current system is a functional but tightly-coupled monolith centered around a 1200+ line `+page.svelte` file using module-level singletons. The goal is to refactor it into a strictly decoupled, context-driven, component-autonomous architecture.

## Problem Statement

The current architecture has several structural issues that limit scalability, testability, and collaborative development:

1. **Module-level singletons** — All managers (`editManager`, `selectionManager`, `columnManager`, etc.) are module-level singletons, making them impossible to scope, test in isolation, or have multiple instances
2. **Monolithic page component** — `+page.svelte` (~1200 lines) orchestrates all state, data fetching, event handling, and UI rendering
3. **Prop drilling risk** — Components receive too much from the page and import singletons directly
4. **Inline editor in GridRow** — The textarea editor lives inside each cell, not as a floating component
5. **Client-side filtering** — `searchManager.getFilterItems()` does client-side array filtering instead of DB queries
6. **No WebSocket delta sync** — Commits don't broadcast specific cell changes; clients need full refetch
7. **Tightly-coupled grid components** — `GridRow` and `GridOverlays` import singletons directly

## Target Architecture

Based on the "To-Be Architecture: Collaborative Inventory Grid" specification:

- **Svelte 5 Context** (`createContext`) for inter-component communication — no prop drilling, no singletons
- **InventoryGrid** as the main autonomous component owning all grid state locally
- **FloatingEditor** positioned absolutely via context coordinates — outside grid DOM hierarchy
- **GridContainer** rendering only visible rows, ignorant of editors/menus
- **ContextMenu** as independent command dispatcher
- **DB-side filtering** via Kysely — no client-side array processing
- **Spatial clipboard** with 0,0-indexed mini-grid and marching ants overlay
- **Session undo/redo** with local history stack (Yellow=Invalid, Green=Valid draft cells)
- **WebSocket delta sync** — broadcast only changed cells on commit

## Tech Stack

- SvelteKit 2.43.2 + Svelte 5.49.1 (runes: $state, $derived, $effect, createContext)
- Kysely 0.28.8 + MariaDB (host: 10.236.133.207, port: 3101, db: asset_db)
- Go WebSocket server (port 8080) for real-time presence + delta sync
- Tailwind CSS v4 + Vite 7
- TypeScript strict mode

## Constraints

- **Zero regressions** — All existing functionality must continue working throughout refactor
- **Incremental migration** — Each phase must leave the app in a working state
- **No DB schema changes** — Architecture rehaul is frontend/state management only
- **Preserve WebSocket protocol** — Go server message types unchanged; only add new ones
- **svelte-check must pass** after each phase

## Success Criteria

- [ ] All managers scoped via Svelte 5 context (no module singletons in grid path)
- [ ] `+page.svelte` reduced to thin route shell (< 100 lines)
- [ ] `FloatingEditor` is a standalone autonomous component
- [ ] `GridContainer` has zero knowledge of editors, menus, or clipboard
- [ ] Filters/search execute Kysely queries server-side
- [ ] WebSocket broadcasts delta changes on commit
- [ ] Full undo/redo with session history stack
- [ ] `svelte-check` passes with no new errors
