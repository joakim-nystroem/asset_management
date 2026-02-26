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

## Phase 1: Singleton Removal ✓
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

## Phase 2: Component Decomposition ✓
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

## Phase 3: FloatingEditor & ContextMenu ✓
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

## Phase 4: Context Split & Component Autonomy
**Status:** UAT gap closure in progress
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

**Requirements:** [F1.1, F1.2, F1.3, F1.4, F1.5, F2.1, F2.2, F2.3, F2.4, F2.5, F2.6, F2.7]

**Success:** `+page.svelte` < 60 lines; monolithic GridContext replaced by ~10 domain contexts; each component independently deletable without breaking the app; all 3 bugs fixed.

**Plans:** 8/8 plans complete
- [x] 04-01-PLAN.md — Bug fixes + split GridContext into ~10 domain context types
- [x] 04-02-PLAN.md — Migrate all controller factories to domain-specific getters
- [x] 04-03-PLAN.md — Migrate all grid components to domain contexts, eliminate pageActions
- [x] 04-04-PLAN.md — Create DataController.svelte, migrate Toolbar to zero props
- [x] 04-05-PLAN.md — Rewrite +page.svelte as thin wrapper, remove monolithic GridContext
- [x] 04-06-PLAN.md — Gap closure: Toolbar dirty state, URL param preservation, data flash fix
- [x] 04-07-PLAN.md — Gap closure: Context menu fixes, undo/redo for edits, paste selection highlight
- [ ] 04-08-PLAN.md — Gap closure: Share controller instances via context, fix click-away save race

---

## Phase 5: DB-Side Filtering
**Status:** Awaiting human verification
**Goal:** Consolidate `/api/assets`, `/api/search`, and `/api/assets/view` into a single `/api/assets` endpoint backed by a unified `queryAssets()` Kysely query builder.

**Scope:**
- Rename `searchAssets()` to `queryAssets()` with PED view filter fix
- Rewrite `/api/assets/+server.ts` to accept `q`, `filter`, `view` params
- Update `+page.server.ts` to use `queryAssets()` for both base and filtered loads
- Update `DataController.svelte` to fetch from unified `/api/assets` endpoint
- Delete `/api/search/+server.ts`, `/api/assets/view/+server.ts`, `searchAssets.ts`, `getAssetsByView.ts`
- Maintain `baseAssets` (initial load) / `filteredAssets` (query result) in `dataContext`
- Clearing filters re-points to `baseAssets` (no refetch)

**Requirements:** [F5.1, F5.2, F5.3, F5.4, F5.5]

**Success:** All asset data fetching goes through one endpoint (`GET /api/assets`) with consistent `{ assets, dbError }` response shape. No client-side `.filter()` on the assets array for search/filter operations.

**Plans:** 2/2 plans executed (awaiting human verification)
- [x] 05-01-PLAN.md — Create queryAssets.ts, rewrite /api/assets endpoint, update +page.server.ts
- [x] 05-02-PLAN.md — Migrate DataController fetch URLs, delete obsolete routes and DB functions

---

## Phase 6: Undo/Redo Session Engine
**Status:** Planned
**Goal:** Ensure the session-scoped undo/redo history stack is fully functional with auto-scroll and selection cursor tracking.

**Scope:**
- Audit all 6 history call-sites against CONTEXT.md locked decisions
- Add auto-scroll to affected cell after undo/redo (`viewCtx.scrollToRow`)
- Add selection cursor movement after undo/redo (`selection.moveTo()`)
- Document intentional history preservation across DB commits (CONTEXT.md overrides F8.4)
- Update F8.4 in REQUIREMENTS.md to match locked user decision
- History controller lives inside owning component (GridContextProvider creates, GridOverlays + DataController consume)

**Requirements:** [F8.1, F8.2, F8.3, F8.4]

**Success:** Undo/redo works end-to-end with auto-scroll to affected cell; history persists across commits per user decision; svelte-check passes.

**Plans:** 1 plan
- [ ] 06-01-PLAN.md — Audit history call-sites, add auto-scroll + selection cursor to onUndo/onRedo

---

## Phase 7: Spatial Clipboard Hardening
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

## Phase 8: WebSocket Delta Sync
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
| 4 | Context Split & Component Autonomy | Complete | 11 domain contexts, thin +page.svelte, DataController |
| 5 | DB-Side Filtering | Awaiting verification | Unified /api/assets endpoint, queryAssets.ts |
| 6 | Undo/Redo Engine | Planned | Auto-scroll, selection cursor, audit + docs |
| 7 | Spatial Clipboard Hardening | Pending | Verified clipboard, marching ants |
| 8 | WebSocket Delta Sync | Pending | Go delta broadcast, client patch |
