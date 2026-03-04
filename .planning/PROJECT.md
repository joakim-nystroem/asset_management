# Asset Management System

## What This Is

An inventory management system built around a high-performance, Excel-like data grid. Users view, edit, sort, filter, and search asset data in a reactive grid with virtual scrolling, real-time multi-user presence, and a serial event queue for network operations. The system also includes admin panels and mobile views for audit workflows.

## Core Value

The grid must feel like a native spreadsheet — fast cell editing, keyboard navigation, multi-cell selection, copy/paste, and instant visual feedback for dirty state. Everything else serves this.

## Requirements

### Validated

<!-- Shipped and confirmed working in current codebase. -->

- ✓ Virtual-scrolled grid rendering with visible-row-only DOM — existing
- ✓ Cell selection (click, shift-click, keyboard arrows, shift-extend) with overlay rendering — existing
- ✓ Inline cell editing (textarea, constrained dropdowns, free-text autocomplete) — existing
- ✓ Dirty cell tracking via PendingContext with overlay indicators — existing
- ✓ Multi-cell copy/paste via clipboard API — existing
- ✓ Column sorting via HeaderMenu with SortContext — existing
- ✓ Column filtering via HeaderMenu + FilterPanel + QueryContext — existing
- ✓ Search via Toolbar → QueryContext — existing
- ✓ Context menu (edit, copy, paste, filter-by-value) — existing
- ✓ Column width management via ColumnWidthContext — existing
- ✓ View selector (Default, Audit, PED, Galaxy, Network) — existing
- ✓ Serial event queue (EventListener → eventQueue → eventHandler) — existing
- ✓ Commit/discard workflow (pending edits → API → clear) — existing
- ✓ Real-time WebSocket presence and cell locking — existing
- ✓ Session-based authentication with server hooks — existing
- ✓ Toast notification system — existing
- ✓ API layer for asset CRUD with change logging — existing
- ✓ Admin panel (locations, statuses, conditions, departments, audit management) — existing
- ✓ Mobile views (audit completion, asset management with barcode scanning) — existing

### Active

<!-- Current scope. Building toward these. -->

- [ ] Undo/redo system (HistoryContext populated, Ctrl+Z/Y forwarding, batch support for multi-cell ops)
- [ ] Cell validation (constraint checking on save, isValid flag in pending edits, invalid cell indicators)
- [ ] New row component set (NewRow manager, rows pushed into filteredAssets, same editing as existing rows)
- [ ] Custom scrollbar for virtual scroller (cross-browser consistent, styled, integrated with virtual scroll)
- [ ] Code cleanup (remove refactor bloat, dead code, unused helpers like startCellEdit())

### Out of Scope

<!-- Explicit boundaries. -->

- Admin panel refactor — deferred until main grid refactor complete
- Mobile page refactor — deferred until main grid refactor complete
- Test suite — important but separate initiative from the architecture refactor
- Pagination/lazy-loading — virtual scroll handles current dataset sizes
- Conflict resolution (CRDT/OT) — WebSocket locking sufficient for current user count

## Context

The application is mid-refactor on the `arch-rehaul` branch. The original codebase used singleton manager patterns (editManager, columnManager, sortManager, etc.) which have been replaced with a context-based architecture using Svelte 5's `createContext()`. All former controllers are eliminated — state lives in 12 typed contexts, logic lives in owning components.

The architecture rules are codified in `CLAUDE.md` at the project root. This is the source of truth for file responsibilities, context shapes, and design principles.

The refactor is 80-90% complete. The grid renders, edits, sorts, filters, copies, pastes, and commits. The remaining work (undo/redo, validation, new rows, custom scrollbar, cleanup) builds on a stable foundation.

## Constraints

- **Tech stack**: SvelteKit + Svelte 5 runes, Kysely ORM, MariaDB — no changes
- **Architecture**: Context-based state, component-owned logic, no controllers — per CLAUDE.md
- **No optimistic mutation**: `filteredAssets` stays clean during editing; pending edits render as overlays
- **Branch**: All work on `arch-rehaul` branch

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Contexts over controllers | Controllers mixed state + logic + context access; contexts separate concerns cleanly | ✓ Good |
| 12 typed contexts | Each context has a single responsibility; no god-context | ✓ Good |
| Panel system (uiCtx + onWindowClick) | Unified open/close pattern for all dropdowns and panels | ✓ Good |
| No optimistic mutation | Simplifies rollback (discard = clear pending), avoids data corruption edge cases | ✓ Good |
| Copy/paste in EditHandler | Single owner for clipboard operations, triggered via context flags | ✓ Good |
| Sort owned by HeaderMenu | Sort is a header action, not a grid-wide concern | ✓ Good |
| New rows as regular GridRows | Same editing path, no parallel logic — `NEW-N` string IDs distinguish from server rows | — Pending |
| Custom scrollbar | Browser defaults inconsistent and clash with virtual scroll UX | — Pending |

---
*Last updated: 2026-03-04 after project reinitialization*
