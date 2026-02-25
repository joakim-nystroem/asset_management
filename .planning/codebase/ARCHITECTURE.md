# Architecture

**Analysis Date:** 2025-02-25

## Pattern Overview

**Overall:** SvelteKit fullstack application with server-side session management, layered database operations, and reactive client-side UI state management using Svelte 5 runes.

**Key Characteristics:**
- Server-rendered authentication with session-based access control via `hooks.server.ts`
- RESTful API routes (`/api/*`) for CRUD operations on asset inventory and audit workflows
- Centralized Kysely ORM layer for type-safe database queries
- Reactive state management using Svelte 5 `$state` and `$derived` for UI interactions
- Singleton manager pattern for grid interaction (column widths, row heights, editing, selection)
- View-based filtering system allowing multiple curated perspectives on asset data

## Layers

**Presentation Layer:**
- Purpose: Render UI components and handle user interactions
- Location: `frontend/src/routes/` (page components) and `frontend/src/lib/components/grid/` (grid components)
- Contains: `.svelte` files with forms, grids, filters, modals
- Depends on: Route handlers (`+page.server.ts`), UI utilities, state managers
- Used by: Browser clients

**API Layer:**
- Purpose: Handle HTTP requests/responses for asset, audit, and metadata CRUD operations
- Location: `frontend/src/routes/api/*/`
- Contains: `+server.ts` files implementing GET/POST/PUT/DELETE handlers
- Depends on: Database layer (`$lib/db/*`), auth layer
- Used by: Presentation layer via fetch(), mobile apps

**Database Access Layer:**
- Purpose: Type-safe database queries using Kysely ORM
- Location: `frontend/src/lib/db/` (organized by operation: `select/`, `create/`, `update/`, `delete/`, `auth/`, `migrations/`)
- Contains: Query builders, migrations, authentication functions
- Depends on: Kysely dialect, MariaDB connection pool
- Used by: API routes

**State Management Layer:**
- Purpose: Manage reactive UI state (editing, selection, column widths, sorting, filtering)
- Location: `frontend/src/lib/utils/` (organized by domain: `core/`, `interaction/`, `data/`, `ui/`)
- Contains: Singleton managers exported as `.svelte.ts` files
- Depends on: None (standalone utilities)
- Used by: Presentation components via direct imports

**Authentication & Session Layer:**
- Purpose: Manage user authentication, sessions, and access control
- Location: `frontend/src/lib/db/auth/` (database operations) and `frontend/src/hooks.server.ts` (middleware)
- Contains: User/session CRUD, bcrypt password hashing, session validation
- Depends on: Database layer, bcrypt, uuid
- Used by: Route handlers, middleware

## Data Flow

**Login Flow:**

1. User submits credentials on `/login`
2. `+page.server.ts` action: `login` calls `findUserByUsername()` and verifies password with `bcrypt.compare()`
3. On success: deletes old sessions, creates new session via `createSession()`, sets `sessionId` cookie
4. Redirect to `/` (protected by middleware)

**Asset View Flow:**

1. Page load: `+layout.server.ts` returns theme, user from `event.locals.user` (populated by `hooks.server.ts`)
2. Presentation component fetches assets via `/api/assets` GET endpoint
3. `getDefaultAssets()` executes Kysely query with left joins to status, condition, location, department tables
4. JSON response hydrates `assets` state variable
5. Component renders grid with asset data, managers track column widths, selection, editing state
6. Double-click triggers edit mode → `editManager` expands column width, `rowManager` adjusts row height
7. On save: POST to `/api/update`, `updateAsset()` updates DB and logs change to `change_log` table

**Audit Workflow Flow:**

1. Admin clicks "Start Audit" → POST `/api/audit/start`
2. Server inserts rows into `asset_audit` table (snapshot of current inventory)
3. Page component displays audit assignments with filtering/sorting (location, auditor, status)
4. Admin bulk-assigns assets to auditors → PUT `/api/audit/bulk-assign`
5. Auditor marks items complete → PUT `/api/audit/complete`
6. Admin closes cycle → POST `/api/audit/close` (archives completed items to `asset_audit_history`)

**State Management Flow:**

1. Managers initialized as singletons: `columnManager`, `editManager`, `selectionManager`, `sortManager`, `searchManager`
2. Component imports managers and subscribes via `$effect()` or direct property access
3. User interaction (e.g., column resize) calls manager methods → state updates → component re-renders reactively
4. Changes persisted to localStorage (e.g., `columnManager.saveToStorage()`)

## Key Abstractions

**Database Connection (`db`):**
- Purpose: Centralized Kysely instance for all queries
- Examples: `frontend/src/lib/db/conn.ts`
- Pattern: Singleton export; MariaDB dialect with connection pooling

**Typed Database Tables:**
- Purpose: TypeScript type safety for Kysely queries
- Examples: `AssetTable`, `UserTable`, `SessionTable`, `AssetAuditTable`
- Pattern: Kysely `ColumnType<SelectType, InsertType, UpdateType>` for precise type control

**State Managers:**
- Purpose: Encapsulate domain-specific state logic with reactive getters/setters
- Examples: `editManager`, `columnManager`, `selectionManager`, `sortManager`, `searchManager`
- Pattern: Factory function returning object with state properties and methods; exported as singleton

**View Configurations:**
- Purpose: Define filtered/customized asset perspectives (default, audit, PED, network, galaxy)
- Examples: `frontend/src/lib/utils/core/viewManager.svelte.ts`
- Pattern: Static array of `ViewConfig` objects defining filters and extra columns

**UI Component Helpers:**
- Purpose: Reusable dropdown, autocomplete, context menu, toast utilities
- Examples: `frontend/src/lib/utils/ui/editDropdown/`, `autocomplete.svelte.ts`
- Pattern: Paired `.svelte` component and `.svelte.ts` manager for state

## Entry Points

**Web Application Root:**
- Location: `frontend/src/routes/+layout.svelte` (wraps all pages)
- Triggers: Browser navigation to `/asset`
- Responsibilities: Load theme, user, session info; render navigation UI; pass data to child pages

**Page Routes:**
- `/` - Dashboard redirect to `/asset/` (main grid view)
- `/asset/` - Asset inventory grid (default view)
- `/admin/` - Admin layout with sub-pages
- `/admin/[adminpage]` - Metadata management (locations, statuses, departments, conditions)
- `/admin/audit` - Audit cycle management and assignments
- `/mobile/manage` - Mobile asset creation/editing
- `/mobile/audit` - Mobile audit data capture

**API Routes:**
- `/api/assets` - GET all assets for grid
- `/api/update` - PUT to update asset fields
- `/api/audit/start` - POST to begin audit cycle
- `/api/audit/close` - POST to complete audit cycle
- `/api/audit/assign` - PUT to reassign auditor
- `/api/audit/bulk-assign` - PUT to bulk assign multiple assets

**Session Middleware:**
- Location: `frontend/src/hooks.server.ts`
- Triggers: Every incoming request
- Responsibilities: Validate session cookie, fetch user from DB, populate `event.locals.user`, cleanup expired sessions hourly

## Error Handling

**Strategy:** Layered try-catch with fallback error responses.

**Patterns:**

- **Database errors:** Caught in API routes, return JSON `{ error: string }` with HTTP status
- **Authentication errors:** Invalid session → delete cookies, set `event.locals.user = null`, redirect to `/login`
- **Validation errors:** API routes validate input (e.g., ALLOWED_COLUMNS whitelist in `/api/update`), return 400
- **User-facing errors:** Displayed in toast notifications (success/warning/error) or message banners
- **Logging:** Errors logged to console with context; no centralized error tracking configured

**Example:** `frontend/src/routes/api/assets/+server.ts` wraps `getDefaultAssets()` in try-catch, returns `{ assets: [], dbError: string }`

## Cross-Cutting Concerns

**Logging:** Console-based; critical operations log errors to browser console and server logs.

**Validation:**
- Client-side: Prevented from editing ID column, datetime formatting (`.toISOString().slice(0,19).replace('T',' ')`)
- Server-side: ALLOWED_COLUMNS whitelist prevents SQL injection, type checking via Kysely

**Authentication:**
- Session validation on every request via `hooks.server.ts`
- Protected pages redirect to `/login` if no user in `event.locals`
- Session expiry: 7 days; cleanup runs hourly

**Reactive State:**
- Svelte 5 `$state` for mutable state in components and managers
- `$derived` for computed properties (e.g., `filteredAndSorted` in audit page)
- `$effect` for side effects (e.g., refetching data when dependencies change)

---

*Architecture analysis: 2025-02-25*
