# Architecture

**Analysis Date:** 2026-03-05

## Pattern Overview

**Overall:** Component-driven monolith with event-sourced mutation pipeline

**Key Characteristics:**
- SvelteKit full-stack app with Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`)
- Separate Go WebSocket server for realtime multi-user presence
- Serial event queue decouples UI triggers from side-effectful mutations (API calls, store updates)
- 12 typed Svelte contexts for ephemeral UI state; module-level `$state` singleton for bulk data
- Virtual scrolling grid as the primary UI — spreadsheet-like asset editor

## Layers

**Page Layer (Server + Client Entry):**
- Purpose: Load data from MariaDB, seed client stores, render component tree
- Location: `frontend/src/routes/+page.server.ts`, `frontend/src/routes/+page.svelte`
- Contains: Server load function (Kysely queries), client `$props()` destructuring, store seeding
- Depends on: `$lib/db/select/*`, `$lib/data/assetStore.svelte.ts`
- Used by: Nothing (top-level entry)

**Context Layer (Ephemeral UI State):**
- Purpose: Provide typed reactive state shells for transient UI concerns (editing position, selection, panel visibility, pending changes)
- Location: `frontend/src/lib/context/gridContext.svelte.ts` (types + getter/setter pairs), `frontend/src/lib/context/GridContextProvider.svelte` (initialization)
- Contains: 12 context types (`EditingContext`, `PendingContext`, `HistoryContext`, `NewRowContext`, `SelectionContext`, `ClipboardContext`, `RowContext`, `ViewContext`, `UiContext`, `QueryContext`, `ColumnWidthContext`, `SortContext`), each with `[getXContext, setXContext]` via Svelte `createContext()`
- Depends on: `svelte` (`createContext`), `svelte/reactivity` (`SvelteMap`), `$lib/grid/utils/virtualScrollManager.svelte.ts`
- Used by: All grid components that need shared ephemeral state

**Data Layer (Bulk Data Store):**
- Purpose: Single source of truth for server-loaded asset data and metadata
- Location: `frontend/src/lib/data/assetStore.svelte.ts`
- Contains: Module-level `$state` singleton with `baseAssets`, `filteredAssets`, `locations`, `statuses`, `conditions`, `departments`
- Depends on: Nothing (pure state container)
- Used by: `+page.svelte` (seeding), `eventHandler.ts` (mutation after API), grid components (reading)

**Event Pipeline Layer (Mutation Bus):**
- Purpose: Serialize all state-mutating operations (commits, queries, discards) through a FIFO queue
- Location: `frontend/src/lib/grid/eventQueue/`
- Contains: `EventListener.svelte` (watches context trigger flags, snapshots payloads, enqueues), `eventQueue.ts` (pure TS FIFO), `eventHandler.ts` (routes events to target functions that call APIs and mutate proxies)
- Depends on: Contexts (via `getXContext()` in EventListener only), `assetStore`, `toastState`
- Used by: EventListener is rendered in `+page.svelte`; target functions are the only path for data mutations

**Grid Component Layer (UI):**
- Purpose: Render the spreadsheet grid with virtual scrolling, selection overlays, inline editing
- Location: `frontend/src/lib/grid/components/`
- Contains: `grid-container/` (scroll viewport), `grid-overlays/` (interaction + visual feedback), `grid-header/` (columns, sort, resize, header menu), `grid-row/` (cell rendering), `edit-handler/` (inline editor), `toolbar/` (search, filters, actions), menus (`context-menu/`, `header-menu/`, `edit-dropdown/`, `filter-panel/`, `suggestion-menu/`)
- Depends on: Contexts, `assetStore`, `realtime` singleton
- Used by: Composed inside `GridContainer` which is rendered by `+page.svelte`

**Database Layer (Server-Only):**
- Purpose: All MariaDB access via Kysely ORM
- Location: `frontend/src/lib/db/`
- Contains: `conn.ts` (connection pool + all table type definitions), `select/` (read queries), `create/` (inserts), `update/` (updates), `delete/` (deletes), `auth/` (session/user management), `migrations/` (schema migrations)
- Depends on: `kysely`, `mysql2`, `$env/static/private`
- Used by: `+page.server.ts`, `hooks.server.ts`, API route handlers (`frontend/src/routes/api/`)

**API Route Layer (SvelteKit Endpoints):**
- Purpose: REST endpoints consumed by the client event handler
- Location: `frontend/src/routes/api/`
- Contains: `assets/+server.ts` (query), `update/+server.ts` (bulk update), `create/asset/+server.ts` (create rows), `create/[category]/+server.ts`, `delete/[category]/+server.ts`, `meta/[category]/+server.ts`, `update/[category]/+server.ts` (admin CRUD), `audit/*` (audit operations)
- Depends on: `$lib/db/*`
- Used by: `eventHandler.ts` (via `fetch()`), admin pages, mobile pages

**Realtime Layer (WebSocket):**
- Purpose: Multi-user presence (cursor positions, cell locking) via WebSocket
- Location: `frontend/src/lib/utils/interaction/realtimeManager.svelte.ts` (client), `api/main.go` + `api/internal/hub.go` (server)
- Contains: Client singleton (`realtime`) with `$state` for `connectedUsers` and `lockedCells`. Go server with WebSocket hub, CORS, connection pooling.
- Depends on: `$env/static/public` (WS URL), Go `database/sql` + `github.com/go-sql-driver/mysql`
- Used by: `+layout.svelte` (connect/disconnect lifecycle), `GridOverlays.svelte` (other-user cursor rendering)

**Toast Layer (Notifications):**
- Purpose: User-facing toast notifications
- Location: `frontend/src/lib/toast/toastState.svelte.ts` (state singleton), `frontend/src/lib/toast/ToastContainer.svelte` (renderer)
- Contains: `toastState` module-level singleton with `addToast()`, auto-dismiss timers
- Depends on: Nothing
- Used by: `eventHandler.ts`, `GridOverlays.svelte`, any component needing user feedback

## Data Flow

**Page Load (Server to Client):**

1. `+page.server.ts` calls `queryAssets()` + metadata getters via Kysely
2. Returns `{ assets, locations, statuses, conditions, departments, initialView }` to client
3. `+page.svelte` receives via `$props()`, seeds `assetStore` fields
4. `GridContextProvider` initializes 12 empty context shells
5. Grid components read `assetStore` and contexts to render

**Cell Edit (User Action to Persistence):**

1. User double-clicks cell or presses F2 in `GridOverlays.svelte`
2. `GridOverlays` writes to `editingCtx` (`isEditing=true`, `editRow`, `editCol`)
3. `EditHandler.svelte` renders textarea at computed position
4. User types, saves; `EditHandler` upserts into `pendingCtx.edits[]`
5. `filteredAssets` stays CLEAN; pending values render as overlays in `GridOverlays`
6. User clicks Commit in `Toolbar`; sets `uiCtx.commitRequested = true`
7. `EventListener` `$effect` fires, snapshots `pendingCtx.edits`, enqueues `COMMIT_UPDATE`
8. `eventQueue.ts` processes serially, calls `eventHandler.ts` `handleCommitUpdate()`
9. Handler POSTs to `/api/update`, on success mutates `assetStore.filteredAssets` + `baseAssets`, clears `pendingCtx.edits`

**Query (Search/Filter/View Change):**

1. Component writes to `queryCtx` (view, q, or filters)
2. `EventListener` `$effect` detects change (skips first run), resets sort, enqueues `QUERY`
3. `handleQuery()` fetches `/api/assets` with params
4. On success, updates `assetStore.filteredAssets` (and `baseAssets` if no filters active)

**State Management:**
- **Bulk data:** `assetStore` module-level `$state` singleton, imported directly
- **Ephemeral UI:** 12 Svelte contexts via `createContext()`, initialized in `GridContextProvider`, accessed via `getXContext()` in components
- **Singletons:** `realtime` (WebSocket), `toastState` (notifications) are module-level `$state` objects
- **No optimistic mutation:** `filteredAssets` stays clean during editing; pending edits are rendered as overlays

## Key Abstractions

**Event Queue Pipeline:**
- Purpose: Decouple UI triggers from async side effects (API calls, store mutations)
- Examples: `frontend/src/lib/grid/eventQueue/EventListener.svelte`, `frontend/src/lib/grid/eventQueue/eventQueue.ts`, `frontend/src/lib/grid/eventQueue/eventHandler.ts`
- Pattern: Smart Owner (EventListener grabs contexts) -> FIFO Queue (pure TS) -> Router (switches on event type, mutates context proxies directly)

**Context Shells:**
- Purpose: Typed ephemeral state that multiple components share without prop drilling
- Examples: `frontend/src/lib/context/gridContext.svelte.ts`, `frontend/src/lib/context/GridContextProvider.svelte`
- Pattern: `createContext<T>()` returns `[getter, setter]` tuple. Provider initializes `$state({...})` and calls setter. Consumers call getter.

**Virtual Scroll Manager:**
- Purpose: Factory-created reactive object managing which rows are visible based on scroll position
- Examples: `frontend/src/lib/grid/utils/virtualScrollManager.svelte.ts`
- Pattern: Factory function returns object with `$state` + `$derived` internals, exposed as getter properties and methods. Instance stored in `ViewContext`.

**Component Sets (`.svelte` + `.svelte.ts`):**
- Purpose: Separate rendering from state management within a single component
- Examples: `edit-handler/EditHandler.svelte` + `editHandler.svelte.ts`, `context-menu/contextMenu.svelte` + `contextMenu.svelte.ts`, `header-menu/headerMenu.svelte` (has inline state management)
- Pattern: `.svelte` handles rendering and event binding. `.svelte.ts` exports state classes/functions/helpers. Component imports from its companion `.svelte.ts`.

**Panel System:**
- Purpose: Mutually exclusive visibility for context menu, header menu, filter panel
- Examples: `GridOverlays.svelte` `setOpenPanel()` function
- Pattern: All panels use `uiCtx` visibility flags. `setOpenPanel(panel?)` closes all others. `onWindowClick` in `GridOverlays` handles the two-step toggle (close all, then check if click was on a trigger to re-open).

## Entry Points

**SvelteKit Server Hook:**
- Location: `frontend/src/hooks.server.ts`
- Triggers: Every HTTP request
- Responsibilities: Run DB migrations on first request. Periodic session cleanup (hourly). Authenticate requests by reading `sessionId` cookie, looking up session, attaching `user` to `event.locals`.

**Main Page (Grid):**
- Location: `frontend/src/routes/+page.server.ts` + `frontend/src/routes/+page.svelte`
- Triggers: Navigation to `/` (or `/asset/` with base path)
- Responsibilities: Load assets + metadata from DB, redirect mobile users, seed `assetStore`, render grid

**Go WebSocket Server:**
- Location: `api/main.go`
- Triggers: Application startup (separate process, port 8080)
- Responsibilities: WebSocket hub for realtime presence. Single endpoint: `/api/ws`. Manages user connections, position broadcasts, cell locking.

**API Endpoints:**
- Location: `frontend/src/routes/api/`
- Triggers: Client-side `fetch()` from `eventHandler.ts` or form actions
- Responsibilities: Asset CRUD, metadata CRUD, audit operations

## Error Handling

**Strategy:** Toast notifications for user-facing errors; console.error for dev diagnostics; event queue catches errors to prevent queue death.

**Patterns:**
- `eventQueue.ts`: try/catch around `processEvent()` with `console.error` — queue always continues
- `eventHandler.ts`: Check `ApiResult.success`, show `toastState.addToast('...', 'error')` on failure, return early
- `+page.server.ts`: try/catch around DB queries, returns `dbError` string to client
- `hooks.server.ts`: Catches migration errors silently (table likely exists), catches cleanup errors with `console.error`
- `realtimeManager.svelte.ts`: WebSocket `onerror` forces close to trigger reconnect; exponential backoff with 10s cap

## Cross-Cutting Concerns

**Logging:** `console.error` / `console.warn` only. No structured logging framework.

**Validation:** Part of the edit flow, not a separate system. When a cell is saved, the edit logic checks validity and marks the `isValid` flag in `pendingCtx.edits[]`. No separate validation context.

**Authentication:** Cookie-based sessions. `hooks.server.ts` reads `sessionId` cookie on every request, looks up session in DB, attaches `user` to `event.locals`. No client-side auth state beyond what `+layout.server.ts` passes down.

**Panel Exclusivity:** `setOpenPanel()` in `GridOverlays.svelte` ensures only one panel (context menu, header menu, filter panel) is visible at a time.

---

*Architecture analysis: 2026-03-05*
