# Codebase Structure

**Analysis Date:** 2025-02-25

## Directory Layout

```
asset_management/
├── frontend/                     # SvelteKit application
│   ├── src/
│   │   ├── routes/              # SvelteKit file-based routing
│   │   │   ├── +layout.svelte   # Root layout wrapper
│   │   │   ├── +layout.server.ts # Root server load
│   │   │   ├── +page.svelte     # Dashboard redirect
│   │   │   ├── login/           # Authentication page
│   │   │   ├── logout/          # Session termination
│   │   │   ├── admin/           # Admin dashboard
│   │   │   │   ├── +layout.svelte
│   │   │   │   ├── +layout.server.ts
│   │   │   │   ├── [adminpage]/ # Dynamic metadata pages (locations, statuses, etc)
│   │   │   │   ├── audit/       # Audit management page
│   │   │   │   └── register/    # User registration
│   │   │   ├── mobile/          # Mobile views
│   │   │   │   ├── manage/      # Mobile asset management
│   │   │   │   └── audit/       # Mobile audit capture
│   │   │   └── api/             # REST API endpoints
│   │   │       ├── assets/      # Asset queries
│   │   │       ├── audit/       # Audit operations (start, close, assign, complete, bulk-assign)
│   │   │       ├── create/      # Create items (assets, metadata)
│   │   │       ├── delete/      # Delete items
│   │   │       ├── meta/        # Metadata fetching
│   │   │       ├── search/      # Asset search
│   │   │       └── update/      # Asset and metadata updates
│   │   ├── lib/
│   │   │   ├── db/              # Database layer
│   │   │   │   ├── conn.ts      # Kysely instance, table schemas
│   │   │   │   ├── auth/        # Authentication operations (createUser, createSession, findUserByUsername, etc)
│   │   │   │   ├── select/      # Query builders (getAssets, getAuditAssignments, searchAssets, etc)
│   │   │   │   ├── create/      # Insert operations (createAsset, createStatus, logChange, etc)
│   │   │   │   ├── update/      # Update operations (updateAsset, updateAdmin, etc)
│   │   │   │   ├── delete/      # Delete operations (deleteAdmin, etc)
│   │   │   │   └── migrations/  # Schema setup (createChangeLog, createAuditTables)
│   │   │   ├── components/
│   │   │   │   └── grid/        # Grid display components (GridRow, GridHeader, Toolbar, GridOverlays)
│   │   │   ├── utils/           # Utility managers and UI components
│   │   │   │   ├── core/        # Core managers (columnManager, rowManager, viewManager, virtualScrollManager)
│   │   │   │   ├── data/        # Data managers (searchManager, sortManager, validationManager)
│   │   │   │   ├── interaction/ # Interaction managers (editManager, selectionManager, changeManager, historyManager, etc)
│   │   │   │   └── ui/          # UI components (contextMenu, editDropdown, filterPanel, autocomplete, toast, etc)
│   │   │   ├── assets/          # Static assets (images, icons)
│   │   │   └── types.ts         # Shared TypeScript types (User, Session, SafeUser)
│   │   └── hooks.server.ts      # Session middleware
│   ├── package.json             # Dependencies (Svelte 5, SvelteKit, Kysely, Tailwind, bcrypt)
│   ├── tsconfig.json            # TypeScript config
│   ├── vite.config.ts           # Vite config
│   └── tailwind.config.ts       # Tailwind CSS config
├── .planning/                   # Planning documents (generated)
│   ├── codebase/                # Architecture/structure analysis
│   └── phases/                  # Implementation phases
└── .git/                        # Git repository
```

## Directory Purposes

**`frontend/src/routes/`:**
- Purpose: File-based routing - SvelteKit maps directory structure to URL routes
- Contains: `.svelte` page components, `.server.ts` route handlers
- Key files: `+layout.svelte` (wraps pages), `+page.svelte` (renders page), `+server.ts` (API endpoint)

**`frontend/src/routes/api/`:**
- Purpose: REST API endpoints for frontend-to-backend communication
- Contains: GET/POST/PUT/DELETE handlers for assets, audit, metadata operations
- Key files: `+server.ts` in each subdirectory (e.g., `/api/assets/+server.ts`)

**`frontend/src/lib/db/`:**
- Purpose: All database interactions through Kysely ORM
- Contains: Connection setup, table schemas, query builders, CRUD functions
- Sub-directories:
  - `auth/`: User/session management
  - `select/`: Query builders for reading data
  - `create/`: Insert operations
  - `update/`: Update operations
  - `delete/`: Delete operations
  - `migrations/`: Schema initialization

**`frontend/src/lib/components/grid/`:**
- Purpose: Reusable grid display components (shared by admin and mobile views)
- Contains: `GridRow.svelte` (cell editing), `GridHeader.svelte` (column headers), `Toolbar.svelte` (actions), `GridOverlays.svelte` (overlays)

**`frontend/src/lib/utils/`:**
- Purpose: State managers and UI helpers organized by domain
- Sub-directories:
  - `core/`: Fundamental managers (columns, rows, views, virtual scroll)
  - `data/`: Data transformation (sorting, searching, validation)
  - `interaction/`: User interactions (editing, selection, change tracking, history)
  - `ui/`: Reusable UI components and their state managers (dropdowns, autocomplete, context menus, toasts)

## Key File Locations

**Entry Points:**

- `frontend/src/routes/+layout.svelte`: Root layout - loads theme, user, passes to all pages
- `frontend/src/routes/+layout.server.ts`: Root loader - fetches theme, user, session info from cookies
- `frontend/src/hooks.server.ts`: Global middleware - validates session, populates `event.locals.user`

**Database Setup:**

- `frontend/src/lib/db/conn.ts`: Kysely instance, all table type definitions
- `frontend/src/lib/db/migrations/createChangeLog.ts`: Schema initialization for audit tables

**Core Logic:**

- `frontend/src/lib/db/select/getAssets.ts`: Query builder for fetching asset inventory
- `frontend/src/lib/db/update/updateAsset.ts`: Update asset and log changes
- `frontend/src/lib/db/auth/createSession.ts`: Session creation with expiry
- `frontend/src/lib/db/auth/findSessionById.ts`: Session validation

**Grid Management:**

- `frontend/src/lib/utils/core/columnManager.svelte.ts`: Column width state, resize handlers
- `frontend/src/lib/utils/core/rowManager.svelte.ts`: Row height adjustments
- `frontend/src/lib/utils/interaction/editManager.svelte.ts`: Edit state, save/cancel logic
- `frontend/src/lib/utils/interaction/selectionManager.svelte.ts`: Cell selection, multi-select

**Admin Pages:**

- `frontend/src/routes/admin/+page.svelte`: Admin menu
- `frontend/src/routes/admin/[adminpage]/+page.svelte`: Dynamic metadata CRUD (locations, statuses, departments, conditions)
- `frontend/src/routes/admin/audit/+page.svelte`: Audit cycle management with filtering and bulk operations

**API Endpoints:**

- `frontend/src/routes/api/assets/+server.ts`: GET all assets
- `frontend/src/routes/api/update/+server.ts`: PUT asset updates (core grid edits)
- `frontend/src/routes/api/audit/start/+server.ts`: POST create audit cycle
- `frontend/src/routes/api/audit/close/+server.ts`: POST close audit and archive

## Naming Conventions

**Files:**

- Route pages: `+page.svelte` (component), `+page.server.ts` (server load)
- API handlers: `+server.ts` in `api/` directories
- Managers: `*Manager.svelte.ts` (e.g., `editManager.svelte.ts`, `columnManager.svelte.ts`)
- Components: `*.svelte` (e.g., `GridRow.svelte`, `ToastContainer.svelte`)
- Database functions: `verb + noun` (e.g., `getAssets.ts`, `createSession.ts`, `updateAsset.ts`, `logChange.ts`)

**Directories:**

- Database operations organized by verb: `select/`, `create/`, `update/`, `delete/`, `auth/`
- Managers organized by domain: `core/`, `data/`, `interaction/`, `ui/`
- Feature routes as lowercase: `admin/`, `mobile/`, `api/`
- Dynamic segments in square brackets: `[adminpage]/`, `[category]/`

**Variables & Functions:**

- camelCase for all functions and variables
- PascalCase for types and interfaces (e.g., `SafeUser`, `EditManager`)
- UPPERCASE for constants (e.g., `ALLOWED_COLUMNS`, `CLEANUP_INTERVAL`, `VIEW_CONFIGS`)
- `$state` for reactive variables in Svelte 5
- `$derived` for computed properties
- `$effect` for side effects

## Where to Add New Code

**New Feature (e.g., Asset Reports):**

1. **API Endpoint:** Create `frontend/src/routes/api/reports/+server.ts`
2. **Database Query:** Create `frontend/src/lib/db/select/getReports.ts`
3. **Page Route:** Create `frontend/src/routes/admin/reports/+page.svelte` and `+page.server.ts`
4. **Tests:** Add to `.test.ts` file alongside implementation

**New Grid Column Type:**

1. Add `ColumnType<>` definition to `frontend/src/lib/db/conn.ts` in relevant table interface
2. Update query builder in `frontend/src/lib/db/select/getAssets.ts` to include column
3. Add column key to `columnDefinitions.ts` if special formatting needed
4. Update `columnManager` in `frontend/src/lib/utils/core/columnManager.svelte.ts` if special width handling
5. Update allowed columns whitelist in `frontend/src/routes/api/update/+server.ts`

**New Metadata Type (similar to Status, Condition):**

1. Create table in database (MariaDB)
2. Add `*Table` interface to `frontend/src/lib/db/conn.ts`
3. Add to `Database` interface in `conn.ts`
4. Create query builder: `frontend/src/lib/db/select/get*.ts`
5. Create API endpoints: `frontend/src/routes/api/create/[category]/+server.ts`, etc
6. Add view config to `frontend/src/lib/utils/core/viewManager.svelte.ts` if needed
7. Add admin page: route will auto-map via `[adminpage]` dynamic segment

**New State Manager:**

1. Create `frontend/src/lib/utils/{domain}/{name}Manager.svelte.ts`
2. Export factory function and singleton instance
3. Use Svelte 5 `$state` for mutable properties
4. Export type (`*Manager = ReturnType<typeof create*>`)
5. Import in components: `import { *Manager } from '$lib/utils/{domain}/*Manager.svelte'`

**New UI Component with State:**

1. Create paired files: `Component.svelte` and `Component.svelte.ts`
2. Svelte file: Component template with HTML/markup
3. TypeScript file: State manager (factory pattern)
4. Export types for props and manager interface
5. Place in `frontend/src/lib/utils/ui/{name}/`

## Special Directories

**`frontend/src/lib/db/migrations/`:**
- Purpose: Schema initialization and migrations
- Generated: No (manually written)
- Committed: Yes
- Pattern: Each migration as separate file; called once on server startup via `hooks.server.ts`

**`frontend/src/lib/assets/`:**
- Purpose: Static images, icons, media files
- Generated: No
- Committed: Yes
- Usage: Imported in components with relative paths

**`.planning/`:**
- Purpose: Strategic planning documents, phase specifications, codebase analysis
- Generated: Yes (by GSD agents)
- Committed: Yes
- Structure: `codebase/` (ARCHITECTURE.md, STRUCTURE.md, etc), `phases/` (phase specifications)

**`frontend/node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes
- Committed: No (in .gitignore)
- Management: `npm install` (uses package-lock.json)

---

*Structure analysis: 2025-02-25*
