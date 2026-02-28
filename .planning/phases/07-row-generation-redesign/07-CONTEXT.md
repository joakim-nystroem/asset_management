# Phase 7: Architectural Correction - Context

**Gathered:** 2026-02-28 (v3 — updated to reflect current codebase reality)
**Status:** In progress — 21 svelte-check errors remain

<domain>
## Phase Boundary

Eliminate all legacy controllers and ghost imports so the codebase matches the Smart Owner + assetStore architecture. After this phase: zero legacy files, zero ghost imports, `svelte-check` passes with 0 errors.

**Already implemented (committed):**
- Smart Owner event system: `EventOwner.svelte` → `eventQueue.ts` → `eventHandler.ts`
- `assetStore.svelte.ts` — module-level `$state` singleton for all server data
- `+page.svelte` seeds `assetStore`, renders component tree
- 12 legacy files deleted (10 controllers + interactionHandler + searchManager)
- Directory consolidation: all grid components under `lib/grid/components/`
- ColumnContext eliminated — `columnWidths` local SvelteMap in GridOverlays, passed via snippet
- GridHeader owns full resize lifecycle + local sort state
- SortContext eliminated — sort state local to GridHeader

**Remaining work:**
- 21 svelte-check errors across 6 files
- searchManager ghost imports (4 files) → replace with SearchContext
- Toolbar ghost context imports (3) → replace with editCtx/newRowCtx/uiCtx
- UiContext missing properties (getCurrentUrlState, updateSearchUrl) → remove, replaced by SearchContext
- HeaderMenu props mismatch → simplify, read assetStore + searchCtx directly
- contextMenu handleFilterSelect → push to searchCtx.filters directly
- Implicit any types (2) → add annotations

</domain>

<decisions>
## Implementation Decisions

### SearchContext (NEW — replaces searchManager)
- New context: `SearchContext = { q: string, filters: { key: string, value: string }[] }`
- Added to `gridContext.svelte.ts` with `[getSearchContext, setSearchContext]` pair
- Initialized in `GridContextProvider.svelte` with empty defaults
- `searchManager.svelte.ts` is already deleted — this is its replacement

### Search Flow (auto-fire)
- Toolbar has local `$state` for the search input text field (not in context)
- On Enter keypress or Search button click, Toolbar writes `searchCtx.q = searchInput`
- On clear, Toolbar sets `searchInput = ''; searchCtx.q = ''`
- EventOwner watches `searchCtx` via `$effect` — any change enqueues a FILTER event
- No `searchRequested` trigger flag needed — remove from UiContext
- No debouncing needed — writes only happen on explicit user action

### Filter Flow (inline, no utility file)
- Filter selection: HeaderMenu pushes/splices `{ key, value }` in `searchCtx.filters`
- Filter items (unique column values): HeaderMenu computes inline from `assetStore.baseAssets` — `[...new Set(assetStore.baseAssets.map(a => a[key]).filter(Boolean))]`
- Is-selected check: `searchCtx.filters.some(f => f.key === key && f.value === item)` — inline one-liner
- Filter count: `searchCtx.filters.length` — inline
- No `filterUtils.ts` file. No searchManager helper functions. Everything is trivial with state in context.

### HeaderMenu Simplification
- Drop props: `searchManager`, `assets`, `baseAssets` — all replaced by direct imports
- HeaderMenu imports `assetStore` for data, reads `getSearchContext()` for filter selection state
- Remaining props: `state` (HeaderMenuState), `sortState`, `onSort`, `onFilterSelect` (or direct context write)

### FilterPanel Simplification
- Drop `searchManager` prop — reads `getSearchContext()` for active filters and count
- Filter removal: splices from `searchCtx.filters`
- Clear all: sets `searchCtx.filters = []`

### Toolbar Wiring
- Remove ghost imports: `getDataContext`, `getChangeContext`, `getRowGenControllerContext`
- Read `editCtx` for dirty state (`hasUnsavedChanges`)
- Read `newRowCtx` for new row state (`hasNewRows`, validity)
- Read `uiCtx` for menu/panel state
- Trigger actions via `uiCtx` flags: `commitRequested`, `commitCreateRequested`, `discardRequested`
- Add new row: `uiCtx.commitCreateRequested` or direct context write
- Remove all `getCurrentUrlState` / `updateSearchUrl` references — URL sync is scrapped

### ContextMenu Filter-by-Value
- `handleFilterByValue` pushes `{ key, value }` into `searchCtx.filters` directly
- Remove `uiCtx.handleFilterSelect` reference — no longer exists on UiContext

### UiContext Cleanup
- Remove `searchRequested` — replaced by EventOwner watching searchCtx
- Remove `getCurrentUrlState` — scrapped
- Remove `updateSearchUrl` — scrapped
- Remove `handleFilterSelect` — replaced by direct searchCtx write
- Keep: `commitRequested`, `commitCreateRequested`, `discardRequested`, `filterPanel`, `headerMenu`, `contextMenu`

### Claude's Discretion
- Order of fixing the 21 errors
- Implicit `any` type annotations
- Whether HeaderMenu `onFilterSelect` stays as prop or becomes a direct context write

</decisions>

<specifics>
## Specific Ideas

- "searchManager was doing simple things that looked complex because it owned the state too. With state in context, the helpers are trivial enough to inline."
- Filter items from `assetStore.baseAssets`, selection state from `searchCtx.filters` — two direct imports, no intermediary
- Toolbar search input is local `$state` (not in context) — only written to `searchCtx.q` on explicit submit

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `assetStore.svelte.ts`: Module-level `$state` singleton — `baseAssets`, `filteredAssets`, `locations`, `statuses`, `conditions`, `departments`
- `EventOwner.svelte`: Already watches context flags via `$effect` — add searchCtx watcher
- `GridContextProvider.svelte`: Pure shell factory — add searchCtx initialization
- `gridContext.svelte.ts`: Context type definitions — add SearchContext type + pair

### Established Patterns
- Smart Owner: EventOwner watches context → enqueue → eventHandler processes
- Module singleton: `assetStore` imported directly, no context wrapper
- Context = ephemeral UI state only
- Components import `assetStore` directly for data, read contexts for UI state

### Integration Points
- EventOwner: add `$effect` watching `searchCtx.q` and `searchCtx.filters`
- eventHandler: FILTER event already exists, payload shape matches `{ q, filters, view }`
- GridContextProvider: add `setSearchContext()` initialization

### Error Map (21 errors, 6 files)
| File | Errors | Fix |
|------|--------|-----|
| Toolbar.svelte | 12 | Remove ghost imports, swap to editCtx/newRowCtx/searchCtx, remove URL refs |
| headerMenu.svelte | 5 | Drop searchManager prop, import assetStore + searchCtx, fix implicit any |
| filterPanel.svelte | 1 | Drop searchManager prop, read searchCtx |
| EventOwner.svelte | 1 | Remove searchManager import, read searchCtx |
| contextMenu.svelte.ts | 1 | handleFilterSelect → push to searchCtx.filters |
| GridContainer.svelte | 1 | Fix HeaderMenu props (drop removed props) |

</code_context>

<deferred>
## Deferred Ideas

- **URL sync** — Full URL redesign (popstate, initial load from URL params, removing SvelteURL hack) is a future phase
- **NewRow component set** — Full `.svelte` + `.svelte.ts` component pair for new row rendering — separate phase
- **Dirty cell overlays** — Removed from GridOverlays during cleanup, needs reimplementation with editCtx
- **Undo/redo/paste** — Stubbed as TODO in GridOverlays + FloatingEditor

</deferred>

---

*Phase: 07-architectural-correction*
*Context gathered: 2026-02-28 (v3 — searchContext decision + current error map)*
