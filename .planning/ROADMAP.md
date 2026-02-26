# Roadmap: Architecture Rehaul — Milestone 1

## Milestone Goal
Transform the asset management grid from a tightly-coupled monolith into a strictly modular, context-driven, component-autonomous architecture using Svelte 5's `createContext` pattern with multiple focused contexts, thin route wrappers, and self-sufficient components.

## Architecture Principles
- **Multiple small contexts** — one `createContext<T>()` per domain (~10 contexts), not one monolithic GridContext
- **Thin `+page.svelte`** — calls `set*Context($state({...}))` for each domain, renders children, done
- **Component independence** — delete any component, app still works minus that feature
- **Controllers inside components** — each component owns its domain logic via `get*Context()`
- **No callback props** — components read/write context directly, no `pageActions` pattern

---

## Phase 1 — Singleton Removal ✓
**Status:** Complete (2026-02-25)
**Goal:** Replace all module-level singletons with `createContext`-based providers.

**What was done:**
- Created `gridContext.svelte.ts` with a single monolithic `GridContext` type + `[getGridContext, setGridContext]`
- Migrated 9 managers from singletons to controller factories that read/write context
- Created `InventoryGrid.svelte` as context provider (later deleted in Phase 2)
- Deleted old `utils/core/`, `utils/data/`, `utils/ui/` directories
- `svelte-check` passes

**Note:** Used a single monolithic GridContext — superseded by Phase 4's multi-context split.

**Plans:** 7/7 complete
- [x] 01-01 — gridContext.svelte.ts + InventoryGrid.svelte + slim +page.svelte
- [x] 01-02 — Migrate validationManager, columnManager, rowManager
- [x] 01-03 — Migrate selectionManager, historyManager
- [x] 01-04 — Migrate editManager, changeManager, rowGenerationManager
- [x] 01-05 — Migrate clipboardManager, sortManager, viewManager
- [x] 01-06 — Audit all grid component consumers
- [x] 01-07 — Move toastState, delete utils/ tree, svelte-check gate

---

## Phase 2 — Component Decomposition ✓
**Status:** Complete (2026-02-25)
**Goal:** Extract the page monolith into scoped components with event delegation.

**What was done:**
- Deleted `InventoryGrid.svelte` — `+page.svelte` became context owner
- Created `GridContainer.svelte` with virtual scroll, event delegation via `closest('[data-row][data-col]')`
- Moved `GridOverlays` inside `GridContainer` (two-layer cake model)
- Created `gridShortcuts.svelte.ts` with `{@attach}` directive for keyboard handling
- Restructured directories: controllers → `lib/grid/utils/`, component pairs → `lib/grid/components/`

**Note:** `+page.svelte` became a 1,199-line god controller instead of a thin wrapper. Business logic, effects, and callback threading all remained in the page. Superseded by Phase 4.

**Plans:** 3/3 complete
- [x] 02-01 — +page.svelte as context owner, delete InventoryGrid.svelte
- [x] 02-02 — GridContainer.svelte, GridOverlays/Toolbar read context directly
- [x] 02-03 — Directory restructure

---

## Phase 3 — FloatingEditor & ContextMenu ✓
**Status:** Complete (2026-02-26)
**Goal:** Extract inline cell editor into autonomous FloatingEditor. Make ContextMenu self-contained.

**What was done:**
- Created `FloatingEditor.svelte` + `floatingEditor.svelte.ts` — reads from monolithic GridContext
- Refactored `ContextMenu` to zero props, self-contained via `getGridContext()`
- Stripped `GridRow` to pure display (3 props: asset, keys, actualIndex)
- Placed FloatingEditor in GridOverlays (Layer 2)

**Note:** Components still read from monolithic GridContext and rely on `ctx.pageActions` callbacks. Phase 4 will split contexts and eliminate the callback pattern.

**Known bugs (diagnosed, not fixed):**
1. Context menu broken in new-row mode — `e.preventDefault()` only called inside `contextMenu.open()`
2. Drag selection broken — `onmouseenter` doesn't bubble (needs `onmouseover`)
3. FloatingEditor font mismatch — textarea missing `text-xs` class

**Plans:** 3/3 complete
- [x] 03-01 — ContextMenu zero-prop refactor
- [x] 03-02 — FloatingEditor component pair
- [x] 03-03 — Wire FloatingEditor into GridOverlays, strip GridRow, event delegation

---

## Phase 4 — Context Split & Component Autonomy
**Status:** Not started
**Goal:** Split the monolithic GridContext into ~10 separate domain contexts. Make `+page.svelte` a thin wrapper. Move controller logic into owning components. Fix diagnosed bugs.

**Scope:**
- Split `gridContext.svelte.ts` monolithic type into ~10 separate `createContext<T>()` calls:
  - `editingContext` — isEditing, editKey, editRow, editCol, inputValue, editOriginalValue
  - `selectionContext` — selectionStart, selectionEnd, isSelecting
  - `clipboardContext` — copyStart, copyEnd, isCopyVisible, isHiddenAfterCopy
  - `columnContext` — keys, columnWidths, resizingColumn
  - `rowContext` — rowHeights
  - `sortContext` — sortKey, sortDirection
  - `validationContext` — validationConstraints, hasInvalidChanges
  - `changeContext` — hasUnsavedChanges, dirtyCells
  - `dataContext` — assets, baseAssets, filteredAssetsCount
  - `viewContext` — activeView, virtualScroll, scrollToRow
  - Additional UI contexts as needed (contextMenu, headerMenu, filterPanel, editDropdown, autocomplete)
- Rewrite `+page.svelte` as thin wrapper: `set*Context($state({...}))` calls + render children (target: < 60 lines)
- Create renderless `DataController.svelte` — owns URL-driven search, commit, discard, addRows
- Move controller logic into owning components (delete centralized creation)
- Eliminate `ctx.pageActions` callback pattern — components write to context directly
- Fix 3 diagnosed bugs: contextmenu preventDefault, onmouseenter→onmouseover, text-xs class
- `svelte-check` must pass

**Success:** `+page.svelte` < 60 lines; monolithic GridContext replaced by ~10 domain contexts; each component independently deletable without breaking the app; all 3 bugs fixed.

---

## Phase 5 — DB-Side Filtering
**Status:** Not started
**Goal:** Replace all client-side array filtering with server-side Kysely queries.

**Scope:**
- Add multi-column filter support to `/api/assets` or create `/api/assets/filter` endpoint
- Update `searchManager` to dispatch filter queries to the API instead of filtering client-side
- `DataController.svelte` manages the fetch/filter lifecycle via `dataContext`
- Maintain `baseAssets` (initial load) / `filteredAssets` (query result) in `dataContext`
- Clearing filters re-points to `baseAssets` (no refetch)
- Update header filter dropdowns to fetch available values from API

**Success:** No client-side `.filter()` on the assets array for search/filter operations.

---

## Phase 6 — Undo/Redo Session Engine
**Status:** Not started
**Goal:** Ensure the session-scoped undo/redo history stack is fully functional.

**Scope:**
- Audit history controller against to-be spec requirements
- Ensure history entries are treated as uncommitted drafts (integrated with `changeContext`)
- Verify Ctrl+Z / Ctrl+Y traverse the stack correctly and update visual overlays
- Ensure history is cleared after successful DB commit
- History controller lives inside the component that owns undo/redo behavior

**Success:** Undo/redo works end-to-end; committed changes are cleared from history after sync.

---

## Phase 7 — Spatial Clipboard Hardening
**Status:** Not started
**Goal:** Verify and harden the spatial clipboard with proper marching ants overlay and structural paste.

**Scope:**
- Audit clipboard controller against to-be spec (0,0-indexed mini-grid, structural paste)
- Ensure marching ants (dashed copy overlay) renders correctly in all scroll positions
- Verify cross-column paste maps structurally (not just first column)
- Clipboard state lives in `clipboardContext` — read by GridOverlays for overlay rendering
- Fix any edge cases with virtual scroll + clipboard overlay positioning

**Success:** Copy-paste works across arbitrary grid regions with correct visual feedback.

---

## Phase 8 — WebSocket Delta Sync
**Status:** Not started
**Goal:** On successful commit, broadcast only the changed cells to all connected clients.

**Scope:**
- Update Go WebSocket server (`api/main.go`) to broadcast `asset_update` messages with `{ id, key, value }` payload
- Update `realtimeManager` handler to patch the local assets array via `dataContext`
- "Last write wins" — if local pending change exists for same cell, skip the remote update
- Test with two simultaneous browser sessions

**Success:** Editing in one browser session immediately reflects in another without page reload.

---

## Summary

| Phase | Name | Status | Key Output |
|-------|------|--------|------------|
| 1 | Singleton Removal | ✓ Complete | Singletons → context getters |
| 2 | Component Decomposition | ✓ Complete | GridContainer, event delegation, directory structure |
| 3 | FloatingEditor & ContextMenu | ✓ Complete | FloatingEditor, ContextMenu zero-prop, GridRow pure display |
| 4 | Context Split & Component Autonomy | Pending | ~10 domain contexts, thin +page.svelte, bug fixes |
| 5 | DB-Side Filtering | Pending | API filter endpoint, server-side queries |
| 6 | Undo/Redo Engine | Pending | Verified history stack, draft integration |
| 7 | Spatial Clipboard Hardening | Pending | Verified clipboard, marching ants |
| 8 | WebSocket Delta Sync | Pending | Go delta broadcast, client patch |
