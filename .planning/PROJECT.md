# GridOverlays Decomposition — Asset Management Refactor

## What This Is

A focused architectural refactor of the Asset Management grid's interaction layer. GridOverlays.svelte has become a god component — intercepting all keyboard and mouse events, reverse-engineering cell identity via DOM crawling, managing selection/resize/context-menu state, and rendering four overlay layers. This refactor distributes event ownership to source components, introduces a cell-based selection model, and extracts keyboard handling to pure TypeScript — leaving GridOverlays as a purely visual overlay renderer.

## Core Value

Events belong to their source. Each cell, header, and button owns its interactions and knows its own data (row, col, value) without DOM inspection.

## Requirements

### Validated

- Event queue pipeline (EventListener → eventQueue → eventHandler) — existing, proven for commits/creates/discards/queries
- Data immutability — filteredAssets/baseAssets are never mutated during editing, pending changes rendered as overlays
- Context signal pattern — components write to shared context, EventListener picks up changes via $effect

### Active

- [ ] Decompose GridOverlays from god component to purely visual overlay renderer (selection borders, copy borders, dirty cell indicators, other-user cursors)
- [ ] Implement cell-based selection model — cells report {row, col, value} into a selection set, selection border derives from min/max bounds
- [ ] Per-cell interactive elements in GridRow — each cell owns its click handler and knows its own data without DOM crawling (no data-row/data-col attributes)
- [ ] Extract keyboard handling to pure TypeScript (keyboardHandler.ts) — arrow navigation, escape, F2, copy/paste signals. No DOM dependencies.
- [ ] Wire keyboard handler into the event system — investigate svelte:window viability vs alternative approaches
- [ ] Remove all DOM crawling (closest('[data-row]'), dataset lookups) from interaction paths
- [ ] Maintain all existing grid functionality through the refactor (edit, sort, filter, context menu, header menu, resize)

### Out of Scope

- Undo/redo implementation — HistoryContext exists but wiring deferred to later
- NewRow component set — currently handled by rowGeneration.svelte.ts, refactor later
- Validation system — all edits currently isValid: true, constraint checking deferred
- Overlay hover problem — dirty cell overlays occluding hover on real cells is cosmetic, deferred
- Data immutability changes — already implemented, not part of this refactor

## Context

- **Current branch:** `arch-rehaul` — significant prior refactoring already done (controller deletion, context creation, event queue pipeline)
- **Working branch:** New branch off `arch-rehaul`, merge back if successful
- **Prior work:** Phase 01.3 context gathered with user-confirmed decisions on cell-based selection, per-cell buttons, keyboard extraction
- **Existing pattern:** The EventListener → queue → handler pipeline already handles commits, creates, discards, and queries. This refactor extends that pattern to cover selection and keyboard events.
- **GridOverlays today:** ~800+ lines, handles keyboard events (arrow, escape, F2, copy, paste, undo, redo), mouse events (click, drag for selection, context menu), renders selection overlay, copy overlay, dirty cells overlay, user cursor overlay. All via top-level event interception and DOM crawling.

## Constraints

- **Tech stack**: SvelteKit with Svelte 5 runes ($state, $derived, $effect, $props), createContext API
- **No breaking changes**: All existing grid functionality must continue working through the refactor
- **Incremental delivery**: Each phase should leave the grid in a working state
- **~800 buttons in DOM**: Per-cell buttons are acceptable — modern browsers handle this routinely for a static grid

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Cell-based selection model with {row, col, value} | Eliminates DOM crawling, selection/pending share same shape | -- Pending |
| Per-cell `<button>` elements in GridRow | Each cell owns its click, no data-* attribute crawling needed | -- Pending |
| Col is column key string, not numeric index | Column index derived via keys.indexOf(col) when needed for overlay math | -- Pending |
| svelte:window for keyboard handling | Under investigation — may not be viable, alternatives to be explored | -- Pending |
| GridOverlays becomes read-only visual layer | Zero event handling, zero state management, just renders positioned divs | -- Pending |

---
*Last updated: 2026-03-05 after initialization*
