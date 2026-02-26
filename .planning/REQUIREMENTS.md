# Requirements: Architecture Rehaul

## Functional Requirements

### F1 — Context-Based State Management
- **F1.1** Grid state must be split into ~10 separate domain contexts, each using Svelte 5 `createContext<T>()` returning `[getter, setter]` tuples
- **F1.2** No module-level singleton may be imported directly inside grid components (GridRow, GridOverlays, GridContainer, FloatingEditor, ContextMenu)
- **F1.3** `gridContext.svelte.ts` must export typed `[get*Context, set*Context]` pairs for each domain (editing, selection, clipboard, columns, rows, sort, validation, changes, data, view, etc.)
- **F1.4** Contexts are pure type + `createContext()` — no logic, no defaults, no factories in the context file
- **F1.5** `+page.svelte` calls `set*Context($state({...}))` for each domain with initial values — this is the only place contexts are initialized

### F2 — Component Architecture
- **F2.1** `+page.svelte` must be a thin route wrapper (< 60 lines): set contexts, render children, done
- **F2.2** Each component is independently deletable — removing any component must not break the rest of the app (it only removes that feature)
- **F2.3** `<GridContainer>` renders only visible rows via virtual scroll — ignorant of editors, menus, clipboard
- **F2.4** Controller logic lives inside the component that owns that domain — not created centrally in `+page.svelte`
- **F2.5** No `pageActions` callback pattern — components read/write context directly to communicate
- **F2.6** A renderless `DataController.svelte` owns URL-driven search, commit, discard, and addRows logic
- **F2.7** Props are for data a component genuinely needs from its parent; context is for shared state across siblings/descendants

### F3 — FloatingEditor Component
- **F3.1** `<FloatingEditor>` lives in GridOverlays (Layer 2, inside translateY-shifted virtual-chunk)
- **F3.2** It reads active cell coordinates from `editingContext` and positions itself absolutely
- **F3.3** When no cell is active in edit mode, FloatingEditor unmounts/hides itself
- **F3.4** FloatingEditor handles all keyboard events (Enter/Escape/Tab), dropdown, and autocomplete
- **F3.5** FloatingEditor saves/cancels by writing directly to `editingContext` — no callback dispatch to parent

### F4 — Autonomous ContextMenu
- **F4.1** `<ContextMenu>` reads right-click coordinates from `contextMenuContext`
- **F4.2** It acts as an independent command dispatcher (Details, Edit, Copy, Filter)
- **F4.3** No parent orchestration required — ContextMenu reads and acts on context directly

### F5 — DB-Side Filtering & Search
- [x] **F5.1** All filter/search queries must be executed server-side via Kysely *(05-01)*
- [x] **F5.2** `searchManager.getFilterItems()` client-side array filtering must be replaced with API calls *(05-01)*
- **F5.3** `DataController` manages `baseAssets` (master list) and `filteredAssets` (query result) via `dataContext`
- **F5.4** Clearing a filter re-points to `baseAssets` for zero-latency reset (no refetch)
- [x] **F5.5** Search API endpoint must support multi-column filter combinations *(05-01)*

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
- **F8.4** History cleared after successful commit

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
- Separate domain contexts minimize re-render blast radius — components subscribe only to contexts they need

---

## Out of Scope

- DB schema changes
- Mobile route refactoring
- Admin page refactoring
- Authentication changes
- Go WebSocket server protocol changes (additive only)
- Redesigning the visual UI (styling unchanged)
