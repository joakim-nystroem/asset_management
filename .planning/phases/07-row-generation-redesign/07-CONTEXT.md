# Phase 7: Row Generation Redesign - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning
**Source:** PRD Express Path (.omc/plans/phase-7-architecture.md)

<domain>
## Phase Boundary

Decompose EventListener.svelte (435-line god component) by extracting responsibilities to their natural owners. Move data ownership to `+page.svelte`, replace numeric new-row IDs with "NEW-N" string counter, extract sort logic to GridHeader, extract filter selection as reactive state write, and add per-cell validation. After this phase, EventListener contains ONLY event queue wiring, URL logic (temporary), WebSocket handling, dirty cell tracking, and panel-close effects.

</domain>

<decisions>
## Implementation Decisions

### Data Ownership
- `+page.svelte` owns ALL server load data as individual `$state` declarations: baseAssets, filteredAssets, locations, statuses, conditions, departments, user, dbError, initialView
- EventListener receives setter lambdas for baseAssets/filteredAssets (same getter/setter pattern as EventHandler)
- No `data` prop on EventListener — only specific props/setters it needs
- Context seeding `$effect` chains move to `+page.svelte` or GridContextProvider
- Validation constraint wiring moves out of EventListener to wherever validation is initialized

### Sort Extraction
- Sort logic (`sortData`, `sortDataAsync`, `applySort`) moves to GridHeader / co-located `.svelte.ts` file
- GridHeader owns the sort interaction AND the sort implementation
- GridHeader receives `filteredAssets` setter lambda (or calls through sortCtx) to mutate data
- No event queue involvement — sort is a pure in-memory operation
- Sort flow: user clicks header menu → GridHeader sorts → updates filteredAssets via setter → closes menu

### Filter Extraction
- Header menu and context menu write to filter state directly (e.g., `searchManager.selectFilterItem`)
- EventListener watches filter state via `$effect` and enqueues FILTER event
- Remove `handleFilterSelect` from EventListener — components write state, EventListener reacts
- URL updated as side-effect AFTER event processing (not source of truth)
- Both trigger points (header menu dropdown, context menu right-click) must work

### URL Strategy
- URL is a side-effect for shareability, NOT the source of truth
- State drives URL, not the other way around: state change → event → URL updated after processing
- Full URL redesign (popstate, initial load from params, removing reactiveUrl hack) is a FUTURE phase
- The URL-as-side-effect pattern extends the Phase 06.1-04 view-change precedent to filters

### NEW-N ID Strategy
- Replace `nextIdProvider` numeric IDs with "NEW-N" monotonic string counter in `rowGeneration.svelte.ts`
- IDs: "NEW-1", "NEW-2", "NEW-3" — counter resets on `clearNewRows()`
- Svelte `{#each}` keying works (no duplicate key collisions)
- On commit, EventHandler strips string ID via destructuring (`const { id, ...fields } = row`)
- DB auto-increment assigns real numeric ID
- Delete `setNextIdProvider` `$effect` from EventListener entirely

### Per-Cell Validation
- Add `isValidValue` check inside `rowGeneration.svelte.ts`'s `updateNewRowField()`
- On FloatingEditor save: check required field not empty, value in allowed constraint list
- If invalid, mark field in `invalidFields` immediately — yellow overlay appears instantly
- `validateAll()` on commit remains as safety net

### +page.svelte Shape
- Still a thin wrapper: owns data, passes it down as props
- GridContextProvider receives all data props and handles context seeding
- EventListener receives only baseAssets, filteredAssets, and their setter lambdas
- Component tree: `+page.svelte` → `GridContextProvider` → `EventListener` + `Toolbar` + `GridContainer` + `ContextMenu`

### Claude's Discretion
- Internal module structure for sort extraction (inline in GridHeader vs co-located `.svelte.ts`)
- Exact signature of setter lambdas (simple `(v) => { x = v }` vs typed callbacks)
- How GridContextProvider receives and seeds constraint data
- Whether `isValidValue` returns boolean or a richer error type
- Import organization and file-level code structure

</decisions>

<specifics>
## Specific Ideas

### Execution Order (from PRD)
- **Wave 1 (parallel):** Plan A (data ownership move) + Plan B (NEW-N IDs + per-cell validation)
- **Wave 2:** Plan C (sort extraction to GridHeader) — depends on Wave 1 setter lambdas
- **Wave 3:** Plan D (filter extraction as reactive state write) — depends on Wave 2

### EventListener Post-Phase 7 Contents
- Event queue creation (`createEventQueue` + `createEventHandler`)
- Queue wiring callbacks on `dataCtx` (commit, discard, addRows, addNewRow, viewChange, navigateError)
- URL logic (temporary — future phase)
- Realtime WebSocket handler registration
- Dirty cell tracking `$effect`
- Filter panel / header menu mutual-close effects
- (Logout is a form action in +layout.svelte — NOT in EventListener)

### Success Criteria (from PRD)
1. `+page.svelte` owns ALL server load data as `$state`
2. EventListener receives only setter lambdas — no `data` prop
3. Sort logic lives in GridHeader/headerMenu file
4. Filter selection dispatches through event queue (no filter logic in EventListener)
5. New rows display "NEW-1", "NEW-2" etc.
6. Per-cell validation fires on FloatingEditor save for new rows
7. `setNextIdProvider` `$effect` deleted
8. `svelte-check` 0 errors
9. All existing functionality works: sort, filter, view change, commit, discard, add row, edit, undo/redo

</specifics>

<deferred>
## Deferred Ideas

- **Full URL redesign** — popstate/back-forward handling, initial page load from URL params, removing `reactiveUrl` SvelteURL hack, `skipInitialFetch` flag
- **navigateToError refactoring** — currently reads changes, rowGen, filteredAssets, keys; works fine
- **Dirty cell tracking refactoring** — reads changes, keys, assets; stays in EventListener

</deferred>

---

*Phase: 07-row-generation-redesign*
*Context gathered: 2026-02-27 via PRD Express Path*
