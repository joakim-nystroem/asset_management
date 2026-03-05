# Codebase Structure

**Analysis Date:** 2026-03-05

## Directory Layout

```
asset_management/
├── api/                          # Go WebSocket server (separate process)
│   ├── main.go                   # Entry point, DB connection, HTTP server on :8080
│   ├── internal/
│   │   └── hub.go                # WebSocket hub (presence, cell locking, broadcasts)
│   ├── metadata/                 # Internal docs (overview.md, internal.md)
│   ├── go.mod                    # Go module definition
│   ├── go.sum                    # Go dependency lock
│   └── Dockerfile                # Container build for Go API
├── frontend/                     # SvelteKit application
│   ├── src/
│   │   ├── app.css               # Global CSS (Tailwind)
│   │   ├── app.d.ts              # SvelteKit type augmentation (App.Locals)
│   │   ├── app.html              # HTML shell template
│   │   ├── hooks.server.ts       # Server hook (auth, migrations, session cleanup)
│   │   ├── lib/                  # Shared library code ($lib alias)
│   │   │   ├── assets/           # Static assets (favicon.svg)
│   │   │   ├── context/          # Svelte context definitions + provider
│   │   │   ├── data/             # Data store (assetStore singleton)
│   │   │   ├── db/               # Database layer (Kysely ORM)
│   │   │   ├── grid/             # Grid system (components + event queue + utils)
│   │   │   ├── toast/            # Toast notification system
│   │   │   ├── types.ts          # Shared type definitions (User, Session)
│   │   │   └── utils/            # Utility modules
│   │   └── routes/               # SvelteKit file-based routing
│   │       ├── +layout.server.ts # Root layout server load (theme, session, user)
│   │       ├── +layout.svelte    # Root layout (header, nav, WS lifecycle, toast)
│   │       ├── +page.server.ts   # Main page server load (assets, metadata)
│   │       ├── +page.svelte      # Main page (seeds store, renders grid)
│   │       ├── admin/            # Admin section
│   │       ├── api/              # REST API endpoints
│   │       ├── login/            # Login page
│   │       ├── logout/           # Logout endpoint
│   │       └── mobile/           # Mobile-optimized views
│   ├── package.json              # Node dependencies
│   ├── svelte.config.js          # SvelteKit config (base path: /asset)
│   ├── tsconfig.json             # TypeScript config
│   ├── vite.config.ts            # Vite config
│   └── tailwind.config.ts        # Tailwind CSS config
├── CLAUDE.md                     # Project instructions and target architecture
└── .gitignore                    # Git ignore rules
```

## Directory Purposes

**`frontend/src/lib/context/`**
- Purpose: Svelte context type definitions and initialization
- Contains: 2 files
- Key files:
  - `gridContext.svelte.ts`: Defines 12 context types + `[getXContext, setXContext]` pairs via `createContext()`
  - `GridContextProvider.svelte`: Initializes all 12 contexts as `$state({...})` objects, calls setters, renders `{@render children()}`

**`frontend/src/lib/data/`**
- Purpose: Module-level data singletons
- Contains: 1 file
- Key files:
  - `assetStore.svelte.ts`: `$state` singleton with `baseAssets`, `filteredAssets`, `locations`, `statuses`, `conditions`, `departments`

**`frontend/src/lib/db/`**
- Purpose: All database access (server-only, Kysely ORM)
- Contains: Connection setup, table types, CRUD operations organized by operation type
- Key files:
  - `conn.ts`: Kysely instance, `Database` interface with all table definitions, connection pool
  - `auth/`: `createSession.ts`, `deleteSession.ts`, `cleanupExpiredSessions.ts`, `createUser.ts`, `findUserByUsername.ts`, `findSessionById.ts`
  - `select/`: `getAssets.ts`, `queryAssets.ts`, `getLocations.ts`, `getStatuses.ts`, `getConditions.ts`, `getDepartments.ts`, `getAuditAssignments.ts`, `columnDefinitions.ts`
  - `create/`: `createAsset.ts`, `createLocation.ts`, `createStatus.ts`, `createCondition.ts`, `createDepartment.ts`, `logChange.ts`
  - `update/`: `updateAsset.ts`, `updateAdmin.ts`
  - `delete/`: `deleteAdmin.ts`
  - `migrations/`: `createChangeLog.ts`

**`frontend/src/lib/grid/`**
- Purpose: The entire grid system (the core of the app)
- Contains: Components, event queue, utility managers, config
- Key files:
  - `gridConfig.ts`: `DEFAULT_WIDTH` (150px), `MIN_COLUMN_WIDTH` (50px)
  - `eventQueue/`: The event pipeline (EventListener, eventQueue, eventHandler)
  - `components/`: All grid UI components (see below)
  - `utils/virtualScrollManager.svelte.ts`: Factory for virtual scroll state object

**`frontend/src/lib/grid/components/`**
- Purpose: All grid UI components, each in its own directory
- Contains: 11 component directories, each with `.svelte` (rendering) and optional `.svelte.ts` (state/logic)
- Subdirectories:
  - `grid-container/`: `GridContainer.svelte` - scroll viewport, virtual scroll integration
  - `grid-overlays/`: `GridOverlays.svelte` - ALL user input (keyboard, mouse), selection/copy/dirty overlays, panel management
  - `grid-header/`: `GridHeader.svelte` - column headers, sort indicators, resize handles
  - `grid-row/`: `GridRow.svelte` - single data row rendering
  - `edit-handler/`: `EditHandler.svelte` + `editHandler.svelte.ts` - inline cell editor
  - `toolbar/`: `Toolbar.svelte` - search, filters, view selector, commit/discard buttons
  - `context-menu/`: `contextMenu.svelte` + `contextMenu.svelte.ts` - right-click cell menu
  - `header-menu/`: `headerMenu.svelte` - column header dropdown (sort + filter)
  - `edit-dropdown/`: `editDropdown.svelte` + `editDropdown.svelte.ts` - constrained column dropdown
  - `filter-panel/`: `filterPanel.svelte` + `filterPanel.svelte.ts` - active filter display
  - `suggestion-menu/`: `autocomplete.svelte` + `autocomplete.svelte.ts` - free-text suggestions

**`frontend/src/lib/toast/`**
- Purpose: Toast notification system
- Contains: 2 files
- Key files:
  - `toastState.svelte.ts`: Module-level singleton with `addToast()`, auto-dismiss
  - `ToastContainer.svelte`: Fixed-position renderer with fly transitions

**`frontend/src/lib/utils/`**
- Purpose: Utility modules not specific to the grid
- Contains: 1 subdirectory
- Key files:
  - `interaction/realtimeManager.svelte.ts`: WebSocket client singleton for multi-user presence

**`frontend/src/routes/api/`**
- Purpose: SvelteKit API endpoints (server-only `+server.ts` files)
- Contains: REST endpoints for assets, metadata CRUD, audit operations
- Key files:
  - `assets/+server.ts`: GET query assets (view, search, filter)
  - `update/+server.ts`: POST bulk update assets
  - `create/asset/+server.ts`: POST create new assets
  - `create/[category]/+server.ts`: POST create metadata (location, status, etc.)
  - `delete/[category]/+server.ts`: DELETE metadata
  - `meta/[category]/+server.ts`: GET metadata by category
  - `update/[category]/+server.ts`: PUT update metadata
  - `audit/`: 6 endpoints for audit lifecycle (assign, bulk-assign, start, complete, close, status)

**`frontend/src/routes/admin/`**
- Purpose: Admin panel pages
- Contains: Layout, index, and sub-pages
- Key files:
  - `+layout.server.ts`, `+layout.svelte`: Admin layout with auth guard
  - `+page.svelte`: Admin index
  - `[adminpage]/+page.server.ts` + `+page.svelte`: Dynamic admin pages (locations, statuses, conditions, departments)
  - `register/`: User registration
  - `audit/`: Audit management

**`frontend/src/routes/mobile/`**
- Purpose: Mobile-optimized views
- Contains: Index + sub-pages
- Key files:
  - `+page.svelte`: Mobile landing
  - `audit/`: Mobile audit completion (barcode scanning via html5-qrcode)
  - `manage/`: Mobile asset management

**`api/`**
- Purpose: Go WebSocket server (runs as separate process on port 8080)
- Contains: Entry point + internal hub
- Key files:
  - `main.go`: HTTP server setup, DB connection, CORS, routes `/api/ws`
  - `internal/hub.go`: WebSocket hub implementation (user tracking, broadcasts, cell locking)

## Key File Locations

**Entry Points:**
- `frontend/src/hooks.server.ts`: Server hook (runs on every request - auth, migrations)
- `frontend/src/routes/+page.server.ts`: Main page data loader
- `frontend/src/routes/+page.svelte`: Main page component (seeds store, renders grid)
- `frontend/src/routes/+layout.svelte`: Root layout (header, nav, WebSocket lifecycle)
- `api/main.go`: Go WebSocket server entry

**Configuration:**
- `frontend/svelte.config.js`: SvelteKit config (base path `/asset`, adapter-node)
- `frontend/vite.config.ts`: Vite bundler config
- `frontend/tsconfig.json`: TypeScript config
- `frontend/tailwind.config.ts`: Tailwind CSS config
- `frontend/src/lib/grid/gridConfig.ts`: Grid constants (column widths)

**Core Logic:**
- `frontend/src/lib/grid/eventQueue/eventHandler.ts`: All mutation logic (commit, query, discard)
- `frontend/src/lib/grid/eventQueue/EventListener.svelte`: Event trigger watcher
- `frontend/src/lib/grid/eventQueue/eventQueue.ts`: FIFO queue processor
- `frontend/src/lib/grid/components/grid-overlays/GridOverlays.svelte`: All user interaction handling
- `frontend/src/lib/grid/components/edit-handler/EditHandler.svelte`: Inline cell editor
- `frontend/src/lib/grid/components/edit-handler/editHandler.svelte.ts`: Editor position computation
- `frontend/src/lib/context/gridContext.svelte.ts`: All context type definitions
- `frontend/src/lib/data/assetStore.svelte.ts`: Asset data store singleton
- `frontend/src/lib/db/conn.ts`: Database connection + all table type definitions

**Testing:**
- No test files exist in the codebase.

## Naming Conventions

**Files:**
- Components: `PascalCase.svelte` for primary components (`GridContainer.svelte`, `EditHandler.svelte`), `camelCase.svelte` for secondary/menu components (`contextMenu.svelte`, `headerMenu.svelte`, `filterPanel.svelte`)
- Companion logic: `camelCase.svelte.ts` matching the component name (`editHandler.svelte.ts`, `contextMenu.svelte.ts`)
- Pure TS modules: `camelCase.ts` (`eventQueue.ts`, `eventHandler.ts`, `gridConfig.ts`)
- Svelte stores/state: `camelCase.svelte.ts` (`assetStore.svelte.ts`, `toastState.svelte.ts`)
- DB operations: `camelCase.ts` named after the operation (`getAssets.ts`, `createSession.ts`, `updateAsset.ts`)
- SvelteKit routes: `+page.svelte`, `+page.server.ts`, `+server.ts`, `+layout.svelte`, `+layout.server.ts`

**Directories:**
- Grid components: `kebab-case/` (`grid-container/`, `edit-handler/`, `context-menu/`)
- DB operations: `lowercase/` by operation type (`select/`, `create/`, `update/`, `delete/`, `auth/`)
- Routes: `lowercase/` or `[param]/` for dynamic segments (`admin/`, `[adminpage]/`, `[category]/`)

## Where to Add New Code

**New Grid Feature (e.g., undo/redo):**
- Context type: Add to `frontend/src/lib/context/gridContext.svelte.ts`
- Context init: Add to `frontend/src/lib/context/GridContextProvider.svelte`
- UI trigger: Add `$effect` watcher in `frontend/src/lib/grid/eventQueue/EventListener.svelte`
- Mutation logic: Add event type handler in `frontend/src/lib/grid/eventQueue/eventHandler.ts`
- Keyboard shortcut: Add to `handleKeyDown()` in `frontend/src/lib/grid/components/grid-overlays/GridOverlays.svelte`

**New Grid Component:**
- Create directory: `frontend/src/lib/grid/components/your-component/`
- Rendering: `YourComponent.svelte` or `yourComponent.svelte`
- State/logic: `yourComponent.svelte.ts` (companion module)
- Render inside: `GridContainer.svelte` (if grid-level) or appropriate parent

**New API Endpoint:**
- REST endpoint: `frontend/src/routes/api/your-endpoint/+server.ts`
- DB query: `frontend/src/lib/db/select/yourQuery.ts` (or `create/`, `update/`, `delete/`)
- Client call: Add to `eventHandler.ts` target functions (if event-driven) or call directly from component

**New DB Table or Column:**
- Table type: Add interface in `frontend/src/lib/db/conn.ts`
- Register in `Database` interface in `frontend/src/lib/db/conn.ts`
- Migration: Add to `frontend/src/lib/db/migrations/`
- CRUD functions: Add to appropriate `frontend/src/lib/db/{select,create,update,delete}/` directory

**New Admin Page:**
- Page: `frontend/src/routes/admin/your-page/+page.svelte` + `+page.server.ts`
- Follows existing `[adminpage]` pattern for metadata CRUD

**New Mobile Page:**
- Page: `frontend/src/routes/mobile/your-page/+page.svelte` + `+page.server.ts`

**Shared Types:**
- Client types: `frontend/src/lib/types.ts`
- DB table types: `frontend/src/lib/db/conn.ts`
- Context types: `frontend/src/lib/context/gridContext.svelte.ts`

**Utilities:**
- Grid-specific helpers: `frontend/src/lib/grid/utils/`
- General utilities: `frontend/src/lib/utils/`
- Interaction/realtime: `frontend/src/lib/utils/interaction/`

## Special Directories

**`frontend/.svelte-kit/`**
- Purpose: SvelteKit generated output (types, build artifacts, adapter output)
- Generated: Yes (by `svelte-kit sync` and builds)
- Committed: No (gitignored)

**`frontend/src/routes/api/`**
- Purpose: Server-only API endpoints (SvelteKit `+server.ts` convention)
- Generated: No
- Committed: Yes

**`api/`**
- Purpose: Separate Go WebSocket server (runs independently on port 8080)
- Generated: No
- Committed: Yes
- Note: This is NOT part of the SvelteKit app. It runs as a separate process.

**`.planning/`**
- Purpose: Project planning documents (phases, research, codebase analysis)
- Generated: No (manually created)
- Committed: Yes

---

*Structure analysis: 2026-03-05*
