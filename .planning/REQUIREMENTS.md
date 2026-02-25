# Requirements: Architecture Rehaul

## Functional Requirements

### F1 — Context-Based State Management
- **F1.1** All grid-scoped managers must be provided via Svelte 5 `createContext` (returns [getter, setter] tuple)
- **F1.2** No module-level singleton may be imported directly inside grid components (GridRow, GridOverlays, GridContainer, FloatingEditor, ContextMenu)
- **F1.3** A `gridContext.svelte.ts` file must export typed getter/setter pairs for all shared grid state
- **F1.4** Global app-wide metadata (isEditing, hasUnsavedChanges, activeCellCoords) may use a lightweight global context
- **F1.5** Heavy data (assets array, dirtyCells Map, undo/redo stack) must be colocated in `<InventoryGrid>` as local `$state`

### F2 — Component Decomposition
- **F2.1** `+page.svelte` must become a thin route shell (< 100 lines) that renders `<InventoryGrid>` ✓ (02-01: +page.svelte is context owner)
- **F2.2** `<InventoryGrid>` owns all grid state and provides context to children ✓ (02-01: +page.svelte owns GridContext)
- **F2.3** `<GridContainer>` renders only visible rows via virtual scroll — ignorant of editors, menus, clipboard ✓ (02-02: GridContainer has zero forbidden imports)
- **F2.4** Each component has a corresponding `.svelte.ts` ViewModel/Controller with all logic ✓ (02-02: createPageController inline in +page.svelte)
- **F2.5** Components must not accept more than 3 props (use context for everything else) ✓ (02-02: GridContainer=3, GridOverlays=0, Toolbar=1)

### F3 — FloatingEditor Component
- **F3.1** `<FloatingEditor>` must live outside the grid DOM hierarchy
- **F3.2** It reads active cell coordinates from context and positions itself absolutely
- **F3.3** When no cell is active in edit mode, FloatingEditor unmounts/hides itself
- **F3.4** FloatingEditor handles all keyboard events (Enter/Escape/Tab), dropdown, and autocomplete
- **F3.5** FloatingEditor dispatches save/cancel events consumed by InventoryGrid

### F4 — Autonomous ContextMenu
- **F4.1** `<ContextMenu>` listens to global right-click coordinates from context
- **F4.2** It acts as an independent command dispatcher (Details, Edit, Copy, Filter)
- **F4.3** No parent orchestration required — ContextMenu reads and acts on context directly

### F5 — DB-Side Filtering & Search
- **F5.1** All filter/search queries must be executed server-side via Kysely
- **F5.2** `searchManager.getFilterItems()` client-side array filtering must be replaced with API calls
- **F5.3** Frontend maintains `baseAssets` (master list) and `filteredAssets` (query result)
- **F5.4** Clearing a filter re-points to `baseAssets` for zero-latency reset (no refetch)
- **F5.5** Search API endpoint must support multi-column filter combinations

### F6 — Draft Validation & Visual Feedback
- **F6.1** Edits stored in reactive `$state(new Map())` — Yellow=Invalid, Green=Valid overlay
- **F6.2** DB commit blocked until all drafts are valid
- **F6.3** Invalid cells show yellow overlay with border; valid show green

### F7 — Spatial Clipboard
- **F7.1** Copied ranges normalized to 0,0-indexed mini-grid in memory
- **F7.2** "Marching ants" dashed border overlay rendered around copied selection
- **F7.3** Paste operation maps mini-grid onto target position structurally

### F8 — Session Undo/Redo
- **F8.1** Ctrl+Z / Ctrl+Y traverse local edit history stack
- **F8.2** History tracks: edit number, coordinates, old value, new value
- **F8.3** History entries treated as uncommitted drafts until DB sync
- **F8.4** `historyManager.clearCommitted()` called after successful commit

### F9 — WebSocket Delta Sync
- **F9.1** On successful commit, broadcast only the specific changed cells to connected clients
- **F9.2** Clients patch their local asset array instantly without full refetch
- **F9.3** "Last write wins" collision resolution for concurrent edits
- **F9.4** Delta message format: `{ type: 'asset_update', payload: { id, key, value } }` (already partially implemented)

---

## Non-Functional Requirements

### NF1 — Zero Regressions
- All existing CRUD operations (edit, commit, new row, audit) must continue working
- Mobile routes (`/mobile/manage`, `/mobile/audit`) are out of scope — do not break them
- Admin pages are out of scope — do not break them

### NF2 — Incremental Migration
- Each phase must leave the application in a fully working, deployable state
- No "big bang" rewrites — migrate one concern at a time

### NF3 — Type Safety
- All new context types must be fully typed (no `any` in public APIs)
- `svelte-check --tsconfig ./tsconfig.json` must pass after each phase

### NF4 — Performance
- Virtual scroll must continue rendering only ~20 visible rows
- No full-page re-renders from context updates (use targeted context subscriptions)

---

## Out of Scope

- DB schema changes
- Mobile route refactoring
- Admin page refactoring
- Authentication changes
- Go WebSocket server protocol changes (additive only)
- Redesigning the visual UI (styling unchanged)
