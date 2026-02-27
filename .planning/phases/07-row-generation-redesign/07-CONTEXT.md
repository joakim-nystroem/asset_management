# Phase 7: Row Generation Redesign - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning (replaces previous context — old plans invalid)

<domain>
## Phase Boundary

Redesign new row generation so that new rows are regular grid rows — same rendering, same FloatingEditor, same context menu. Also fix data ownership: move all data from EventListener to `+page.svelte` as props. New rows "mathematically attach" at the end of the grid without being a separate system.

Three deliverables:
1. Data ownership move (`+page.svelte` owns data, passes as props)
2. New row behavior (event queue flow, "NEW" ID, same grid components)
3. Header menu adaptation (receives data as props instead of context)

</domain>

<decisions>
## Implementation Decisions

### Data Ownership
- `+page.svelte` owns ALL data — assets, user, constraints, everything
- Data is passed as props on a per-need basis, not through context
- Contexts are for EPHEMERAL state only — editing state, selection, context menu open/position, etc. NOT for bulk data like the asset list
- `+page.svelte` is still a thin wrapper — it owns data but doesn't use it directly
- EventListener should NOT own `baseAssets`, `filteredAssets`, or derive `assets` — this moves up to `+page.svelte`

### New Row Flow
- "Add Row" button dispatches through the event queue — same pattern as every other grid action (sort, filter, edit)
- Event handler picks up the event and tells the grid controller to attach an empty row
- New rows are grid rows — same `GridRow` component, same `FloatingEditor`, same context menu
- No separate `RowGeneration.svelte` with its own editors — the grid's existing components handle everything
- The new row component only needs to know where the last row is to position itself

### New Row ID Strategy
- New rows display "NEW" in the ID column instead of a number
- This signals "uncommitted" visually AND circumvents concurrent row number collisions entirely
- On commit → INSERT → database auto-increment assigns the real ID → response returns it
- No Go backend changes needed — existing `POST /api/create/asset` + DB auto-increment is sufficient
- No round-trip for ID reservation, no websocket coordination for row numbers

### Editing New Rows
- Same FloatingEditor handles both regular and new row cells
- CRITICAL DIFFERENCE: editing a new row does NOT signal the backend (no "user is editing cell" lock) — the row doesn't exist in the DB, other users can't see it
- On FloatingEditor save: if new row → update local row data only; if existing row → signal backend + update changes/history (current behavior)
- This is the only routing difference — everything else (open editor, render input, cell navigation) is identical

### Visual Distinction
- Subtle visual distinction for pending rows (e.g., light background + "NEW" in ID column)
- "NEW" in the ID column is the primary indicator

### Validation
- Per-cell validation on FloatingEditor save (instant feedback — "required field" or "not in allowed list")
- Full `validateAll()` on commit as safety net
- Small delta from current behavior — add `isValidValue` check inside `updateNewRowField`

### Header Menu
- Header menu currently reads assets from context — needs rethinking since assets move to props
- Since header menu is an integral part of the grid, it receives the necessary asset data as a prop
- In scope for this phase (part of the data ownership move)

### Claude's Discretion
- Exact implementation of how EventListener transforms from data owner to event processor
- How the existing `rowGeneration.svelte.ts` controller adapts (keep logic, change integration)
- Exact styling for the "NEW" row visual distinction
- How `isNewRow` routing forks in GridOverlays/contextMenu simplify
- Keyboard navigation between regular rows and new rows

</decisions>

<specifics>
## Specific Ideas

- New rows are "mathematically attached" to the bottom — positioned based on grid geometry (last row coordinates), not by being a separate rendering system
- The event queue pattern means "Add Row" is just another event like "Sort" or "Filter" — consistent architecture
- Go backend does NOT need changes — DB auto-increment handles IDs, existing create endpoint handles INSERTs
- The grid IS the app — it's fine to pass props to it, unlike plugin components that should work through context

</specifics>

<deferred>
## Deferred Ideas

- Go backend concurrent row coordination via websockets (not needed now — "NEW" + auto-increment solves it)
- Multi-user real-time new row visibility (currently new rows are local-only until commit, which is correct)

</deferred>

---

*Phase: 07-row-generation-redesign*
*Context gathered: 2026-02-27 via discussion*
