# Asset Management — Coding Conventions

## What This Is

A collaborative asset tracking app — a spreadsheet-like grid where multiple users can browse, search, filter, and edit organizational assets in real time. Asset rows have dynamic columns that vary per view (e.g. default, audit, network) — columns are not fixed at the type level, they're determined by what the DB query returns. Rows are typed as `Record<string, any>`. Users see each other's cursors, cell locks, and pending changes. Changes are committed to a MariaDB database, with a Go WebSocket hub handling presence and live updates.

## Tech Stack
- **Frontend:** SvelteKit, Svelte 5 (runes), Tailwind CSS (~8,600 LOC — ~40 core files, ~25 DB queries, ~34 route files)
- **Backend:** SvelteKit server routes, Kysely ORM, MariaDB
- **Realtime:** Go WebSocket hub (`api/`, ~1,300 LOC)
- **Base path:** `/asset`

This is a focused codebase — understand the whole before changing a part.

## Directory Structure

```
frontend/src/
├── lib/
│   ├── data/          # Module-level $state stores (pure data, no helpers)
│   ├── utils/         # Shared helper functions (gridHelpers.ts, realtimeManager)
│   ├── grid/
│   │   ├── components/   # Grid UI components (folder-per-component)
│   │   ├── eventQueue/   # Event queue system (enqueue → handler → router)
│   │   ├── gridConfig.ts # Grid constants (row height, column width)
│   │   └── validation.ts # Cell validation rules
│   ├── db/            # Kysely database queries (select/, create/, update/, delete/)
│   ├── toast/         # Toast notification system
│   └── types.ts       # Shared TypeScript types
├── routes/            # SvelteKit pages and API routes
api/
├── main.go            # HTTP server + WS upgrade
└── internal/hub.go    # WebSocket hub, presence, locking, pending state
```

## Svelte 5 — Runes Only

Use Svelte 5 runes exclusively. No legacy `let` exports, no `$:` reactive statements.

- `$state()` — reactive state
- `$derived()` — computed values
- `$effect()` — side effects
- `$props()` — component props
- `$state.snapshot()` — create a plain-object copy of a `$state` proxy (see "Never Do This" for usage rule)

## State Management

### Stores for global state

Module-level `$state` singletons in `$lib/data/`. Imported directly — no provider components.

```ts
// $lib/data/someStore.svelte.ts
export const someStore = $state({
  value: '',
});
```

**Store files are pure data.** Only `$state` definitions and type exports. All helper functions — even ones that only touch a single store — go in `$lib/utils/` (e.g. `gridHelpers.ts` for `resetEditing`, `resetEditState`, `setOpenPanel`).

**Existing stores:**
- `assetStore` — base + displayed asset arrays, metadata lists (locations, statuses, conditions, departments)
- `cellStore` — editing state, pending edits, undo/redo history, selection range, clipboard
- `uiStore` — panel visibility (context menu, header menu, filter panel, suggestion menu), sort, column widths, row heights
- `presenceStore` — other users' cursor positions, locks, and pending cells
- `connectionStore` — WebSocket connection status (connected/disconnected/reconnecting)
- `queryStore` — active view, search term, filter list
- `scrollStore` — scroll position, visible row range, scroll-to signals
- `urlStore` — current URL search string for `replaceState` sync
- `newRowStore` — uncommitted new rows pending creation

### Contexts for scoped state

Use `setContext`/`getContext` when state is scoped to a component subtree and shouldn't be global. Currently used for `viewport` dimensions (owned by GridContainer, consumed by virtualGridContainer.svelte.ts).

**Rule:** If only one subtree needs it → context. If multiple unrelated components need it → store.

## Component Conventions

### Folder-per-component with companion `.svelte.ts`

```
components/toolbar/
├── Toolbar.svelte        # Rendering + template
└── toolbar.svelte.ts     # Component-specific reactive logic
```

The `.svelte.ts` companion holds extracted logic. Keep these files even if empty to maintain the convention. Empty companions should contain a single comment: `// ComponentName companion — helpers moved to $lib/utils/gridHelpers.ts`

### `.svelte.ts` vs `.ts`

- **`.svelte.ts`** — files that declare runes (`$state`, `$derived`, `$effect`). Required for the Svelte compiler to process runes.
- **`.ts`** — plain TypeScript. Can import and mutate `$state` store objects (they're just proxies), but cannot declare new runes. Use for helpers like `gridHelpers.ts`.

## Event Queue

All state-mutating actions flow through a serial FIFO queue.

```
Component → enqueue({ type, payload }) → eventHandler.ts (switch/router) → mutates stores
```

- **`enqueue()`** takes a single argument: `{ type: string, payload: Record<string, any> }`
- **`eventHandler.ts`** is the central router — imports stores directly, handles all event types
- **WS events** are prefixed with `WS_` (e.g. `WS_CELL_LOCKED`, `WS_USER_LEFT`)
- **Components enqueue directly** — Toolbar, EditHandler, HeaderMenu, FilterPanel, ContextMenu all call `enqueue()` themselves
- **EventListener** handles multi-source convergent events only (selection → position sync, keyboard shortcuts, WS bridge effects)

### When to enqueue vs. call directly

Enqueue when the action falls into one of these categories:
- **API calls** — commits, queries, view changes (async fetch, stores mutated only after DB confirms)
- **Incoming WS events** — presence updates, lock/unlock, pending broadcasts (server-pushed → store updates)
- **Outbound WS sends** — position updates, edit start/end, pending cell signals

Events are processed one at a time, in order. If a new event is enqueued while one is processing, it waits. This prevents races (e.g. a commit can't interleave with a query).

**Call directly** for pure UI state — toggling menus, updating local variables, selection changes.

## Realtime / WebSocket

- **`realtimeManager`** (`$lib/utils/realtimeManager.svelte.ts`) — singleton, pure transport layer
- Enqueues incoming WS messages with `WS_` prefix directly into the event queue
- Exposes typed send methods: `sendPositionUpdate`, `sendEditStart`, `sendEditEnd`, `sendCellPending`, etc.
- **Server owns presence truth** — Go hub maintains per-user state, handles disconnect cleanup, echo suppression
- **Pending state is local-first** — survives disconnection, but WS required to commit

### Lock Guards

Three entry points for cell editing (GridRow double-click, ContextMenu edit, F2 key). All check:
1. `presenceStore.users` — is the cell locked by another user?
2. `presenceStore.pendingCells` — does another user have pending changes?

### Context menu close on scroll

The context menu is closed at **user-scroll entry points** (wheel, scrollbar thumb drag, auto-scroll start, arrow keys), not via a reactive `$effect` on `scrollStore.scrollTop`. This prevents false closes from programmatic position resets (e.g. QUERY handler resetting scroll to 0, clamp adjustments on content shrink).

## Server-Side Patterns

### SvelteKit load functions

`+page.server.ts` files use `Promise.all` for parallel data fetching:

```ts
const [assets, locations, statuses] = await Promise.all([
  queryAssets(...),
  getLocations(),
  getStatuses(),
]);
```

### MariaDB dates

**NEVER** use `.toISOString()` directly for DATETIME columns. Format as:
```ts
new Date().toISOString().slice(0, 19).replace('T', ' ')
```

### After inserts, always refetch

Don't optimistically patch IDs. Refetch from the database to get server-assigned values.

### Undo/redo history persists across commits

Committing does NOT clear undo/redo stacks — users can undo after a commit. Use `resetAfterCommit()` (selection/clipboard only). Discarding, searching, changing views, or changing filters clears everything via `resetEditState()` (includes history).

## Styling

- **Tailwind CSS** for all styling
- **Dark mode** via `dark:` class variants (toggled on `<html>` element)
- **Z-index** uses 10-step groups (10, 20, 30...) to avoid conflicts
- **Dynamic inline styles** only for computed positioning (overlays, scroll transforms, menu placement)

## Go WebSocket Hub (`api/internal/hub.go`)

### Message Format

All messages are JSON: `{ "type": "MESSAGE_TYPE", "payload": { ... } }`

### Concurrency Model

- One goroutine per client for reading, one for writing
- Hub runs in its own goroutine, processes register/unregister/broadcast via channels
- Shared state protected by mutexes: `UserPresence`, `CellLockManager`, `PendingCellManager` each have their own `sync.RWMutex`
- `userClients` maps a userID to multiple clients (supports multiple tabs)

### Server Message Types (client → server)

`USER_POSITION_UPDATE`, `USER_DESELECTED`, `CELL_EDIT_START`, `CELL_EDIT_END`, `CELL_PENDING`, `CELL_PENDING_CLEAR`, `PENDING_CLEAR_ALL`, `COMMIT_BROADCAST`, `CLIENT_STATE`, `PING`

### State Managers

- **UserPresence** — tracks cursor position per user (`map[userID]*UserPosition`, mutex-protected)
- **CellLockManager** — tracks which cells are being edited (`"assetId:key"` → `CellLockInfo`, with reverse index `userID → set of lock keys` for disconnect cleanup)
- **PendingCellManager** — same structure as locks but for uncommitted pending changes

## Error Handling

### Event handler pattern

API failures show a toast and return early — no rollback, no retry. Stores are only mutated after a successful response.

```
fetch → fail? → toast error, return
fetch → ok?   → mutate stores, toast success
```

Auth guards (`if (!user)`) toast a warning and return before any API call.

### WS disconnection

Pending edits survive disconnection (local-first). The user can keep editing, but commits require a live WS connection. On reconnect, `CLIENT_STATE` is sent and the server reconciles (may reject conflicting locks/pending cells via `WS_CLIENT_STATE_RECONCILED`).

## Testing

No formal test suite currently. Verify changes with `svelte-check`:

```bash
cd frontend && npx svelte-check --tsconfig ./tsconfig.json
# Expect: 0 errors, 4 pre-existing a11y warnings
```

Go API:
```bash
cd api && go build ./...
```

## Never Do This

- **Never use `$:` or `let` exports** — Svelte 5 runes only
- **Never put helper functions in store files** — stores are pure data, helpers go in `$lib/utils/`
- **Never call `realtime.send*()` from components directly** — enqueue an event, let eventHandler route it
- **Never mutate stores before API confirmation** — fetch first, mutate on success
- **Never use `.toISOString()` for MariaDB dates** — format as `YYYY-MM-DD HH:MM:SS`
- **Never optimistically patch IDs after inserts** — always refetch from DB
- **Never pass `$state` proxies to `enqueue()` or API calls** — always `$state.snapshot()` first, then pass the snapshot as payload. Proxies are reactive references that can change before the handler processes them.

## Common Tasks

### Adding a new store

1. Create `$lib/data/newStore.svelte.ts` with `export const newStore = $state({ ... })`
2. Import directly where needed — no provider wiring

### Adding a new event type

1. Add the case to `eventHandler.ts` switch statement
2. Write the handler function in the same file
3. Enqueue from the component: `enqueue({ type: 'NEW_EVENT', payload: { ... } })`

### Adding a new grid column/view

Columns are dynamic — determined by what `queryAssets()` returns for a given view. To add a view:
1. Add the view name to `VALID_VIEWS` in `+page.server.ts`
2. Add the corresponding SQL query logic in `$lib/db/select/queryAssets.ts`
3. Add validation rules if needed in `validation.ts`

## Code Style

- Add comments where intent isn't obvious — especially for one-liners that replace extracted functions
- Prefer inlining simple expressions over wrapping in named functions
- No unnecessary abstractions — three similar lines > a premature helper
- **Always update CLAUDE.md after a change** — if a code change affects architecture, conventions, stores, event types, or component structure, update the relevant sections of this file to stay in sync
