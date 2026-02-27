# Phase 7: Row Generation Redesign - Research

**Researched:** 2026-02-27
**Domain:** Svelte 5 runes, SvelteKit data ownership, in-grid new row pattern
**Confidence:** HIGH — all findings from direct codebase inspection

> **NOTE:** This document supersedes the previous RESEARCH.md. The CONTEXT.md was rewritten
> on 2026-02-27 and the old approach (self-contained RowGeneration.svelte with its own
> FloatingEditor) is abandoned. Trust this document, not the previous one.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data Ownership**
- `+page.svelte` owns ALL data — assets, user, constraints, everything
- Data is passed as props on a per-need basis, not through context
- Contexts are for EPHEMERAL state only — editing state, selection, context menu open/position, etc. NOT for bulk data like the asset list
- `+page.svelte` is still a thin wrapper — it owns data but doesn't use it directly
- EventListener should NOT own `baseAssets`, `filteredAssets`, or derive `assets` — this moves up to `+page.svelte`

**New Row Flow**
- "Add Row" button dispatches through the event queue — same pattern as every other grid action
- Event handler picks up the event and tells the grid controller to attach an empty row
- New rows are grid rows — same `GridRow` component, same `FloatingEditor`, same context menu
- No separate `RowGeneration.svelte` with its own editors — the grid's existing components handle everything
- The new row component only needs to know where the last row is to position itself

**New Row ID Strategy**
- New rows display "NEW" in the ID column instead of a number
- This signals "uncommitted" visually AND circumvents concurrent row number collisions entirely
- On commit → INSERT → database auto-increment assigns the real ID → response returns it
- No Go backend changes needed — existing `POST /api/create/asset` + DB auto-increment is sufficient
- No round-trip for ID reservation, no websocket coordination for row numbers

**Editing New Rows**
- Same FloatingEditor handles both regular and new row cells
- CRITICAL DIFFERENCE: editing a new row does NOT signal the backend (no "user is editing cell" lock) — the row doesn't exist in the DB, other users can't see it
- On FloatingEditor save: if new row → update local row data only; if existing row → signal backend + update changes/history (current behavior)
- This is the only routing difference — everything else (open editor, render input, cell navigation) is identical

**Visual Distinction**
- Subtle visual distinction for pending rows (e.g., light background + "NEW" in ID column)
- "NEW" in the ID column is the primary indicator

**Validation**
- Per-cell validation on FloatingEditor save (instant feedback)
- Full `validateAll()` on commit as safety net
- Add `isValidValue` check inside `updateNewRowField`

**Header Menu**
- Header menu currently reads assets from context — needs rethinking since assets move to props
- Since header menu is an integral part of the grid, it receives the necessary asset data as a prop
- In scope for this phase (part of the data ownership move)

### Claude's Discretion
- Exact implementation of how EventListener transforms from data owner to event processor
- How the existing `rowGeneration.svelte.ts` controller adapts (keep logic, change integration)
- Exact styling for the "NEW" row visual distinction
- How `isNewRow` routing forks in GridOverlays/contextMenu simplify
- Keyboard navigation between regular rows and new rows

### Deferred Ideas (OUT OF SCOPE)
- Go backend concurrent row coordination via websockets
- Multi-user real-time new row visibility (new rows are local-only until commit — correct)
</user_constraints>

---

## Summary

Phase 7 has three deliverables: (1) move data ownership from `EventListener.svelte` to `+page.svelte`,
(2) change new row IDs from numeric auto-increment to the string `"NEW-N"`, and (3) adapt the header
menu to receive data as props instead of reading from context.

The good news: the codebase is already 80% ready for the new row behavior. `GridOverlays` already routes
`FloatingEditor.onSave` through an `isNewRow` check (`editRow >= dataCtx.filteredAssetsCount`). The context
menu already shows "Delete Row" for new rows. `GridContainer` already applies a distinct background to new
rows. The `rowGeneration.svelte.ts` controller is complete. What changes are: (a) moving the `$state`
declarations for `baseAssets`/`filteredAssets` up to `+page.svelte`, (b) replacing numeric ID generation
with `"NEW-N"` strings, and (c) adding per-cell validation to `updateNewRowField`.

The primary risk is threading `baseAssets`/`filteredAssets` upward without breaking the EventHandler's
getter/setter injection pattern. The EventHandler already consumes them through lambdas
(`getBaseAssets: () => baseAssets`, `setBaseAssets: (v) => { baseAssets = v }`), so moving the `$state`
declarations is straightforward — the lambda closures capture correctly regardless of where the variable
is declared.

**Primary recommendation:** Three-plan sequence. Plan 1: data ownership move. Plan 2: NEW ID strategy and
per-cell validation. Plan 3: header menu verification and cleanup.

---

## Standard Stack

No new packages required. All existing libraries are sufficient.

### Core (unchanged)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Svelte 5 | 5.49.1 | Runes reactivity, `$state`, `$derived`, `$props` | Project standard |
| SvelteKit | current | Routing, SSR, `PageProps` | Project standard |
| TypeScript | current | Type safety, `svelte-check` | Required by NF3 |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Current State (Phase 6.1 outcome)

```
+page.svelte (19 lines — thin wrapper)
  GridContextProvider.svelte
    ← initializes all 11 domain contexts
    ← creates changeController, historyController, rowGenController
    ← publishes all via set*Context()
    EventListener.svelte            ← owns baseAssets, filteredAssets as $state
                                    ← derives assets = [...filteredAssets, ...rowGen.newRows]
                                    ← seeds dataCtx.assets, dataCtx.baseAssets
                                    ← wires action callbacks onto dataCtx
                                    ← wires setNextIdProvider() on rowGen
    Toolbar.svelte                  ← reads dataCtx, changeCtx, rowGenCtx from context
    GridContainer.svelte            ← reads dataCtx.assets from context (zero props)
      GridOverlays.svelte           ← FloatingEditor onSave already routes by isNewRow
    ContextMenu.svelte              ← already shows Delete Row for new rows
```

### Target State (Phase 7 outcome)

```
+page.svelte (~30-40 lines)
    ← owns: baseAssets $state, filteredAssets $state
    ← passes setter lambdas to EventListener as props
  GridContextProvider.svelte
    ← unchanged (still initializes contexts + controllers)
    ← rowGenController created here, setNextIdProvider REMOVED
    EventListener.svelte            ← receives baseAssets, filteredAssets as props
                                    ← still derives assets = [...filteredAssets, ...rowGen.newRows]
                                    ← still seeds dataCtx from derived assets
                                    ← setters call back into +page.svelte lambdas
    Toolbar.svelte                  ← unchanged
    GridContainer.svelte            ← unchanged (reads dataCtx.assets from context)
      GridOverlays.svelte           ← onSave handler: add per-cell isValidValue check for new rows
    ContextMenu.svelte              ← unchanged
```

### Pattern 1: Data Ownership Move — Getter/Setter Lambda Pattern

**What:** Move `baseAssets` and `filteredAssets` `$state` declarations from `EventListener` to
`+page.svelte`. Pass setter lambdas as props to `EventListener`. `EventListener` passes these
through to `createEventHandler` (already uses this injection pattern).

**Why getter/setter over `$bindable`:** EventHandler already has `getBaseAssets`/`setBaseAssets`
in its deps type. This change is a two-line diff in `EventListener` (remove `$state` declarations,
receive from props) and a three-line diff in `+page.svelte` (add `$state`, pass props).

**+page.svelte target:**
```svelte
<script lang="ts">
  import type { PageProps } from './$types';
  import GridContextProvider from '$lib/context/GridContextProvider.svelte';
  import EventListener from '$lib/grid/eventQueue/EventListener.svelte';
  import Toolbar from '$lib/components/grid/Toolbar.svelte';
  import GridContainer from '$lib/components/grid/GridContainer.svelte';
  import ContextMenu from '$lib/grid/components/context-menu/contextMenu.svelte';

  let { data }: PageProps = $props();

  // +page.svelte owns all persistent data
  let baseAssets: Record<string, any>[] = $state(data.assets ?? []);
  let filteredAssets: Record<string, any>[] = $state(data.searchResults ?? data.assets ?? []);
</script>

<GridContextProvider>
  <div class="px-4 py-2 flex-grow flex flex-col">
    <EventListener
      {data}
      {baseAssets}
      {filteredAssets}
      setBaseAssets={(v) => { baseAssets = v; }}
      setFilteredAssets={(v) => { filteredAssets = v; }}
    />
    <Toolbar />
    <GridContainer />
    <ContextMenu />
  </div>
</GridContextProvider>
```

**EventListener.svelte Props type change:**
```typescript
type Props = {
  data: PageProps['data'];
  baseAssets: Record<string, any>[];
  filteredAssets: Record<string, any>[];
  setBaseAssets: (v: Record<string, any>[]) => void;
  setFilteredAssets: (v: Record<string, any>[]) => void;
};
let { data, baseAssets, filteredAssets, setBaseAssets, setFilteredAssets }: Props = $props();
```

The `createEventHandler` call already injects these through lambdas:
```typescript
const handler = createEventHandler({
  getBaseAssets: () => baseAssets,      // captures prop reactively
  setBaseAssets,                         // passed directly from prop
  getFilteredAssets: () => filteredAssets,
  setFilteredAssets,
  // ... rest unchanged
});
```

The `assets` derived value stays in EventListener (needs both `filteredAssets` prop and `rowGen`
from context — `+page.svelte` is above `GridContextProvider` so cannot access context):
```typescript
const assets = $derived([...filteredAssets, ...rowGen.newRows]);
```

The synchronous seed and `$effect` syncs remain in EventListener — they write derived data into
`dataCtx`, which is unchanged.

### Pattern 2: NEW ID Strategy

**What:** Replace `nextIdProvider`/`getNextId()` with a monotonic `"NEW-N"` counter.

**Why `"NEW-N"` not plain `"NEW"`:** Svelte's `{#each}` uses `(asset.id || startIndex + i)` as
the key. Multiple rows all with `id: "NEW"` causes key collisions and rendering bugs. Each new row
needs a unique key.

**Implementation in `rowGeneration.svelte.ts`:**
```typescript
// Replace nextIdProvider + getNextId() with:
let newRowCounter = $state(0);

function getNewRowId(): string {
  newRowCounter += 1;
  return `NEW-${newRowCounter}`;
}

function addNewRows(count: number, template: Record<string, unknown>): NewRow[] {
  const created: NewRow[] = [];
  for (let i = 0; i < count; i++) {
    const newRow: NewRow = { ...template, id: getNewRowId() };
    newRows.push(newRow);
    created.push(newRow);
  }
  return created;
}

function clearNewRows() {
  newRows = [];
  invalidFields = new Map();
  newRowCounter = 0;   // reset so next batch starts at NEW-1
}
```

**Remove from public API:** `setNextIdProvider`, `getInvalidNewRows`, `getValidNewRows` are unused
after this change. The `RowGenerationController` type export stays; remove those method exports.

**Remove from EventListener:** The `$effect` that calls `rowGen.setNextIdProvider(...)` is deleted.
The entire `nextIdProvider` lambda and `baseAssets.map(...)` computation is gone.

**Downstream effects of string ID — all safe:**
- `gridEdit.save()` returns `{ id: asset.id, ... }` — `asset.id` will be `"NEW-1"` etc. This is
  fine. `GridOverlays.onSave` gates on `isNewRow` by index, not by ID value. The string flows
  through to `rowGen.updateNewRowField` which ignores the `id` field.
- `handleCommitCreate` in EventHandler already strips `id`: `const { id, ...fields } = row`. String
  `id` is stripped cleanly. No change needed in EventHandler.
- `ChangeController` is never called for new rows (existing `isNewRow` routing). No impact.
- `navigateToError` uses `changes.getInvalidCellKeys()` (existing rows only) and separate new row
  index logic. The string `"NEW-1"` is never passed to the change-based lookup.

**GridRow display:** `GridRow` renders `asset[key]` as a string via `{asset[key]}`. The ID cell
renders `"NEW-1"` etc. directly — no GridRow changes needed.

### Pattern 3: Per-Cell Validation in updateNewRowField

**What:** Add immediate validation feedback when a new row cell is saved via FloatingEditor. The
current code optimistically clears the invalid state on save. Change it to also set invalid state
when the new value fails validation.

**Where:** Inside `updateNewRowField` in `rowGeneration.svelte.ts` — CONTEXT.md explicitly calls
this out as the location.

```typescript
function updateNewRowField(newRowIndex: number, key: string, value: unknown) {
  if (newRowIndex < 0 || newRowIndex >= newRows.length) return;
  if (key === 'id') return;

  newRows[newRowIndex][key] = value;

  // Per-cell validation: immediate feedback after each save
  const rowErrors = invalidFields.get(newRowIndex) ?? new Set<string>();
  if (isValidValue(key, value)) {
    rowErrors.delete(key);
  } else {
    rowErrors.add(key);
  }
  if (rowErrors.size === 0) {
    invalidFields.delete(newRowIndex);
  } else {
    invalidFields.set(newRowIndex, rowErrors);
  }
  invalidFields = new Map(invalidFields);  // trigger Svelte reactivity
}
```

This replaces the current "clear-only" approach. The `isValidValue` function already exists in
the same file and handles both REQUIRED_FIELDS and constraint list checks.

### Pattern 4: Header Menu Verification

**What:** Confirm the header menu's prop chain is correct after the data move. `headerMenu.svelte`
already receives `assets` and `baseAssets` as explicit props (not context reads).

**Current data flow:**
```
GridContainer reads dataCtx.assets       → passes as {assets} prop to HeaderMenu
GridContainer reads dataCtx.baseAssets   → passes as {baseAssets} prop to HeaderMenu
```

After the data move, `dataCtx.assets` and `dataCtx.baseAssets` are still seeded by `EventListener`
(via `$effect`). The HeaderMenu prop chain is unchanged — `GridContainer` still reads from context
and passes to HeaderMenu.

**What needs checking:** Whether `searchManager.getFilterItems(key, assets, baseAssets)` called with
the combined `dataCtx.assets` (which includes new rows with empty strings) pollutes the filter
dropdown with empty entries. New rows have `''` for most fields — these would appear as filter items.

**Fix if needed:** Pass `filteredAssets` (not `assets`) to `getFilterItems`. In `GridContainer`:
```typescript
// Instead of:
assets={dataCtx.assets}
// Use:
assets={dataCtx.baseAssets}  // or filteredAssets from dataCtx
```
`baseAssets` are the real committed rows — correct source for filter item enumeration.

### Anti-Patterns to Avoid

- **Using `$bindable()` for `baseAssets`/`filteredAssets`**: The EventHandler getter/setter pattern
  is already established. Switching to `$bindable` would require changing `EventHandlerDeps` type.
  Keep getter/setter lambdas.
- **Moving `assets` derived to `+page.svelte`**: `+page.svelte` is above `GridContextProvider` and
  cannot call `getRowGenControllerContext()`. The derived value must stay in `EventListener`.
- **Removing the Toolbar's separate commit branches**: The Toolbar correctly shows distinct buttons
  for existing changes vs. new rows (mutually exclusive due to `handleAddNewRow` guards). Keep this.
- **All new rows with `id: "NEW"` (same string)**: Svelte keying breaks with duplicate keys. Use
  `"NEW-N"` counter.
- **Calling `changes.update()` for new row saves**: The `isNewRow` guard in `GridOverlays.onSave`
  prevents this. Do not remove or weaken this guard.
- **Backend cell-lock signal for new rows**: The current code path (routing to
  `rowGen.updateNewRowField`) never calls the realtime signal. The realtime signal path is in
  `gridEdit.ts` via `history.record` + `changes.update`, which is the existing-row branch. Preserve
  this separation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Upward mutation from EventListener | Custom event bus, store | Setter lambda props | Matches existing EventHandler injection pattern exactly |
| Unique new row keys | UUID library | `"NEW-N"` counter | Simpler, no dep, sufficient for local-only rows |
| Per-cell validation | New validation service | `isValidValue()` in rowGeneration | Function already exists, handles REQUIRED_FIELDS + constraints |

**Key insight:** This phase is primarily a data relocation, not new capability. The editing,
validation, commit, and visual indication infrastructure already works.

---

## Common Pitfalls

### Pitfall 1: Prop vs. Reactive $state — Closure Capture

**What goes wrong:** EventHandler's `getBaseAssets: () => baseAssets` lambda captures the variable
reference. If `baseAssets` is a prop received by EventListener, mutations via `setBaseAssets(v)`
may not update the closure's view of `baseAssets`.

**Why it happens:** In Svelte 5, `$props()` values are reactive — reading `baseAssets` in a closure
reflects the current prop value. However, `setBaseAssets` is a setter that mutates the parent's
`$state`. The parent updates, re-renders, and passes the new value as a prop. EventListener's local
`baseAssets` binding updates.

**How to avoid:** The getter lambda `() => baseAssets` correctly captures the reactive prop value
in Svelte 5 because props are reactive references. When `setBaseAssets(v)` is called, the parent
updates its `$state`, which flows down as the new prop value. The getter lambda then returns the
updated value. This works because `createEventHandler` is called once during sync init — the
lambdas capture the variable, not the value.

**Warning signs:** `getBaseAssets()` returns stale array after `setBaseAssets` is called. EventHandler
filter/sort operate on old data.

### Pitfall 2: NEW ID Breaks Svelte {#each} Keying

**What goes wrong:** Two new rows both have `id: "NEW"` → Svelte sees duplicate keys → rows render
incorrectly, one row disappears, or editing one row mutates the other.

**Why it happens:** `{#each visibleData.items as asset, i (asset.id || startIndex + i)}` uses
`asset.id` as the key. Duplicate keys confuse Svelte's reconciler.

**How to avoid:** Use `"NEW-N"` with a counter. Reset counter in `clearNewRows()` so after commit,
the next batch starts at `"NEW-1"` again.

**Warning signs:** Adding two new rows causes one to disappear. Editing one new row cell visually
updates the wrong row.

### Pitfall 3: setNextIdProvider $effect Leftover

**What goes wrong:** The `$effect` in EventListener that calls `rowGen.setNextIdProvider(...)` is
left in place after the ID strategy changes. It calls a method that no longer exists on the
controller → TypeScript error or silent no-op.

**Why it happens:** The `$effect` block (EventListener lines 126-132) wires the provider. After the
controller switches to its own counter, this effect must be removed.

**How to avoid:** Delete the `setNextIdProvider` `$effect` from EventListener. Remove
`setNextIdProvider` from the controller's public API. svelte-check will catch any lingering references.

**Warning signs:** `svelte-check` reports "Property 'setNextIdProvider' does not exist on type
RowGenerationController".

### Pitfall 4: isNewRow Guard Broken by filteredAssetsCount Mismatch

**What goes wrong:** `GridOverlays.onSave` gates on `editRow >= dataCtx.filteredAssetsCount`. If
`filteredAssetsCount` is stale (not yet updated after a filter operation), a new row edit is
incorrectly routed to `changes.update()` with a `"NEW-1"` id. The ChangeController then holds an
invalid change that blocks commit.

**Why it happens:** `dataCtx.filteredAssetsCount` is updated in an `$effect` which runs
asynchronously. There is a window between `setFilteredAssets(result.assets)` and the effect
syncing `dataCtx.filteredAssetsCount = filteredAssets.length`.

**How to avoid:** The sync happens before any user interaction is possible (effects run before
browser paint). In practice this is not a real race. But to be safe: the EventListener seed
(`dataCtx.filteredAssetsCount = ...`) is synchronous and runs at script init. The `$effect` keeps
it updated. This is the same pattern that already works today.

**Warning signs:** Yellow dirty-cell overlays on new rows (means `changes.update` was called with
`"NEW-1"` id). Commit button says "0 changes" but commit endpoint receives data.

### Pitfall 5: handleAddNewRow scroll target after data move

**What goes wrong:** `handleAddNewRow` in EventListener currently sets:
```typescript
const lastRowIndex = assets.length - 1;
viewCtx.scrollToRow = lastRowIndex;
selection.selectCell(lastRowIndex, 1);
```
Since `assets = $derived([...filteredAssets, ...rowGen.newRows])` still includes new rows (the
derived value stays in EventListener), `assets.length` correctly covers the new row. This pitfall
only applies if the `assets` derived is incorrectly moved to exclude new rows.

**How to avoid:** Keep `const assets = $derived([...filteredAssets, ...rowGen.newRows])` inside
EventListener. The `handleAddNewRow` code does not need to change.

**Warning signs:** After adding a new row, the grid does not scroll to the new row. The selection
cursor lands on the wrong cell.

### Pitfall 6: Header Menu Filter Items Include Empty New Row Values

**What goes wrong:** `searchManager.getFilterItems(key, assets, baseAssets)` called with the
combined `assets` array (including new rows) adds empty strings to filter dropdown options.

**Why it happens:** New rows have `''` for most fields. These empty strings appear as unique values.

**How to avoid:** In `GridContainer`, pass `dataCtx.baseAssets` (not `dataCtx.assets`) to
`HeaderMenu` for the `assets` prop used in `getFilterItems`. Real filter item enumeration should
only consider committed rows.

**Warning signs:** An empty option appears at the top of filter dropdowns when new rows exist.

---

## Code Examples

Verified patterns from direct codebase inspection:

### Current EventListener data ownership (lines to remove/change)
```typescript
// EventListener.svelte — CURRENT (lines 61-67)
// svelte-ignore state_referenced_locally
let baseAssets: Record<string, any>[] = $state(data.assets ?? []);
// svelte-ignore state_referenced_locally
let filteredAssets: Record<string, any>[] = $state(data.searchResults ?? data.assets ?? []);

const assets = $derived([...filteredAssets, ...rowGen.newRows]);
const keys = $derived(assets.length > 0 ? Object.keys(assets[0]) : []);
```

```typescript
// EventListener.svelte — AFTER
// baseAssets and filteredAssets come from props
const assets = $derived([...filteredAssets, ...rowGen.newRows]);  // unchanged
const keys = $derived(assets.length > 0 ? Object.keys(assets[0]) : []);  // unchanged
```

### setNextIdProvider $effect to delete
```typescript
// EventListener.svelte — DELETE THIS ENTIRE $effect (lines 126-132)
$effect(() => {
  rowGen.setNextIdProvider(() => {
    if (baseAssets.length === 0) return 1;
    const maxId = Math.max(...baseAssets.map((a: any) => typeof a.id === 'number' ? a.id : 0));
    return maxId + 1 + rowGen.newRowCount;
  });
});
```

### GridOverlays FloatingEditor onSave — already correct, add isValidValue check
```typescript
// GridOverlays.svelte — current onSave (lines 346-358)
<FloatingEditor onSave={(change) => {
  const editRow = editCtx.editRow;
  const isNewRow = editRow >= dataCtx.filteredAssetsCount;
  if (isNewRow) {
    const newRowIndex = editRow - dataCtx.filteredAssetsCount;
    rowGen.updateNewRowField(newRowIndex, change.key, change.newValue);
    // Per-cell validation is now INSIDE updateNewRowField — no extra call needed here
  } else {
    history.record(change.id, change.key, change.oldValue, change.newValue);
    changes.update(change);
  }
}} />
```

No change to GridOverlays needed if per-cell validation is added to `updateNewRowField` directly.

### handleCommitCreate — string id stripping (already correct)
```typescript
// EventHandler.svelte.ts — handleCommitCreate (line 151)
const rowsToSave = newRows.map((row) => {
  const { id, ...fields } = row;  // strips "NEW-1" id correctly
  return fields;
});
```

No change needed — destructuring works identically for string `id`.

### GridContainer — isNewRow visual distinction (already correct)
```svelte
<!-- GridContainer.svelte lines 186-189 — already applies blue background to new rows -->
{@const isNewRow = actualIndex >= dataCtx.filteredAssetsCount}
<div
  class="flex border-b border-neutral-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700
         {isNewRow ? 'bg-blue-200 dark:bg-blue-500/20' : ''}"
  style="height: {rowHeight}px;"
>
```

No change needed for visual distinction — it is already implemented. The "NEW" in the ID column
comes from `asset.id = "NEW-1"` rendering via GridRow's `{asset[key]}`.

---

## State of the Art

| Old Approach | Current Approach (Phase 6.1) | Phase 7 Target |
|---|---|---|
| Numeric ID via `nextIdProvider()` | Same | String `"NEW-N"` counter |
| `baseAssets` owned by `EventListener` | Same | `baseAssets` owned by `+page.svelte` |
| Optimistic-only validation in `updateNewRowField` | Same | Immediate per-cell validation |
| `filteredAssets` owned by `EventListener` | Same | `filteredAssets` owned by `+page.svelte` |

**Deprecated by this phase:**
- `setNextIdProvider()` method — removed from `RowGenerationController`
- `nextIdProvider` and `nextIdProvider` `$state` variable in `rowGeneration.svelte.ts`
- The `$effect` in EventListener that calls `rowGen.setNextIdProvider()`

---

## Open Questions

1. **Does `+page.svelte` need the `user` and constraints data as `$state` too?**
   - What we know: CONTEXT.md says `+page.svelte` owns "assets, user, constraints, everything."
     Currently `dataCtx.user = data.user` is set via `$effect` in EventListener from `data` prop.
     `data` is a SvelteKit `PageProps` that is already reactive (updates on navigation).
   - What's unclear: Does `user` and constraint data (`data.locations`, etc.) need to lift to
     `+page.svelte` as `$state`, or is it sufficient to pass `data` as a prop to EventListener
     (current pattern)?
   - Recommendation: The CONTEXT.md phrase "owns ALL data" likely means `baseAssets` and
     `filteredAssets` specifically — the mutable lists that EventHandler writes to. `user` and
     constraints come from the SvelteKit `data` prop which is already reactive and owned by the
     route. No need to lift `user`/constraints separately. Pass `data` prop to EventListener
     as today; only lift `baseAssets`/`filteredAssets`.

2. **What exactly needs to change in HeaderMenu?**
   - What we know: `headerMenu.svelte` already receives `assets` and `baseAssets` as explicit props.
     `GridContainer` passes `dataCtx.assets` and `dataCtx.baseAssets`. After the data move,
     `dataCtx` is still seeded correctly by EventListener via `$effect`. The prop chain is intact.
   - What's unclear: The CONTEXT.md flags header menu as "needs rethinking." From codebase
     inspection, `headerMenu.svelte.ts` does NOT read assets from context — it receives them as
     props.
   - Recommendation: Treat as a verification task. Confirm `GridContainer` passes `dataCtx.baseAssets`
     (not `dataCtx.assets`) to HeaderMenu for filter item enumeration. If it currently passes
     `dataCtx.assets` (combined, including new rows), change it to `dataCtx.baseAssets`.

3. **Should `addNewRow` route through the event queue?**
   - What we know: CONTEXT.md says "Add Row button dispatches through the event queue." Currently
     `handleAddNewRow` is local-only (not queued) — marked as "local-only, NOT queued" in
     EventListener.
   - What's unclear: Does this require adding an `ADD_ROW` event type to `EventQueue`?
   - Recommendation: `handleAddNewRow` has no network operation — it only calls `rowGen.addNewRows()`
     and `tick()`. The event queue is for serializing network operations. Keep `handleAddNewRow`
     as local-only. The CONTEXT.md language describes conceptual flow, not literal queue dispatch.

---

## Implementation Plan Outline (for planner reference)

### Suggested Plan 1: Data Ownership Move
**Scope:** Move `baseAssets` and `filteredAssets` `$state` declarations to `+page.svelte`. Add
setter lambda props to EventListener. Remove the `state_referenced_locally` svelte-ignore comments.
**Files touched:** `+page.svelte`, `EventListener.svelte`
**Risk:** LOW — getter/setter pattern already used in EventHandler; change is moving declarations.
**Verification:** `svelte-check` passes. App loads. Sort/filter/view-change all still work. Commit
existing row changes still works.

### Suggested Plan 2: NEW ID Strategy + Per-Cell Validation
**Scope:** Replace `nextIdProvider`/`getNextId()` with `"NEW-N"` counter. Add per-cell validation
to `updateNewRowField`. Remove `setNextIdProvider` call from EventListener. Remove `setNextIdProvider`
from `RowGenerationController` type.
**Files touched:** `rowGeneration.svelte.ts`, `EventListener.svelte`, `gridContext.svelte.ts`
(type update if needed)
**Risk:** LOW — contained change to one controller.
**Verification:** Add new row → ID column shows "NEW-1". Edit required field with invalid value →
yellow overlay appears. Edit with valid value → yellow clears. Commit → rows saved, counter resets,
next batch starts "NEW-1" again.

### Suggested Plan 3: Header Menu Verification + Cleanup
**Scope:** Verify `GridContainer` passes `dataCtx.baseAssets` to HeaderMenu for filter items.
Remove unused `setNextIdProvider`, `getValidNewRows`, `getInvalidNewRows` from controller public
API. Run `svelte-check` to confirm 0 errors.
**Files touched:** `GridContainer.svelte` (if filter prop fix needed), `rowGeneration.svelte.ts`
(remove unused exports)
**Risk:** LOW — mostly verification and cleanup.
**Verification:** `svelte-check` passes. Header menu filter dropdowns show no empty entries when
new rows exist. Adding multiple new rows, then switching views, clears rows correctly.

---

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `/frontend/src/routes/+page.svelte` — current thin wrapper, 19 lines
- `/frontend/src/lib/grid/eventQueue/EventListener.svelte` — full file: data ownership, handler creation, effects
- `/frontend/src/lib/grid/eventQueue/EventHandler.svelte.ts` — handleCommitCreate id strip, setter injection
- `/frontend/src/lib/grid/utils/rowGeneration.svelte.ts` — full controller: nextIdProvider, updateNewRowField, validateAll
- `/frontend/src/lib/components/grid/GridOverlays.svelte` — isNewRow routing fork, FloatingEditor onSave
- `/frontend/src/lib/components/grid/GridContainer.svelte` — isNewRow background, HeaderMenu props
- `/frontend/src/lib/components/grid/GridRow.svelte` — renders asset[key], no changes needed
- `/frontend/src/lib/components/grid/Toolbar.svelte` — addNewRow button, commit branches
- `/frontend/src/lib/context/gridContext.svelte.ts` — all domain context types, controller context pairs
- `/frontend/src/lib/context/GridContextProvider.svelte` — controller initialization order
- `/frontend/src/lib/grid/components/header-menu/headerMenu.svelte` — props confirmed: assets, baseAssets
- `/frontend/src/lib/grid/components/header-menu/headerMenu.svelte.ts` — NO context reads, pure state
- `/frontend/src/lib/grid/components/context-menu/contextMenu.svelte` — showDelete for new rows already implemented
- `/frontend/src/lib/grid/utils/gridEdit.svelte.ts` — save() returns { id: asset.id, ... }
- `/frontend/src/routes/+page.server.ts` — data shape: assets, searchResults, user, constraints

### Secondary (MEDIUM confidence)
- Svelte 5 `$props()` reactive prop semantics — confirmed from MEMORY.md project notes + usage patterns in codebase
- `createContext` lifecycle rules — confirmed from GridContextProvider pattern (sync init required)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all existing
- Architecture: HIGH — all findings from direct code inspection; no external library docs needed
- Pitfalls: HIGH — mechanically derived from actual code paths and Svelte 5 rules

**Research date:** 2026-02-27
**Valid until:** 2026-03-30 (stable codebase; re-verify if GridContainer or EventListener change
significantly before planning begins)
