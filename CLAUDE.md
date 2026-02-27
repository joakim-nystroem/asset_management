# Asset Management — Project Instructions

## Architecture Principles

1. **One file, one job.** Every file has a single responsibility. If you're adding functionality to a file, verify it belongs there first.

2. **Components own the functionality they expose to the user.** If only GridHeader can trigger a sort, GridHeader owns sort. If `+page.svelte` receives data from the server, it owns that data.

3. **Contexts are for ephemeral UI state only.** Editing position, selection range, menu visibility. NOT for bulk data (asset lists, user, constraints). Contexts are shells for transient state that multiple components share.

4. **Controllers are the single source of truth for their domain.** The change controller owns change tracking. The history controller owns undo/redo. Each controller manages its own state and exposes functions — nothing else touches that state directly.

5. **Don't duplicate logic — delegate.** If two files need the same check, one owns it and the other calls through.

6. **Cell editing is cell editing.** Whether the cell belongs to an existing row or a new row, the edit → validate → display cycle is the same. Don't create separate logic paths for the same operation.

---

## File Responsibilities

> This is the **target architecture**. The current codebase does not fully match — phases move us here incrementally. When modifying a file, move it closer to this definition, never further away.

### Page Level

**`frontend/src/routes/+page.svelte`** — App entry point
- **IS:** The page-level orchestrator that owns server data and initializes the app
- **DOES:** Declare `$state` for ALL server load data (`baseAssets`, `filteredAssets`, `locations`, `statuses`, `conditions`, `departments`, `user`, `dbError`, `initialView`). Create and publish controllers. Pass data and setter lambdas as props to children.
- **DOES NOT:** Contain business logic. Render complex UI (delegates to children). Read from contexts.

**`frontend/src/routes/+page.server.ts`** — Server data loader
- **IS:** SvelteKit server load function
- **DOES:** Query MariaDB via Kysely. Return `{ assets, dbError, locations, statuses, conditions, departments, initialView, searchResults? }`.
- **DOES NOT:** Client-side logic. State management.

### Context Layer

**`frontend/src/lib/context/GridContextProvider.svelte`** — Context shell factory
- **IS:** The component that creates empty typed `$state` context objects and publishes them
- **DOES:** Initialize ephemeral UI state shells (`editingCtx`, `selectionCtx`, `clipboardCtx`, `columnCtx`, `rowCtx`, `sortCtx`, `changeCtx`, `dataCtx`, `viewCtx`, `uiCtx`). Publish them via `setXContext()`. Render `{@render children()}`.
- **DOES NOT:** Receive data props (beyond `children: Snippet`). Create controllers. Transform data. Wire constraints. Seed contexts with server data.

**`frontend/src/lib/context/gridContext.svelte.ts`** — Context type definitions
- **IS:** The module that defines context types and exports `getXContext` / `setXContext` pairs
- **DOES:** Define `DataContext`, `SortContext`, `EditingContext`, etc. Use Svelte's `createContext()` to create typed getter/setter pairs.
- **DOES NOT:** Contain logic. Hold state.

### Event System

**`frontend/src/lib/grid/eventQueue/EventListener.svelte`** — Event queue wiring
- **IS:** The component that creates the event queue + handler and wires reactive effects that dispatch events
- **DOES:** Create `EventQueue` and `EventHandler` via factory functions. Register callbacks on `dataCtx` (commit, discard, addRows, addNewRow, viewChange, navigateError). Watch state changes via `$effect` and enqueue events (e.g., watch filter state → enqueue FILTER). Manage URL sync (temporary — future phase removes this). Handle WebSocket registration. Track dirty cells. Manage filter panel / header menu mutual-close effects.
- **DOES NOT:** Own data. Implement sort logic. Implement filter selection logic. Wire validation constraints. Contain `handleFilterSelect`. Receive a `data` prop.
- **RECEIVES:** `baseAssets`, `filteredAssets` (read-only props), `setBaseAssets`, `setFilteredAssets` (setter lambdas), `user`.

**`frontend/src/lib/grid/eventQueue/EventHandler.svelte.ts`** — Event processing logic
- **IS:** The factory that creates the `handle(event)` function for processing grid events
- **DOES:** Handle COMMIT_UPDATE, COMMIT_CREATE, DISCARD, FILTER, VIEW_CHANGE, ADD_ROWS events. Call server APIs. Update data via setter lambdas. Show toast notifications.
- **DOES NOT:** Own state. Create UI. Watch for state changes (that's EventListener's job).

**`frontend/src/lib/grid/eventQueue/EventQueue.svelte.ts`** — Serial async event queue
- **IS:** Queue that processes events one at a time
- **DOES:** Enqueue events. Process serially. Prevent concurrent handling.
- **DOES NOT:** Know what events mean. Contain business logic.

### Grid Components

**`frontend/src/lib/components/grid/GridContainer.svelte`** — Virtual scrolling viewport
- **IS:** The scrollable container that manages which rows are visible
- **DOES:** Manage virtual scroll state (visible items, offsets, container height). Handle scroll events. Render `GridHeader`, `GridRow`, `GridOverlays`, `HeaderMenu`.
- **DOES NOT:** Handle mouse interaction for cell selection/editing (that's GridOverlays). Own data. Contain sort/filter logic.

**`frontend/src/lib/components/grid/GridHeader.svelte`** — Column headers and sort
- **IS:** The header row that displays column names and owns sort
- **DOES:** Render column headers. Display sort direction indicators. Handle column resize. Trigger header menu. Own sort logic (`sortData`, `sortDataAsync`, `applySort`).
- **DOES NOT:** Own data. Manage filters.

**`frontend/src/lib/components/grid/GridRow.svelte`** — Row rendering
- **IS:** A single data row in the grid
- **DOES:** Render cell values for one row.
- **DOES NOT:** Handle interaction. Track state.

**`frontend/src/lib/components/grid/GridOverlays.svelte`** — Interaction and feedback layer
- **IS:** The invisible layer on top of the grid that owns all user interaction and visual feedback
- **DOES:** Listen for mouse events (click, double-click, drag, context menu). Manage cell selection. Render FloatingEditor for cell editing. Show selection highlights, copy highlights, dirty cell indicators, invalid cell overlays (yellow). Drive the edit → validate → display cycle — validation happens inline during edit save, invalid cells are tracked in change state. Create and own change/history controllers.
- **DOES NOT:** Own data. Handle scrolling (that's GridContainer). Contain sort/filter logic.

### Menu Components

**`frontend/src/lib/grid/components/header-menu/headerMenu.svelte`** — Column dropdown menu
- **IS:** The dropdown menu that appears on column header click
- **DOES:** Show sort options (A-Z, Z-A, clear). Show filter item checkboxes. Write filter state directly to `searchManager` on selection.
- **DOES NOT:** Own sort implementation (calls GridHeader). Own filter logic.

**`frontend/src/lib/grid/components/context-menu/contextMenu.svelte`** — Right-click cell menu
- **IS:** The context menu for cell-level actions
- **DOES:** Show copy, filter-by-value, navigate-to-error options. Write filter state directly to `searchManager` on filter action.
- **DOES NOT:** Implement the actions beyond state writes.

### Controllers

> Controllers are factory-created objects: reactive `$state` + functions that operate on it. They are the single source of truth for their domain. They do NOT call `getContext()` internally — dependencies are passed explicitly.

**`frontend/src/lib/grid/utils/gridChanges.svelte.ts`** — Dirty change tracking
- **IS:** The controller that tracks which cells have been modified
- **DOES:** Track dirty changes (`Map<cellKey, HistoryAction>`). Track invalid cells (set by the edit flow when validation fails). Expose `update()`, `getAllChanges()`, `revert()`, `clear()`. Report `hasInvalidChanges` for commit gating.
- **DOES NOT:** Contain validation logic. Validation happens in the edit flow (FloatingEditor save) — this controller just stores the result.

**`frontend/src/lib/grid/utils/gridHistory.svelte.ts`** — Undo/redo
- **IS:** The controller for edit history
- **DOES:** Push actions. Undo/redo with state restoration.
- **DOES NOT:** Validate. Track dirty state.

**`frontend/src/lib/grid/utils/rowGeneration.svelte.ts`** — New row management
- **IS:** The controller for uncommitted new rows
- **DOES:** Create new rows with NEW-N string IDs (monotonic counter). Track new rows in `$state`. Expose `addNewRow()`, `updateNewRowField()`, `clearNewRows()`. Counter resets on `clearNewRows()`.
- **DOES NOT:** Contain validation logic (validation happens in the edit flow). Compute numeric IDs from `baseAssets`. Own a `setNextIdProvider`.

**`frontend/src/lib/grid/utils/gridSelection.svelte.ts`** — Cell selection
- **IS:** The controller for cell/range selection
- **DOES:** Track selection start/end. Handle mouse-driven selection. Expose `selectCell()`, `handleMouseDown()`, `extendSelection()`.

**`frontend/src/lib/grid/utils/gridColumns.svelte.ts`** — Column width management
- **IS:** The controller for column widths
- **DOES:** Track widths. Handle resize. Expose `getWidth()`, `startResize()`, `resetWidth()`.

**`frontend/src/lib/grid/utils/gridRows.svelte.ts`** — Row height management
- **IS:** The controller for row heights
- **DOES:** Track heights. Expose `getHeight()`.

**`frontend/src/lib/grid/utils/gridEdit.svelte.ts`** — Cell editing
- **IS:** The controller for starting/saving/cancelling cell edits
- **DOES:** Manage edit state (which cell is being edited, original value). Expose `startEdit()`, `save()`, `cancel()`.

### Data Layer

**`frontend/src/lib/data/searchManager.svelte.ts`** — Search and filter state
- **IS:** The singleton that manages search input and filter selections
- **DOES:** Track `inputValue`, `selectedFilters`, `error`. Expose `getFilterItems()`, `selectFilterItem()`, `removeFilter()`, `clearAllFilters()`. Compute filter item lists from base data.
- **DOES NOT:** Fetch data. Enqueue events. Update URL.

---

## Tech Stack

- **Framework:** SvelteKit with Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`)
- **Context API:** `createContext` from `svelte` (returns `[getter, setter]` tuple)
- **Database:** Kysely ORM with MariaDB (host: 10.236.133.207, port: 3101, db: asset_db)
- **Base path:** `/asset` for all routes
- **Barcode scanning:** html5-qrcode (dynamic import)

## Build & Check

```bash
# Type checking — MUST run from frontend/ directory
cd frontend && npx svelte-check --tsconfig ./tsconfig.json

# Dev server
cd frontend && npm run dev
```

## Critical Rules

### MariaDB Date Formatting
**NEVER use `.toISOString()` for DATETIME columns.** MariaDB rejects the `T` and `Z`.
```typescript
// Wrong: .toISOString() → "2026-02-06T06:33:32.213Z"
// Right:
.toISOString().slice(0, 19).replace('T', ' ')  // → "2026-02-06 06:33:32"
```

### Kysely ColumnType
`ColumnType<SelectType, InsertType, UpdateType>` — the insert/update types matter. `ColumnType<Date, string, string>` means SELECT returns Date, but INSERT/UPDATE need string.

### SvelteKit Reactivity
- `page.url` from `$app/state` uses `$state.raw()` — shallow reactivity
- `replaceState()` does NOT create a new URL reference — `$effect` won't re-run
- Use `SvelteURL` from `svelte/reactivity` as reactive URL source of truth

### SvelteKit Route Files
Valid: `+page.svelte`, `+page.ts`, `+page.server.ts`. The file `+page.svelte.ts` does NOT exist as a valid type.

### Validation
Validation is part of the edit flow, not a separate system. When a cell is saved (FloatingEditor), the edit logic checks if the value is valid (required field? valid value?). If invalid, the cell is marked in change state. No separate validation context or validation controller exists — it's just a check during save, and a flag in the change state. Constraints (allowed dropdown values) are a separate concern from validation — they are UI data for the edit dropdown.
