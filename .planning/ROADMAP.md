# Roadmap: Architecture Rehaul — Milestone 1

## Milestone Goal
Transform the asset management grid from a tightly-coupled monolith into a strictly modular, context-driven, component-autonomous architecture as defined in the To-Be Architecture specification.

---

## Phase 1 — Context Foundation
**Goal:** Replace all module-level singletons in the grid path with Svelte 5 `createContext`-based providers. Establish the architectural backbone that all subsequent phases build on.

**Scope:**
- Create `gridContext.svelte.ts` exporting typed [getter, setter] pairs for: columnManager, rowManager, editManager, selectionManager, changeManager, historyManager, clipboardManager, validationManager, realtimeManager
- Wrap `<InventoryGrid>` (to be created) as the context provider
- Keep all existing manager logic intact — only change how they are accessed
- Update `GridRow` and `GridOverlays` to consume context instead of importing singletons directly
- `svelte-check` must pass

**Success:** No direct singleton imports in grid components; all state accessed via context getters.

**Plans:** 4/7 plans executed

Plans:
- [x] 01-01-PLAN.md — Create gridContext.svelte.ts + InventoryGrid.svelte context provider + slim +page.svelte
- [ ] 01-02-PLAN.md — Migrate validationManager, columnManager, rowManager (leaf managers, no deps)
- [ ] 01-03-PLAN.md — Migrate selectionManager, historyManager (leaf managers, no deps)
- [ ] 01-04-PLAN.md — Migrate editManager, changeManager, rowGenerationManager (depend on Plans 02-03)
- [ ] 01-05-PLAN.md — Migrate clipboardManager, sortManager, viewManager (depend on Plans 02-03)
- [ ] 01-06-PLAN.md — Audit + fix all grid component consumers; verify edit/selection/overlay chain
- [ ] 01-07-PLAN.md — Move toastState, keep realtimeManager as singleton, delete utils/ tree, svelte-check gate

---

## Phase 2 — Component Decomposition
**Goal:** Extract the `+page.svelte` monolith into properly scoped components. The page becomes a thin shell; `<InventoryGrid>` owns all grid state.

**Scope:**
- Create `InventoryGrid.svelte` + `inventoryGrid.svelte.ts` (ViewModel)
- Create `GridContainer.svelte` — renders visible rows only, zero knowledge of editors/menus
- Move all grid state ($state variables, data fetching, event handlers) from `+page.svelte` into `InventoryGrid`
- `+page.svelte` becomes < 100 lines: imports InventoryGrid, passes route data (user, initial assets, metadata)
- `GridContainer` takes only: `assets`, `keys`, `virtualScroll` props — all else via context

**Success:** `+page.svelte` < 100 lines; `GridContainer` has no editor/menu imports.

---

## Phase 3 — FloatingEditor & ContextMenu
**Goal:** Extract the inline cell editor into an autonomous `<FloatingEditor>` component outside the grid DOM. Make `<ContextMenu>` fully self-contained.

**Scope:**
- Create `FloatingEditor.svelte` + `floatingEditor.svelte.ts`
  - Reads active cell coords from gridContext, positions absolutely over the cell
  - Handles textarea, EditDropdown, Autocomplete
  - Unmounts when no cell is in edit mode
  - Dispatches save/cancel via context callbacks
- Remove inline textarea from `GridRow.svelte`
- Verify `<ContextMenu>` reads context directly (refactor if needed)
- Place FloatingEditor in `InventoryGrid` template, outside `GridContainer`

**Success:** `GridRow` renders only cell display spans; FloatingEditor positions itself autonomously.

---

## Phase 4 — DB-Side Filtering
**Goal:** Replace all client-side array filtering with server-side Kysely queries.

**Scope:**
- Add multi-column filter support to `/api/assets` or create `/api/assets/filter` endpoint
- Update `searchManager` to dispatch filter queries to the API instead of filtering `baseAssets` client-side
- Maintain `baseAssets` (initial load) / `filteredAssets` (query result) duality
- Clearing filters re-points to `baseAssets` (no refetch)
- Remove `getFilterItems()` client-side filtering logic from `searchManager.svelte.ts`
- Update header filter dropdowns to fetch available values from API

**Success:** No client-side `.filter()` on the assets array for search/filter operations.

---

## Phase 5 — Undo/Redo Session Engine
**Goal:** Ensure the session-scoped undo/redo history stack is fully functional as described in the to-be spec.

**Scope:**
- Audit `historyManager.svelte.ts` against to-be spec requirements
- Ensure history entries are treated as uncommitted drafts (integrated with changeManager)
- Verify Ctrl+Z / Ctrl+Y traverse the stack correctly and update visual overlays
- Ensure `historyManager.clearCommitted()` is called after successful DB commit
- Wire undo/redo into the context so FloatingEditor and keyboard handlers can trigger it

**Success:** Undo/redo works end-to-end; committed changes are cleared from history after sync.

---

## Phase 6 — Spatial Clipboard Hardening
**Goal:** Verify and harden the spatial clipboard with proper marching ants overlay and structural paste.

**Scope:**
- Audit `clipboardManager.svelte.ts` against to-be spec (0,0-indexed mini-grid, structural paste)
- Ensure marching ants (dashed copy overlay) renders correctly in all scroll positions
- Verify cross-column paste maps structurally (not just first column)
- Ensure clipboard state is context-scoped (not singleton)
- Fix any edge cases with virtual scroll + clipboard overlay positioning

**Success:** Copy-paste works across arbitrary grid regions with correct visual feedback.

---

## Phase 7 — WebSocket Delta Sync
**Goal:** On successful commit, broadcast only the changed cells to all connected clients. Clients patch their local state without a full refetch.

**Scope:**
- Update Go WebSocket server (`api/main.go`) to broadcast `asset_update` messages with `{ id, key, value }` payload on each committed change
- Update `realtimeManager.svelte.ts` `onAssetUpdate` handler to patch the local assets array
- Ensure `InventoryGrid` wires the `setAssetUpdateHandler` to its local `$state` assets array
- "Last write wins" — if local pending change exists for same cell, skip the remote update
- Test with two simultaneous browser sessions

**Success:** Editing in one browser session immediately reflects in another without page reload.

---

## Summary

| Phase | Name | Key Output | Complexity |
|-------|------|-----------|------------|
| 1 | 4/7 | In Progress|  |
| 2 | Component Decomposition | `InventoryGrid`, `GridContainer`, thin page | High |
| 3 | FloatingEditor & ContextMenu | `FloatingEditor.svelte`, clean GridRow | Medium |
| 4 | DB-Side Filtering | API filter endpoint, no client-side filtering | Medium |
| 5 | Undo/Redo Engine | Verified history stack, draft integration | Medium |
| 6 | Spatial Clipboard Hardening | Verified clipboard, marching ants | Low |
| 7 | WebSocket Delta Sync | Go delta broadcast, client patch | Medium |
