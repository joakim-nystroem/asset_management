# Phase 7: Row Generation Redesign - Research

**Researched:** 2026-02-27
**Domain:** Svelte 5 component architecture, virtual scroll, context management, grid row rendering
**Confidence:** HIGH — all findings are from direct codebase inspection, no external sources needed

## Summary

This phase replaces the current "rowGen appended to assets array" pattern with a self-contained `RowGeneration.svelte` + `rowGeneration.svelte.ts` component pair. The redesign eliminates five distinct code smells that were identified in Phase 6.1 UAT: scattered context across 5 components, `filteredAssetsCount` boundary index math in overlay logic, an `isNewRow` routing fork in GridOverlays' FloatingEditor onSave, mixed data in the main assets array, and dual-path validation.

The existing codebase is well-understood. Almost all the logic needed already exists — it just needs to be reorganized. The `rowGeneration.svelte.ts` controller is complete and working. The `GridRow` component is already stateless and reusable. The `FloatingEditor` already works by reading `editCtx` — it does not need to know whether it is editing a new row or an existing one. The main design challenge is: (1) how the `RowGeneration` component positions its own `FloatingEditor` outside the virtual-scroll translated chunk, and (2) how the `RowGeneration` component publishes its context at the right point in the Svelte lifecycle.

**Primary recommendation:** Build `RowGeneration.svelte` as a standalone section rendered after the virtual-scroll chunk inside GridContainer's scroll area. It creates and publishes its own rowGen controller context at component init. FloatingEditor for new rows is rendered inside the RowGeneration component, positioned absolutely relative to the RowGeneration section's DOM origin — not relative to the virtual-scroll translateY chunk. The main assets `$derived` in EventListener drops the `...rowGen.newRows` spread entirely.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Architecture
- New component pair: `rowGeneration.svelte` + `rowGeneration.svelte.ts` in `frontend/src/lib/grid/components/row-generation/`
- Move existing `frontend/src/lib/grid/utils/rowGeneration.svelte.ts` to new location (keep all logic)
- RowGeneration component renders new rows using `<GridRow>` components (same as regular rows)
- Single context pair exported so Toolbar can read `hasNewRows` for commit button
- Visually distinguishable new rows (subtle background or left border for "pending" state)

#### Component Placement
- Inside `GridContainer.svelte`, after virtual-scrolled regular rows, inside the scroll area
- Scrolls with grid content
- Virtual scroll must account for new row heights

#### Editing Flow
- Double-click new row cell → same `editCtx` mechanism triggers FloatingEditor
- FloatingEditor opens at correct position relative to the new row
- On save → component's own onSave handler routes to `updateNewRowField()`
- No routing fork in GridOverlays — GridOverlays only handles existing rows

#### Commit Flow
- Toolbar sees `rowGen.hasNewRows` → shows Commit button
- Commit calls `dataCtx.addRows()` → enqueues `{ type: 'COMMIT', mode: 'create' }`
- EventHandler.handleCommitCreate reads from rowGen context → POST `/api/create/asset`
- Same flow as today, cleaner dependency chain

#### State Management
- `newRows: NewRow[]` — scaffold rows pending commit
- `invalidFields: Map<number, Set<string>>` — validation state
- Validation logic: REQUIRED_FIELDS + constraint lists
- Methods: `addNewRows()`, `updateNewRowField()`, `deleteNewRow()`, `validateAll()`, `clearNewRows()`

#### Cleanup Requirements
- Remove `createRowGenerationController()` from GridContextProvider
- Remove `isNewRow` routing fork from GridOverlays FloatingEditor onSave
- Remove `getRowGenControllerContext` from GridOverlays and contextMenu
- Remove new-row detection from dirty cell overlay logic in GridOverlays
- Remove "Delete Row" for new rows from contextMenu (handled by RowGeneration's own context menu)
- Remove `rowGen.newRows` from assets derived in EventListener (`assets = $derived([...filteredAssets])` — no more mixing)
- Delete old `frontend/src/lib/grid/utils/rowGeneration.svelte.ts` after migration

#### Toolbar
- Keep `getRowGenControllerContext` for reading `hasNewRows` (commit button visibility)
- Keep the `{:else if rowGen.hasNewRows}` commit button block
- No structural changes — Toolbar just reads state, doesn't manage it

#### EventHandler
- `handleCommitCreate` reads rowGen from context (or receives via DI)
- No structural changes to commit logic itself

### Claude's Discretion
- Exact visual styling for pending-row indicator (background color, border style)
- How RowGeneration component handles its own context menu internally
- Whether virtual scroll needs adjustment or new rows sit outside virtual scroll
- Error handling for failed commits
- Keyboard navigation between regular rows and new rows

### Deferred Ideas (OUT OF SCOPE)
None — PRD covers phase scope
</user_constraints>

---

## Standard Stack

No new libraries are needed. This phase uses only what is already in the project.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Svelte 5 | 5.49.1 | Component framework, runes, `createContext` | Project standard |
| SvelteKit | latest | Routing, page context | Project standard |
| Tailwind CSS | latest | Utility classes for visual styling | Project standard |

### Relevant Svelte 5 APIs in Use
| API | Where Used | Notes |
|-----|-----------|-------|
| `createContext<T>()` | `gridContext.svelte.ts` | Returns `[getter, setter]` tuple — standard pattern since 5.40 |
| `$state` | All controllers | Reactive local state |
| `$derived` | EventListener, GridOverlays | Computed values |
| `$effect` | EventListener, GridContainer | Side effects |
| `{@attach}` | GridOverlays | Used for keyboard shortcut attachment — NOT needed by RowGeneration |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
frontend/src/lib/grid/components/
└── row-generation/
    ├── rowGeneration.svelte        # NEW — renders new rows, FloatingEditor for new rows
    └── rowGeneration.svelte.ts     # MOVED from utils/ — state + context pair + validation
```

Files to delete:
```
frontend/src/lib/grid/utils/rowGeneration.svelte.ts   # DELETE after migration
```

### Pattern 1: Context-Publishing Component Pair

This project's established pattern (used by context-menu, edit-dropdown, filter-panel, header-menu, floating-editor, and the controller contexts in GridContextProvider):

- The `.svelte.ts` file contains the factory function and exports the context `[getter, setter]` pair
- A component calls `setRowGenContext(controller)` during its synchronous `<script>` initialization
- Consumers anywhere in the subtree call `getRowGenContext()`

**CRITICAL Svelte 5 rule:** `setContext` / `setRowGenControllerContext` must be called during synchronous component initialization, not inside `$effect` or event handlers. The RowGeneration component must call `setRowGenControllerContext(rowGenController)` at the top level of its `<script>` block.

**Current pattern (GridContextProvider):**
```typescript
// GridContextProvider.svelte — current approach
const rowGenController = createRowGenerationController();
setRowGenControllerContext(rowGenController);
```

**New pattern (RowGeneration.svelte):** The controller is created and published by RowGeneration itself instead of GridContextProvider. GridContextProvider no longer needs to know about rowGen at all.

```typescript
// rowGeneration.svelte.ts — export context pair alongside factory
export const [getRowGenContext, setRowGenContext] = createContext<RowGenerationController>();

// RowGeneration.svelte — creates and publishes at init time
import { createRowGenerationController } from './rowGeneration.svelte.ts';
import { setRowGenControllerContext } from '$lib/context/gridContext.svelte.ts';

const rowGenController = createRowGenerationController();
setRowGenControllerContext(rowGenController);  // Must be at script top-level
```

This works because `RowGeneration.svelte` is a child of `GridContextProvider` (via GridContainer), so it is within the Svelte context tree. All consumers of `getRowGenControllerContext()` — Toolbar, EventListener, EventHandler — remain children of GridContextProvider, so they can still access the context after RowGeneration publishes it.

**However:** Toolbar and EventListener call `getRowGenControllerContext()` at their own init time. If RowGeneration.svelte renders after Toolbar and EventListener in the component tree, the context may not be set yet when Toolbar/EventListener try to read it.

**Component tree order matters:**
```
GridContextProvider
  └── (slot content from +page.svelte):
        EventListener   ← calls getRowGenControllerContext() at init
        Toolbar         ← calls getRowGenControllerContext() at init
        GridContainer
          └── RowGeneration  ← calls setRowGenControllerContext() at init
        ContextMenu
```

In this tree, `EventListener` and `Toolbar` initialize **before** `GridContainer` (and therefore before `RowGeneration`). This means they will call `getRowGenControllerContext()` before RowGeneration has called `setRowGenControllerContext()` — causing a missing-context crash.

**Solution options (in order of preference):**

**Option A (Recommended):** Keep `setRowGenControllerContext` in `GridContextProvider.svelte` but remove the full controller creation from there. Instead, GridContextProvider creates a lightweight placeholder or keeps creating the full controller. RowGeneration does NOT re-create the controller — it just reads from context via `getRowGenControllerContext()`.

This is the current approach (controller created in GridContextProvider, RowGeneration reads it). The redesign's goal is to make RowGeneration own its visual rendering, not necessarily own the controller lifecycle.

**Option B:** Move RowGeneration before EventListener and Toolbar in +page.svelte rendering order (renders but is invisible if no new rows). Then it sets the context before consumers read it.

**Option C:** GridContextProvider continues to create the controller. RowGeneration only adds rendering logic — it reads `getRowGenControllerContext()` like Toolbar does. This requires the LEAST change and is safest.

**Recommendation: Use Option C.** The CONTEXT.md says "Move existing `rowGeneration.svelte.ts` to new location (keep all logic)" and "Single context pair exported so Toolbar can read `hasNewRows`." The context pair itself does not need to move — only the controller initialization location changes. Given the lifecycle constraint, **GridContextProvider should continue creating the rowGen controller and publishing it**. RowGeneration.svelte becomes a pure rendering component that reads from context, exactly as GridRow and GridOverlays do for their respective domains.

### Pattern 2: RowGeneration as Pure Rendering Component

The component's responsibility:
1. Read `rowGenController` from context via `getRowGenControllerContext()`
2. For each `rowGen.newRows[i]`, render a `<GridRow>` with the new row data
3. Handle `ondblclick`, `oncontextmenu`, `onmousedown` on its own rows
4. Render its own `<FloatingEditor>` with its own `onSave` routing to `updateNewRowField()`

```svelte
<!-- rowGeneration.svelte (sketch) -->
<script lang="ts">
  import { getRowGenControllerContext, getColumnContext, getEditingContext, getDataContext } from '$lib/context/gridContext.svelte.ts';
  import GridRow from '$lib/components/grid/GridRow.svelte';
  import FloatingEditor from '$lib/grid/components/floating-editor/FloatingEditor.svelte';
  import { createEditController } from '$lib/grid/utils/gridEdit.svelte.ts';

  const rowGen = getRowGenControllerContext();
  const colCtx = getColumnContext();
  const editCtx = getEditingContext();
  const dataCtx = getDataContext();
  const edit = createEditController();
</script>

{#each rowGen.newRows as newRow, i}
  <div
    class="flex border-b border-neutral-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-500/10 border-l-4 border-l-blue-400"
    ondblclick={(e) => { /* startEdit for this new row */ }}
    oncontextmenu={(e) => { /* delete row context menu */ }}
  >
    <GridRow asset={newRow} keys={colCtx.keys} actualIndex={dataCtx.filteredAssetsCount + i} />
  </div>
{/each}

{#if editCtx.isEditing && editCtx.editRow >= dataCtx.filteredAssetsCount}
  <FloatingEditor onSave={(change) => {
    const newRowIndex = editCtx.editRow - dataCtx.filteredAssetsCount;
    rowGen.updateNewRowField(newRowIndex, change.key, change.newValue);
  }} />
{/if}
```

### Pattern 3: FloatingEditor Positioning for New Rows

**Critical implementation detail.** The current `FloatingEditor` is rendered inside the virtual-scroll translateY chunk in GridOverlays. Its position is computed as:

```
top = rows.getOffsetY(editRow) - virtualScroll.getOffsetY(rows)
```

This subtracts the chunk's translateY origin to get position relative to the chunk's top edge.

If RowGeneration places its FloatingEditor **outside** the virtual-scroll translated div (rendered after it at the GridContainer level), the position computation is different:
- The FloatingEditor would be positioned relative to the GridContainer's inner div origin (top of scrollable content area, after the 32px header)
- For new rows at index `filteredAssetsCount + i`:
  - `rows.getOffsetY(filteredAssetsCount + i)` — total pixel offset from top for that row
  - This is already absolute from the content area origin, so no subtraction needed

However, the actual pixel position of new rows in the DOM may differ from `rows.getOffsetY()` because new rows are not tracked in the virtualScrollManager's row height system (which computes offsets from `rowHeights` map). New rows rendered below the virtual-scroll chunk would need their position computed differently.

**Simplest approach:** Position the FloatingEditor inside RowGeneration's own container using `position: relative` on the container and `position: absolute` on the FloatingEditor. The editor position is then computed relative to that container:
- `top` = row index within RowGeneration * rowHeight (or accumulated heights)
- `left` = sum of column widths before `editCol`

This avoids the virtual-scroll coordinate system entirely for new rows.

**OR:** Keep the FloatingEditor in GridOverlays but add back the isNewRow routing only in GridOverlays' FloatingEditor onSave (not the full routing fork — just the callback assignment). This is simpler but does not achieve the "no routing fork in GridOverlays" goal.

**Recommendation:** Place FloatingEditor inside RowGeneration. Position relative to RowGeneration's container. Use a simple local computation: `top = i * rowHeight`, `left = sumColumnWidths(0, editCol)`.

### Pattern 4: Virtual Scroll Accommodation

The virtual scroll currently renders `visibleData.items` from `data.slice(startIndex, endIndex)` where `data = dataCtx.assets`. When `assets` no longer includes new rows, the virtual scroll naturally covers only real rows.

New rows sit **below** the virtual-scroll translated chunk in the DOM. The scroll container's total height div currently uses:
```
style="height: {virtualScroll.getTotalHeight(assets.length, rows) + 32 + 16}px;"
```

With new rows excluded from `assets`, this height calculation needs to add new row heights:
```
height: {virtualScroll.getTotalHeight(filteredAssets.length, rows) + rowGen.newRowCount * rowHeight + 32 + 16}px
```

This ensures the scroll container is tall enough to accommodate new rows rendered below the virtual chunk.

### Anti-Patterns to Avoid

- **Context set inside $effect:** Svelte 5's `setContext` only works during synchronous component initialization. Never call `setRowGenControllerContext()` inside `$effect`.
- **Re-creating the controller in RowGeneration:** If GridContextProvider already creates it, RowGeneration reading from context (not creating a new instance) avoids two independent controller instances with separate state.
- **Mixing new rows back into assets:** The whole point of this redesign is that `assets = $derived([...filteredAssets])` — no spread of `rowGen.newRows`. All places that currently read `dataCtx.assets` for row count/iteration treat only real rows.
- **isNewRow boundary checks in GridOverlays:** Once RowGeneration owns its FloatingEditor, GridOverlays' dirtyCellOverlays computation should not check `row >= dataCtx.filteredAssetsCount`. The dirty cell overlay for new rows is rendered by RowGeneration, not GridOverlays.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Row rendering | Custom cell layout | `<GridRow>` component | Already handles keys, widths, data-row/data-col attributes |
| Cell editing | Custom input | `<FloatingEditor>` via `editCtx` | Dropdown, autocomplete, blur/keyboard handling all built in |
| Context sharing | Prop drilling | `createContext` / `getRowGenControllerContext` | Established pattern; avoids prop waterfall through GridContainer |
| Validation | New validation system | Existing `isValidValue` in rowGeneration.svelte.ts | Already handles REQUIRED_FIELDS + constraint lists |
| Visual distinction | Custom component | Tailwind classes on wrapper div | `bg-blue-50 border-l-4 border-l-blue-400` or similar |

**Key insight:** Everything that makes a new row work as a grid row already exists. The task is wiring, not building.

---

## Common Pitfalls

### Pitfall 1: Context Lifecycle — Consumer Before Publisher

**What goes wrong:** `getRowGenControllerContext()` throws "context not found" if called before `setRowGenControllerContext()`.

**Why it happens:** Svelte 5 context is set during synchronous component initialization. Components initialize in tree order: parent first, then children left-to-right. EventListener and Toolbar are siblings of GridContainer, rendered before it. If RowGeneration (inside GridContainer) calls `setRowGenControllerContext()`, it runs after EventListener and Toolbar have already called `getRowGenControllerContext()` and crashed.

**How to avoid:** Keep `setRowGenControllerContext()` in `GridContextProvider.svelte`. GridContextProvider initializes first (it is the root wrapper), so all consumers initialized later will find the context. RowGeneration does not need to publish context — it reads it.

**Warning signs:** "Cannot find context" runtime error. Crash on page load when new rows exist. Works if RowGeneration is temporarily removed from tree.

### Pitfall 2: Double FloatingEditor — Edit State Leaks Between Sections

**What goes wrong:** Both GridOverlays and RowGeneration render `<FloatingEditor>` — one for existing rows, one for new rows. If the condition is wrong, both render simultaneously.

**Why it happens:** `editCtx.isEditing` is true for both new and existing row edits. Without a discriminating condition, both `{#if editCtx.isEditing}` blocks fire.

**How to avoid:** GridOverlays renders FloatingEditor only when `editCtx.editRow < dataCtx.filteredAssetsCount`. RowGeneration renders FloatingEditor only when `editCtx.editRow >= dataCtx.filteredAssetsCount`. These are mutually exclusive conditions.

```svelte
<!-- GridOverlays -->
{#if editCtx.isEditing && editCtx.editRow < dataCtx.filteredAssetsCount}
  <FloatingEditor onSave={...} />
{/if}

<!-- RowGeneration -->
{#if editCtx.isEditing && editCtx.editRow >= dataCtx.filteredAssetsCount}
  <FloatingEditor onSave={...} />
{/if}
```

**Warning signs:** Two editors appear simultaneously. Save routes to the wrong handler (existing row change written to new row state or vice versa).

### Pitfall 3: Scroll Container Height Under-Counts New Rows

**What goes wrong:** New rows are rendered below the virtual-scroll chunk, but the scroll container height does not account for them. User cannot scroll to the last new row.

**Why it happens:** The container height is computed from `virtualScroll.getTotalHeight(assets.length, rows)`. If `assets` no longer includes new rows, the height does not include their pixel contribution.

**How to avoid:** Add new row height contribution explicitly:
```svelte
style="height: {virtualScroll.getTotalHeight(dataCtx.filteredAssetsCount, rows)
  + rowGen.newRowCount * virtualScroll.rowHeight + 32 + 16}px;"
```

**Warning signs:** Last new row is partially cut off or inaccessible via scroll. `scrollToRow` lands on the wrong position.

### Pitfall 4: GridRow data-row Index Collision

**What goes wrong:** New rows rendered by RowGeneration use `actualIndex = dataCtx.filteredAssetsCount + i`. GridContainer's event delegation (`onmousedown`, `ondblclick`) reads `data-row` and calls `selection.handleMouseDown(row, col, e)` which updates selection state. If selection logic treats all `data-row` values as indices into `dataCtx.assets`, indices beyond `filteredAssetsCount` will be out of bounds.

**Why it happens:** GridContainer's event delegation uses `data-row` from GridRow cells, which RowGeneration assigns as `filteredAssetsCount + i`. GridContainer's handlers call `dataCtx.assets[row]?.[key]` — but `dataCtx.assets` now only contains filteredAssets (no new rows), so indices >= filteredAssetsCount are undefined.

**How to avoid:** RowGeneration must stop propagation of `onmousedown`, `ondblclick`, `oncontextmenu` from its own rows so GridContainer's delegated handlers never fire on new row cells. RowGeneration handles all interaction for new rows itself.

```svelte
<!-- RowGeneration.svelte — stop propagation on the container -->
<div
  onmousedown={(e) => e.stopPropagation()}
  ondblclick={(e) => { e.stopPropagation(); /* own handler */ }}
  oncontextmenu={(e) => { e.stopPropagation(); /* own handler */ }}
>
  {#each rowGen.newRows as newRow, i}
    ...
  {/each}
</div>
```

**Warning signs:** Selecting a new row cell causes JS error about undefined asset. Regular row selection state breaks when clicking new rows.

### Pitfall 5: FloatingEditor Position Relative to Wrong Origin

**What goes wrong:** FloatingEditor renders at wrong position for new rows — appears inside the virtual-scroll chunk, displaced from the actual new row cell.

**Why it happens:** `computeEditorPosition` subtracts the virtualScroll chunk's `translateY` origin. New rows are NOT inside the translated chunk, so this subtraction is wrong.

**How to avoid:** Do NOT use `computeEditorPosition` from `floatingEditor.svelte.ts` for new rows. Compute position inline within RowGeneration:
- `top = (editCtx.editRow - dataCtx.filteredAssetsCount) * rowHeight` (or accumulated row heights)
- `left = sum of column widths before editCtx.editCol`
- `width = column width at editCtx.editCol`
- `height = rowHeight` (or specific row height)

RowGeneration's FloatingEditor is positioned with `position: absolute` inside a `position: relative` container wrapping the new rows section.

**Warning signs:** FloatingEditor appears at the top of the grid or overlapping the header. FloatingEditor position does not follow the new row cell.

### Pitfall 6: navigateError Uses filteredAssetsCount Boundary

**What goes wrong:** `navigateToError` in EventListener currently calculates invalid new row positions as `filteredAssets.length + i`. With new rows removed from `assets`, the index math in `navigateToError` and `dirtyCellOverlays` in GridOverlays must be updated to reflect that new rows are no longer in `dataCtx.assets`.

**Why it happens:** The current code in EventListener lines 328-336 explicitly iterates `rowGen.newRows` and uses `filteredAssets.length + i` as the row index. After the redesign, these rows don't exist in `dataCtx.assets` at all — `navigateToError` cannot use `selection.selectCell(row, col)` with new row indices because selection operates on `dataCtx.assets`.

**How to avoid:** `navigateToError` for new rows needs to either:
- Signal RowGeneration to scroll to/highlight the invalid cell (via a reactive signal on rowGen state)
- Or keep using `filteredAssetsCount + i` for scroll purposes — just know it refers to a "virtual" position RowGeneration understands

This is flagged as an open question below.

### Pitfall 7: EventListener `handleAddNewRow` Still Uses `assets.length`

**What goes wrong:** After the redesign, `handleAddNewRow` in EventListener calls:
```typescript
const lastRowIndex = assets.length - 1;
viewCtx.scrollToRow = lastRowIndex;
selection.selectCell(lastRowIndex, 1);
```
If `assets` no longer includes new rows, `assets.length - 1` is the last real row, not the last new row. The scroll and selection target the wrong row.

**How to avoid:** After adding a new row, scroll to `filteredAssets.length + rowGen.newRowCount - 1` — the logical position of the last new row. But since new rows are outside the virtual scroll, `viewCtx.scrollToRow` may not scroll to that position correctly.

Alternative: expose a method on rowGen context like `rowGen.scrollToLastNewRow()` that RowGeneration handles internally (e.g., using a local bind:this on the last new row div and calling `scrollIntoView`).

---

## Code Examples

Verified patterns from direct codebase inspection:

### Current Context Pair Pattern (gridContext.svelte.ts)
```typescript
// Source: /frontend/src/lib/context/gridContext.svelte.ts lines 120-122
export const [getChangeControllerContext, setChangeControllerContext] = createContext<ChangeController>();
export const [getHistoryControllerContext, setHistoryControllerContext] = createContext<HistoryController>();
export const [getRowGenControllerContext, setRowGenControllerContext] = createContext<RowGenerationController>();
```

### Controller Created in Common Ancestor (GridContextProvider)
```typescript
// Source: /frontend/src/lib/context/GridContextProvider.svelte lines 124-129
const changeController = createChangeController();
const historyController = createHistoryController();
const rowGenController = createRowGenerationController();
setChangeControllerContext(changeController);
setHistoryControllerContext(historyController);
setRowGenControllerContext(rowGenController);
```

### GridOverlays isNewRow Routing Fork to Remove
```typescript
// Source: /frontend/src/lib/components/grid/GridOverlays.svelte lines 346-358
{#if editCtx.isEditing}
  <FloatingEditor onSave={(change) => {
    const editRow = editCtx.editRow;
    const isNewRow = editRow >= dataCtx.filteredAssetsCount;
    if (isNewRow) {
      const newRowIndex = editRow - dataCtx.filteredAssetsCount;
      rowGen.updateNewRowField(newRowIndex, change.key, change.newValue);
    } else {
      history.record(change.id, change.key, change.oldValue, change.newValue);
      changes.update(change);
    }
  }} />
{/if}
```
After redesign: remove `isNewRow` branch, add `editCtx.editRow < dataCtx.filteredAssetsCount` condition to the `{#if}`.

### EventListener Mixed Assets Derived to Clean Up
```typescript
// Source: /frontend/src/lib/grid/eventQueue/EventListener.svelte lines 66-67
// BEFORE:
const assets = $derived([...filteredAssets, ...rowGen.newRows]);
// AFTER:
const assets = $derived([...filteredAssets]);
```

### GridContainer Row Rendering — Where RowGeneration Slots In
```svelte
<!-- Source: /frontend/src/lib/components/grid/GridContainer.svelte lines 176-199 -->
<div class="absolute top-8 w-full" style="transform: translateY({virtualScroll.getOffsetY(rows)}px);">
  <GridOverlays />
  {#each visibleData.items as asset, i (asset.id || visibleData.startIndex + i)}
    {@const actualIndex = visibleData.startIndex + i}
    ...
    <GridRow {asset} keys={colCtx.keys} {actualIndex} />
  {/each}
</div>
<!-- RowGeneration renders HERE — after the translated chunk, inside the scroll area -->
<RowGeneration />
```

### Scroll Container Height Fix
```svelte
<!-- Source: /frontend/src/lib/components/grid/GridContainer.svelte line 109 -->
<!-- BEFORE: -->
style="height: {virtualScroll.getTotalHeight(assets.length, rows) + 32 + 16}px;"
<!-- AFTER (assets is now filteredAssets only, add new rows contribution): -->
style="height: {virtualScroll.getTotalHeight(dataCtx.filteredAssetsCount, rows) + rowGen.newRowCount * virtualScroll.rowHeight + 32 + 16}px;"
```

### Dirty Cell Overlay — New Row Check to Remove from GridOverlays
```typescript
// Source: /frontend/src/lib/components/grid/GridOverlays.svelte lines 172-190
// BEFORE — contains isNewRow detection:
(row, col) => {
  const asset = dataCtx.assets[row];
  if (!asset) return false;
  const key = colCtx.keys[col];
  const isNewRow = row >= dataCtx.filteredAssetsCount;
  if (isNewRow) {
    const newRowIndex = row - dataCtx.filteredAssetsCount;
    return rowGen.isNewRowFieldInvalid(newRowIndex, key);
  }
  return changes.isInvalid(asset.id, key);
}
// AFTER — GridOverlays only handles existing rows:
(row, col) => {
  const asset = dataCtx.assets[row];
  if (!asset) return false;
  const key = colCtx.keys[col];
  return changes.isInvalid(asset.id, key);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| rowGen in page-level controllers | rowGen in GridContextProvider (shared) | Phase 06.1-03 | Shared instance, but scattered across 5 components |
| New rows spread into assets | Separate RowGeneration component | Phase 7 (this phase) | Clean data model, no index math |
| isNewRow fork in GridOverlays | RowGeneration owns its FloatingEditor | Phase 7 (this phase) | GridOverlays handles only existing rows |

---

## Open Questions

1. **navigateToError for new rows**
   - What we know: `navigateToError` uses `selection.selectCell(row, col)` and `viewCtx.scrollToRow = row` which assumes `row` is an index into `dataCtx.assets`. After redesign, new row indices are not in `dataCtx.assets`.
   - What's unclear: Should `navigateToError` skip new row errors entirely and let RowGeneration visually indicate invalid cells? Or should there be a new signal on `rowGenController` (e.g., `rowGen.focusInvalidCell(i)`) that RowGeneration subscribes to?
   - Recommendation: Add `focusFirstInvalidNewRow()` method to rowGenController. EventListener's `navigateToError` calls it for new row errors. RowGeneration subscribes to this signal and calls `scrollIntoView()` on the relevant DOM element. Keep existing row error navigation unchanged.

2. **handleAddNewRow scroll target**
   - What we know: Current code sets `viewCtx.scrollToRow = assets.length - 1` after adding a new row. After redesign, `assets` does not include new rows.
   - What's unclear: How does the scroll container reach the newly added row at the bottom?
   - Recommendation: After adding a new row, the RowGeneration container is already at the bottom of the scroll area. EventListener should trigger scrolling to the bottom of the container rather than using `viewCtx.scrollToRow`. One option: set a local `$effect` in RowGeneration that watches `rowGen.newRowCount` and calls `scrollIntoView` on the last new row div when count increases.

3. **ContextMenu for new rows — shared or separate?**
   - What we know: Current contextMenu.svelte handles both existing and new rows, with `showDelete` derived from `row >= dataCtx.filteredAssetsCount`. CONTEXT.md says "handled by RowGeneration's own context menu."
   - What's unclear: Does RowGeneration use `uiCtx.contextMenu` (the shared ContextMenuState) with an additional "Delete Row" entry shown conditionally? Or does it render a completely inline context menu?
   - Recommendation: RowGeneration uses an inline, minimal context menu (just "Delete Row") rendered directly in the component without using the shared ContextMenuState. This keeps the shared contextMenu clean and avoids the row index boundary check entirely.

---

## Validation Architecture

> Skipped — `workflow.nyquist_validation` not present in `.planning/config.json`; `workflow.verification: true` uses manual verification steps only.

### Verification Checklist (manual)
1. `cd frontend && npx svelte-check --tsconfig ./tsconfig.json` — must report 0 errors
2. `grep -r "getRowGenControllerContext" frontend/src/lib/components/ frontend/src/lib/grid/components/context-menu/` — must show 0 results outside `row-generation/` and `Toolbar.svelte`
3. `grep -r "rowGen.newRows" frontend/src/lib/grid/eventQueue/EventListener.svelte` — must return empty
4. Add new row → dblclick cell → FloatingEditor appears at correct position → Enter saves value
5. Commit button appears in Toolbar when new rows exist
6. Commit flow: new rows POST to `/api/create/asset` → success toast → rows appear as real rows
7. Delete new row via context menu works
8. Existing row editing unchanged — no regression
9. View switching clears new rows (existing EventHandler behavior)
10. `filteredAssetsCount` boundary checks appear only in RowGeneration (not GridOverlays, not contextMenu)

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — all findings verified against current source files
- `/frontend/src/lib/grid/utils/rowGeneration.svelte.ts` — complete controller implementation
- `/frontend/src/lib/grid/eventQueue/EventListener.svelte` — current rowGen integration points
- `/frontend/src/lib/grid/eventQueue/EventHandler.svelte.ts` — handleCommitCreate
- `/frontend/src/lib/components/grid/GridContainer.svelte` — virtual scroll rendering, event delegation
- `/frontend/src/lib/components/grid/GridOverlays.svelte` — isNewRow fork, dirty cell overlay, FloatingEditor
- `/frontend/src/lib/context/gridContext.svelte.ts` — context pair exports
- `/frontend/src/lib/context/GridContextProvider.svelte` — controller initialization order
- `/frontend/src/lib/components/grid/Toolbar.svelte` — hasNewRows commit button
- `/frontend/src/lib/grid/components/context-menu/contextMenu.svelte` — showDelete, handleDeleteNewRow
- `/frontend/src/lib/grid/components/floating-editor/FloatingEditor.svelte` — onSave, position
- `/frontend/src/lib/grid/components/floating-editor/floatingEditor.svelte.ts` — computeEditorPosition
- `/frontend/src/lib/grid/utils/virtualScrollManager.svelte.ts` — getOffsetY, getVisibleItems, ensureVisible
- `/home/joakim/asset_management/.omc/plans/row-generation-redesign.md` — PRD with task breakdown

### Secondary (MEDIUM confidence)
- Svelte 5 `createContext` lifecycle rules — confirmed from MEMORY.md ("returns `[getter, setter]` tuple, type-safe, no magic strings") + codebase usage patterns

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, all existing
- Architecture: HIGH — directly derived from codebase; context lifecycle rule is a known Svelte 5 constraint documented in project memory
- Pitfalls: HIGH — pitfalls 1-5 are mechanically derivable from the codebase; pitfalls 6-7 are inferred from code paths that will break

**Research date:** 2026-02-27
**Valid until:** This research is based on the live codebase, not external docs. Re-verify if GridContainer, GridOverlays, or EventListener change significantly before planning begins.
