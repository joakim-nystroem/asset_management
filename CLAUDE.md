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
- **IS:** The page-level orchestrator that seeds the data store and renders the component tree
- **DOES:** Receive server load data via `$props()`. Seed `assetStore` with server data (`baseAssets`, `filteredAssets`, `locations`, `statuses`, `conditions`, `departments`). Render `GridContextProvider` > `EventListener` > `Toolbar` > `GridContainer`.
- **DOES NOT:** Contain business logic. Declare `$state` for data (that's `assetStore`). Render complex UI (delegates to children). Read from contexts.

**`frontend/src/routes/+page.server.ts`** — Server data loader
- **IS:** SvelteKit server load function
- **DOES:** Query MariaDB via Kysely. Return `{ assets, dbError, locations, statuses, conditions, departments, initialView, searchResults? }`.
- **DOES NOT:** Client-side logic. State management.

### Context Layer

**`frontend/src/lib/context/GridContextProvider.svelte`** — Context shell factory
- **IS:** The component that creates empty typed `$state` context objects and publishes them
- **DOES:** Initialize ephemeral UI state shells (`editingCtx`, `pendingCtx`, `historyCtx`, `newRowCtx`, `selectionCtx`, `clipboardCtx`, `rowCtx`, `viewCtx`, `uiCtx`, `queryCtx`). Publish them via `setXContext()`. Render `{@render children()}`.
- **DOES NOT:** Receive data props (beyond `children: Snippet`). Create controllers. Transform data. Wire constraints. Seed contexts with server data.

**`frontend/src/lib/context/gridContext.svelte.ts`** — Context type definitions
- **IS:** The module that defines context types and exports `getXContext` / `setXContext` pairs
- **DOES:** Define `EditingContext`, `PendingContext`, `HistoryContext`, `NewRowContext`, `SelectionContext`, `ClipboardContext`, `RowContext`, `ViewContext`, `UiContext`, `QueryContext`. Use Svelte's `createContext()` to create typed getter/setter pairs.
- **DOES NOT:** Contain logic. Hold state. Define contexts for bulk data (no DataContext, no SortContext, no ColumnContext).

### Event System

The event system follows the **Smart Owner** pattern: **EventListener → Queue → Handler → Target (mutates proxies)**.

Svelte 5 `$state` proxies are portable — `EventListener.svelte` grabs them via `getContext()` during component init, then passes them as plain arguments through the pipeline. Target functions mutate the proxies directly to update the UI. Data never flows backward.

**`frontend/src/lib/grid/eventQueue/EventListener.svelte`** — Smart conductor
- **IS:** The ONLY file that calls `getContext()` in the event pipeline. Lives inside the Svelte component tree. Watches UI trigger flags and packages events.
- **DOES:** Read contexts via `getXContext()`. Watch trigger flags via `$effect` (e.g., `uiCtx.commitRequested`). Snapshot reactive data for API payloads (`$state.snapshot()`). Pass both the flat payload AND the relevant live context proxies to `enqueue()`. Reset trigger flags after enqueuing.
- **DOES NOT:** Receive props. Own data. Implement business logic. Know about APIs, routing, or the handler.

**`frontend/src/lib/grid/eventQueue/eventQueue.ts`** — Serial FIFO queue
- **IS:** Pure TypeScript FIFO queue. No Svelte, no runes, no reactivity.
- **DOES:** Receive `(event, contexts)` pairs via `enqueue()`. Process serially — one event at a time. Catch errors so the queue doesn't die.
- **DOES NOT:** Know what events mean. Contain business logic. Use `$state` or `$effect`.

**`frontend/src/lib/grid/eventQueue/eventHandler.ts`** — Event router with target functions
- **IS:** Pure TypeScript event router. No Svelte, no `getContext()`, no runes.
- **DOES:** Switch on `event.type` and route to target functions. Target functions receive the payload AND context proxies, call APIs, and mutate proxies directly on success (e.g., `pendingCtx.edits = []`). Import `assetStore` directly for data mutations (e.g., `assetStore.filteredAssets = result.assets`).
- **DOES NOT:** Call `getContext()`. Use runes. Return results backward. Use factory functions or dependency injection.

### Grid Components

**`frontend/src/lib/grid/components/grid-container/GridContainer.svelte`** — Virtual scrolling viewport
- **IS:** The scrollable container that manages which rows are visible
- **DOES:** Manage virtual scroll state (visible items, offsets, container height). Handle scroll events. Reposition header menu on scroll. Render `GridOverlays` > (`GridHeader`, `GridRow`, `EditHandler`). Render `ContextMenu`. Iterate `newRowCtx` and render `NewRow` components for uncommitted new rows.
- **DOES NOT:** Handle mouse interaction for cell selection/editing (that's GridOverlays). Own data. Contain sort/filter/header-menu logic (that's GridHeader).

**`frontend/src/lib/grid/components/grid-header/GridHeader.svelte`** — Column headers, sort, resize, and header menu
- **IS:** The header row that displays column names, owns sort, column resize, and the header menu
- **DOES:** Render column headers. Display sort direction indicators. Own full column resize lifecycle (mousedown → temp window listeners → mutate columnWidths SvelteMap). Receive `columnWidths` and `keys` as props. Own local sort state (`sortKey`, `sortDirection`). `handleSort()` mutates `assetStore.filteredAssets` directly. `handleHeaderClick()` closes other panels and toggles header menu. Render `HeaderMenu` as child, passing sort state and sort callback. Import `getUiContext` and `assetStore`.

**`frontend/src/lib/grid/components/grid-row/GridRow.svelte`** — Row rendering
- **IS:** A single data row in the grid
- **DOES:** Render cell values for one row.
- **DOES NOT:** Handle interaction. Track state.

**`frontend/src/lib/grid/components/grid-overlays/GridOverlays.svelte`** — Interaction and feedback layer
- **IS:** The parent wrapper that owns ALL user input (keyboard + mouse) and visual feedback
- **DOES:** Own local `columnWidths` SvelteMap (no context). Pass columnWidths to children via `{@render children(columnWidths)}` snippet. Listen for ALL keyboard and mouse events. Handle cell selection directly (inlined from deleted selectionController). Show selection overlays, copy overlays, other-user cursors. Derive `keys` from `assetStore.filteredAssets`. **Trigger cell editing** by writing to `pendingCtx` on F2 / double-click (uses local `startCellEdit()` helper). Forward undo/redo/paste keystrokes to EditHandler via pendingCtx flags or props.
- **DOES NOT:** Own data. Handle scrolling (that's GridContainer). Contain sort/filter logic. Own resize (that's GridHeader). Render EditHandler directly (rendered in GridContainer's snippet).

**`frontend/src/lib/grid/components/edit-handler/`** — EditHandler (component set: `.svelte` + `.svelte.ts`)
- **IS:** The inline cell editor. Owns the in-edit lifecycle (save, cancel, undo, redo, paste) but NOT the trigger to start editing — that belongs to GridOverlays and ContextMenu, which write to `editingCtx` to open the editor.
- **`.svelte` DOES:** Render textarea. Show edit dropdown for constrained columns. Show autocomplete for free-text columns.
- **`.svelte.ts` DOES:** `save()`, `cancel()`, `undo()`, `redo()`, `paste()`. All cell mutations go through the edit flow (check edit context → validate → upsert → optimistic-update asset → record to history). Undo/redo applies values then runs the same edit flow per cell. Compute editor position within virtual scroll chunk.
- **TO BE IMPLEMENTED:** `save()` (currently a stub), `undo()`, `redo()`, `paste()`. History context integration.

**`frontend/src/lib/grid/components/toolbar/Toolbar.svelte`** — Grid toolbar
- **IS:** The toolbar above the grid with search, filters, view selector, commit/discard buttons
- **DOES:** Render search input. Render FilterPanel. Show New Row button. Show Commit/Discard buttons when changes exist. Show invalid cell warning and Go To button. Show view selector dropdown (Default, Audit, PED, Galaxy, Network).
- **DOES NOT:** Contain business logic. Own data.

### Menu Components

**`frontend/src/lib/grid/components/header-menu/`** — HeaderMenu (component set: `.svelte` + `.svelte.ts`)
- **IS:** The dropdown menu that appears on column header click
- **`.svelte` DOES:** Render sort options (A-Z, Z-A) with checkmarks. Render filter item checkboxes. Write filter state directly to `queryCtx` on selection. Read filter items from `assetStore.baseAssets`.
- **`.svelte.ts` DOES:** Manage menu state (position, active key, filter search term, submenu direction). Handle toggle, reposition, close, outside click.
- **DOES NOT:** Own sort state or sort function (receives from GridHeader parent via props). Own filter logic (writes to queryCtx, EventListener handles the query).

**`frontend/src/lib/grid/components/context-menu/`** — ContextMenu (component set: `.svelte` + `.svelte.ts`)
- **IS:** The context menu for cell-level actions
- **`.svelte` DOES:** Render edit, copy, filter-by-value options. Rendered inside `GridContainer`.
- **`.svelte.ts` DOES:** Manage menu state via `ContextMenuState` class (position, visibility, cell value/key). Handle open/close. `handleFilterByValue(uiCtx, queryCtx)` pushes to `queryCtx.filters`.
- **DOES NOT:** Implement the actions beyond state writes.

**`frontend/src/lib/grid/components/edit-dropdown/`** — EditDropdown (component set: `.svelte` + `.svelte.ts`)
- **IS:** The dropdown shown inside EditHandler for constrained columns (location, status, condition, etc.)
- **`.svelte` DOES:** Render option list with keyboard selection highlighting. Handle mouse selection.
- **`.svelte.ts` DOES:** Manage dropdown state (options, selected index, visibility). Expose `show()`, `hide()`, `selectNext()`, `selectPrevious()`, `getSelectedValue()`.

**`frontend/src/lib/grid/components/filter-panel/`** — FilterPanel (component set: `.svelte` + `.svelte.ts`)
- **IS:** The popover panel showing active filters with remove/clear actions
- **`.svelte` DOES:** Render trigger button with filter count badge. Render active filter list with remove buttons. Handle outside click to close.
- **`.svelte.ts` DOES:** Manage panel state (open/close/toggle). Handle outside click detection.

**`frontend/src/lib/grid/components/suggestion-menu/`** — Autocomplete (component set: `.svelte` + `.svelte.ts`)
- **IS:** The suggestion dropdown shown inside EditHandler for free-text columns
- **`.svelte` DOES:** Render suggestion list with keyboard selection highlighting. Handle mouse selection.
- **`.svelte.ts` DOES:** Manage autocomplete state (suggestions, selected index, visibility). `updateSuggestions()` — filter unique column values matching input. Expose `selectNext()`, `selectPrevious()`, `getSelectedValue()`, `clear()`.

### Controllers

> Most former controllers are being eliminated — their state moves to contexts, their logic moves to owning components. Remaining controllers (virtualScrollManager) are factory-created objects with reactive `$state` + functions.

**Pending context** (`pendingCtx`) — Dirty change tracking
- **SHAPE:** Array of `CellEdit`: `{ row: number | string, col: string, original: string, value: string, valid: boolean }`. `row` is asset ID (number for existing, `"NEW-N"` string for new rows). `col` is column key. The `[row, col]` pair is unique.
- **EDIT FLOW:** (1) Check edit context — entry exists for `[row, col]`? (2) If new value === `original` → remove entry, done (revert to baseline, no validation needed). (3) Otherwise → validate → upsert entry with new `value` and `valid`. This flow runs in EditHandler on save, and similarly when undo/redo modifies a cell.
- **CLEARED:** On commit (valid entries removed, invalid remain). On discard (all entries removed, assets reverted to originals).

**History context** (`historyCtx`) — Undo/redo stacks
- **SHAPE:** `{ undoStack: HistoryAction[][], redoStack: HistoryAction[][] }`. Each batch is an array of `HistoryAction: { id: number | string, key: string, oldValue: string, newValue: string }`. Batches exist so multi-cell operations (e.g. paste) are one undo step.
- **LIFETIME:** Session-lived. Persists across commits — undo after commit creates new edits against the new baseline.

**New row context** (`newRowCtx`) — Uncommitted new rows
- **SHAPE:** Array of new row objects, each with `id: "NEW-N"` and empty fields. Spreading an empty array into the `assets` derived list adds nothing — no new rows simply means no extra items.
- **CLEARED:** On commit (successfully created rows removed). On discard (all removed).

**`frontend/src/lib/grid/components/new-row/`** — NewRow (component set: `.svelte` + `.svelte.ts`)
- **IS:** The new row manager that lives inside GridContainer's render tree.
- **`.svelte` DOES:** Render a single new row.
- **`.svelte.ts` DOES:** Manage NEW-N counter. `addRow()` — create row object with `NEW-N` ID and empty fields, push to `newRowCtx`. `deleteRow(id)` — splice by string ID. `clearRows()` — empty array, reset counter.
- **TO BE IMPLEMENTED:** Entire component set. Currently `rowGeneration.svelte.ts` handles this.

**ALL LEGACY CONTROLLERS DELETED.** The following files no longer exist:
- `gridSelection.svelte.ts` — selection logic inlined into GridOverlays
- `gridColumns.svelte.ts` — column widths local to GridOverlays, resize owned by GridHeader
- `gridRows.svelte.ts` — row height uses virtualScroll.rowHeight directly
- `gridClipboard.svelte.ts` — copy inlined into GridOverlays, paste TODO in EditHandler
- `gridShortcuts.svelte.ts` — listeners inlined into GridOverlays
- `gridHistory.svelte.ts`, `gridEdit.svelte.ts`, `gridChanges.svelte.ts`, `gridValidation.svelte.ts`, `rowGeneration.svelte.ts` — all deleted
- `interactionHandler.ts` — deleted
- `searchManager.svelte.ts` — deleted

**`frontend/src/lib/grid/utils/virtualScrollManager.svelte.ts`** — Virtual scroll state
- **IS:** The controller for virtual scrolling (which rows are visible based on scroll position)
- **DOES:** Track `scrollTop`, `containerHeight`. Derive `visibleRange` (startIndex/endIndex with overscan). Expose `getVisibleItems()`, `getTotalHeight()`, `getOffsetY()`, `handleScroll()`, `scrollToRow()`, `ensureVisible()`.

### Data Layer

**`frontend/src/lib/data/assetStore.svelte.ts`** — Asset data store
- **IS:** Module-level `$state` singleton for all server data. The single source of truth for asset data, locations, statuses, conditions, and departments.
- **DOES:** Export `assetStore` — a `$state({...})` object with `baseAssets`, `filteredAssets`, `locations`, `statuses`, `conditions`, `departments`. Seeded by `+page.svelte` on init. Mutated by `eventHandler.ts` after API calls. Imported directly by grid components and handlers.
- **DOES NOT:** Contain logic. Fetch data. Use contexts.

### Toast System

**`frontend/src/lib/toast/ToastContainer.svelte`** — Toast notification renderer
- **IS:** The fixed-position container that renders toast notifications
- **DOES:** Render toasts from `toastState` with fly transitions. Pause timer on hover, resume on leave.

**`frontend/src/lib/toast/toastState.svelte.ts`** — Toast state singleton
- **IS:** Global toast state with add/remove/pause/resume
- **DOES:** Manage toast array with auto-dismiss timers. Limit to 4 visible. Exported as `toastState` singleton.

### Realtime

**`frontend/src/lib/utils/interaction/realtimeManager.svelte.ts`** — WebSocket realtime manager
- **IS:** Singleton that manages WebSocket connection for multi-user presence and cell locking
- **DOES:** Connect/disconnect/reconnect with backoff. Send position updates, edit start/end. Track connected users and locked cells. Queue messages when disconnected. Reconnect on tab focus. Exported as `realtime` singleton.

### Types

**`frontend/src/lib/types.ts`** — Shared type definitions
- **IS:** Module exporting `User`, `SafeUser`, `Session` interfaces used across client and server.

### Layout and Routing

**`frontend/src/routes/+layout.server.ts`** — Root layout server load
- **DOES:** Read theme cookie, session color, session ID. Return `{ theme, url, user, session_color, sessionId }`.

**`frontend/src/routes/+layout.svelte`** — Root layout component
- **DOES:** Render app shell (header, navigation, user menu, theme toggle). Manage WebSocket connection lifecycle. Render `ToastContainer`. Import global CSS.

**`frontend/src/routes/login/`** — Login page
- **DOES:** `+page.server.ts` handles form action (authenticate, create session, set cookies). `+page.svelte` renders login form.

**`frontend/src/routes/logout/`** — Logout endpoint
- **DOES:** `+page.server.ts` handles form action (delete session, clear cookies, redirect).

**`frontend/src/routes/admin/`** — Admin section
- **DOES:** Admin panel with sub-pages for managing locations/statuses/conditions/departments (`[adminpage]`), user registration (`register`), and audit management (`audit`).

**`frontend/src/routes/mobile/`** — Mobile pages
- **DOES:** Mobile-optimized views for audit completion and asset management with barcode scanning.

**`frontend/src/routes/api/`** — API endpoints
- **DOES:** REST endpoints for asset CRUD (`api/assets`, `api/update`, `api/create/asset`), metadata CRUD (`api/create/[category]`, `api/delete/[category]`, `api/meta/[category]`, `api/update/[category]`), and audit operations (`api/audit/*`).

### Server Layer

**`frontend/src/hooks.server.ts`** — SvelteKit server hooks
- **DOES:** Run DB migrations on startup. Periodic session cleanup (hourly). Authenticate requests by reading `sessionId` cookie, looking up session, attaching `user` to `locals`.

**`frontend/src/lib/db/conn.ts`** — Database connection and schema
- **IS:** Kysely database instance and all table type definitions
- **DOES:** Define `Database` interface with all tables (`asset_inventory`, `users`, `sessions`, `change_log`, `asset_network_details`, `asset_ped_details`, `asset_audit`, etc.). Create connection pool via `MysqlDialect`. Export `db` singleton.

**`frontend/src/lib/db/`** — Database modules
- **`auth/`** — Session and user management: `createSession`, `deleteSession`, `cleanupExpiredSessions`, `createUser`, `findUserByUsername`.
- **`select/`** — Read queries: `getAssets`, `getLocations`, `getStatuses`, `getConditions`, `getDepartments`, `getAuditAssignments`, `queryAssets`, `columnDefinitions`.
- **`create/`** — Insert operations: `createAsset`, `createLocation`, `createStatus`, `createCondition`, `createDepartment`, `logChange`.
- **`update/`** — Update operations: `updateAsset`, `updateAdmin`.
- **`delete/`** — Delete operations: `deleteAdmin`.
- **`migrations/`** — Schema migrations: `createChangeLog`.

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
Validation is part of the edit flow, not a separate system. When a cell is saved (EditHandler), the edit logic checks if the value is valid (required field? valid value?). If invalid, the cell is marked in change state. No separate validation context or validation controller exists — it's just a check during save, and a flag in the change state. Constraints (allowed dropdown values) are a separate concern from validation — they are UI data for the edit dropdown.
