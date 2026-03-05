# Phase 1: Cell-Based Selection Model - Research

**Researched:** 2026-03-05
**Domain:** Svelte 5 grid interaction -- per-cell buttons, anchor-point selection, col:number to col:string migration
**Confidence:** HIGH

## Summary

This phase replaces DOM-crawling cell identification (`closest()` + `dataset`) with per-cell `<button>` elements that know their own identity from render scope. Selection changes from numeric column indices to string column keys, tracked via two anchor points (`selectionStart`/`selectionEnd`). The `selectedCells` array is `$derived` from rectangle bounds -- always complete, never accumulated from mouse events.

The migration is primarily a refactor of existing working code. No new libraries are needed. The main risk is the atomic `col: number` to `col: string` migration -- every consumer of `GridCell`, `EditingContext`, `ClipboardContext`, and `SelectionContext` must update in lockstep. The codebase is small enough (~630 lines in GridOverlays, ~300 in EditHandler, ~30 in GridRow) that this is manageable in a single commit.

**Primary recommendation:** Do the col type migration first as a standalone commit, then add per-cell buttons and new selection logic on top.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Two anchor points: `selectionStart` and `selectionEnd`, both `{ row: number, col: string }` -- col is column KEY, not numeric index
- `GridCell` type changes from `{ row: number, col: number }` to `{ row: number, col: string }`
- `selectedCells: GridCell[]` is `$derived` from rectangle bounds by iterating `filteredAssets` within the row/col range -- always complete, no gaps possible
- Selection rectangle = min/max of start and end points
- `col: number` to `col: string` migration must be atomic -- ALL consumers updated in same commit
- Each cell in GridRow becomes `<button tabindex="-1">` with inline click handler: `onclick={() => onCellClick(asset.id, key, asset[key])`
- Remove `data-row`/`data-col` attributes -- cells know their own identity from render scope
- Cell owns: `onclick` (select), `ondblclick` (edit), `oncontextmenu` (right-click menu), `onmouseenter` (drag tracking)
- Cell does NOT own: drag state (`isSelecting`), keyboard events, overlay rendering
- `onmousedown` on cell sets `selectionCtx.isSelecting = true` and `selectionStart` (anchor)
- `onmouseenter` on cells updates `selectionEnd` when `isSelecting` is true
- `onmouseup` on window (via temporary listener) sets `isSelecting = false`
- Keep existing pixel math approach for overlays -- use `keys.indexOf(col)` for string to index conversion
- Double-click: Cell's `ondblclick` writes directly to `editingCtx`
- F2: Keyboard handler reads `selectionCtx.selectionStart` and writes that cell to `editingCtx`
- `editingCtx.editCol` changes from `number` to `string` as part of the atomic col migration

### Claude's Discretion
- Exact implementation of shift+click range computation
- How to handle arrow key navigation at grid boundaries (wrap vs stop)
- Internal structure of the `$derived` selectedCells computation
- Whether to use `$effect` + `addEventListener` or Svelte's `on()` from `svelte/events` for the window mouseup listener

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEL-01 | Selection uses two anchor points with `{ row: number, col: string }` | Col migration section -- change GridCell type, update all consumers |
| SEL-02 | `selectedCells` is `$derived` from rectangle bounds | Derived selectedCells pattern section |
| SEL-03 | Click a cell to select it (per-cell button, no DOM crawling) | Per-cell button pattern section |
| SEL-04 | Shift+click selects rectangular range | Shift+click implementation section |
| SEL-05 | Drag to select range | Drag mechanics section |
| SEL-06 | Drag mouseup listener on window | Window mouseup pattern section |
| SEL-07 | Arrow-key navigation | Arrow key navigation section (existing logic, adapt to col:string) |
| SEL-08 | Shift+arrow extends selection | Arrow key navigation section (existing logic, adapt to col:string) |
| SEL-10 | Escape clears selection | Existing logic works, just needs col:string sentinel |
| SEL-11 | Selection survives virtual scroll | Anchor-point design inherently survives -- row=assetId, col=key, both stable across scroll |
| CELL-01 | Each cell renders as `<button tabindex="-1">` | Per-cell button pattern section |
| CELL-02 | All `data-row`/`data-col` removed | Col migration -- full removal list |
| CELL-03 | Per-cell `onmouseenter` updates selectionEnd during drag | Drag mechanics section |
| CELL-04 | Per-cell `ondblclick` triggers edit | Edit trigger section |
| CELL-05 | Per-cell right-click opens context menu | Context menu section |
| CONT-03 | `col: number` to `col: string` migration is atomic | Col migration section -- complete consumer list |

</phase_requirements>

## Architecture Patterns

### Pattern 1: Atomic Col Type Migration

**What:** Change `GridCell.col` from `number` to `string` across all consumers in one commit. This is the foundational change that everything else builds on.

**Complete consumer list (verified by grep):**

| File | What Changes |
|------|-------------|
| `gridContext.svelte.ts` L5 | `GridCell` type: `col: number` becomes `col: string` |
| `gridContext.svelte.ts` L10-15 | `EditingContext.editCol`: `number` becomes `string` |
| `gridContext.svelte.ts` L38-44 | `SelectionContext` uses `GridCell` -- auto-updated |
| `gridContext.svelte.ts` L47-51 | `ClipboardContext` uses `GridCell` -- auto-updated |
| `GridContextProvider.svelte` L27-32 | `editCol: -1` sentinel becomes `editCol: ''` |
| `GridContextProvider.svelte` L55-61 | `selectionStart/End` sentinels: `col: -1` becomes `col: ''` |
| `GridContextProvider.svelte` L64-69 | `copyStart/End` sentinels: `col: -1` becomes `col: ''` |
| `GridOverlays.svelte` L37 | `ctxMenu.col` type: `number` becomes `string` |
| `GridOverlays.svelte` L69-73 | `colBounds()`: takes `col: number` index, now takes `col: string` key |
| `GridOverlays.svelte` L85-129 | Selection helpers: `selectCell`, `startSelection`, `extendSelection`, `endSelection` -- col comparison changes |
| `GridOverlays.svelte` L139-174 | `computeVisualOverlay()`: uses `Math.min(start.col, end.col)` -- needs `indexOf` conversion |
| `GridOverlays.svelte` L200-277 | Keyboard handler: arrow key col arithmetic changes |
| `GridOverlays.svelte` L280-295 | `getArrowTarget()`: col arithmetic needs key-based navigation |
| `GridOverlays.svelte` L318-371 | Mouse handlers: extract col from DOM -- replaced by callback args |
| `EditHandler.svelte` L21 | `editKey` derivation: `keys[editingCtx.editCol]` becomes direct `editingCtx.editCol` |
| `EditHandler.svelte` L37-42 | Editor position: `editingCtx.editCol` used as index -- needs `indexOf` |
| `EditHandler.svelte` L95-96 | Copy: `selCtx.selectionStart.col` used as slice index -- needs `indexOf` |
| `EditHandler.svelte` L130-132 | Paste: col arithmetic for selection width -- needs `indexOf` |
| `EditHandler.svelte` L193 | Cancel: `editCol = -1` becomes `editCol = ''` |
| `editHandler.svelte.ts` L17,34 | `computeEditorPosition()`: `editCol: number` param becomes string, loop uses `indexOf` |
| `contextMenu.svelte` L11,45 | `col` prop and `editingCtx.editCol = col` -- type change |

**Sentinel values change:**
- `col: -1` (numeric "no selection") becomes `col: ''` (empty string "no selection")
- All checks like `selCtx.selectionStart.row !== -1` remain valid (row is still number)
- Add checks like `selCtx.selectionStart.col !== ''` where col is tested independently

**Col comparison changes:**
- `Math.min(s.col, e.col)` / `Math.max(...)` -- cannot compare strings this way. Use `keys.indexOf()` to get numeric positions, compute min/max, then convert back: `keys[minIdx]` / `keys[maxIdx]`
- Arrow key navigation: `col - 1` / `col + 1` becomes `keys[keys.indexOf(col) - 1]` / `keys[keys.indexOf(col) + 1]`
- Range slicing: `keys.slice(startCol, endCol + 1)` becomes `keys.slice(keys.indexOf(startCol), keys.indexOf(endCol) + 1)`

### Pattern 2: Per-Cell Button with Callback Props

**What:** GridRow cells become `<button>` elements. GridRow receives callback props from its parent to handle cell interactions.

**Current GridRow (30 lines):**
```svelte
<!-- Current: passive div with data attributes -->
<div data-row={asset.id} data-col={j} class="...">
  <span class="truncate w-full">{asset[key]}</span>
</div>
```

**New GridRow:**
```svelte
<!-- New: interactive button, identity from render scope -->
<button
  tabindex="-1"
  class="..."
  style="width: {width}px; min-width: {width}px;"
  onmousedown={(e) => onCellMouseDown(asset.id, key, e)}
  onmouseenter={() => onCellMouseEnter(asset.id, key)}
  ondblclick={(e) => onCellDblClick(asset.id, key, asset[key], e)}
  oncontextmenu={(e) => onCellContextMenu(asset.id, key, asset[key], e)}
>
  <span class="truncate w-full">{asset[key]}</span>
</button>
```

**Props shape for GridRow:**
```typescript
type Props = {
  asset: Record<string, any>;
  keys: string[];
  onCellMouseDown: (row: number, col: string, e: MouseEvent) => void;
  onCellMouseEnter: (row: number, col: string) => void;
  onCellDblClick: (row: number, col: string, value: string, e: MouseEvent) => void;
  onCellContextMenu: (row: number, col: string, value: string, e: MouseEvent) => void;
};
```

**Why callback props instead of direct context access:** GridRow currently has no context imports (only `getColumnWidthContext`). Keeping it "dumb" with callbacks follows the project principle "Components own the functionality they expose to the user" -- GridRow exposes cells, but selection logic belongs to GridOverlays.

### Pattern 3: Derived selectedCells from Rectangle Bounds

**What:** Instead of accumulating selected cells from mouse events, derive them from anchor points.

```typescript
// In GridOverlays or a helper module
const selectedCells = $derived.by(() => {
  const start = selCtx.selectionStart;
  const end = selCtx.selectionEnd;
  if (start.row === -1 || start.col === '') return [];

  const startIdx = assets.findIndex(a => a.id === start.row);
  const endIdx = assets.findIndex(a => a.id === end.row);
  if (startIdx === -1 || endIdx === -1) return [];

  const minRow = Math.min(startIdx, endIdx);
  const maxRow = Math.max(startIdx, endIdx);
  const startColIdx = keys.indexOf(start.col);
  const endColIdx = keys.indexOf(end.col);
  const minCol = Math.min(startColIdx, endColIdx);
  const maxCol = Math.max(startColIdx, endColIdx);

  const cells: GridCell[] = [];
  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      cells.push({ row: assets[r].id, col: keys[c] });
    }
  }
  return cells;
});
```

**Key property:** Rectangle is always complete. Fast mouse movement skipping cells cannot create gaps because we compute the full rectangle from corners.

**Performance:** For typical grids (20 visible rows x 15 columns = 300 cells), this is negligible. The derivation runs only when anchor points change.

### Pattern 4: Drag Selection Mechanics

**What:** mousedown on cell starts drag, mouseenter on cells extends, mouseup on window ends.

```typescript
// In GridOverlays -- called by GridRow callbacks

function handleCellMouseDown(row: number, col: string, e: MouseEvent) {
  if (e.button !== 0) return; // left click only

  if (e.shiftKey) {
    // Extend from current anchor to clicked cell
    selCtx.selectionEnd = { row, col };
  } else {
    selCtx.selectionStart = { row, col };
    selCtx.selectionEnd = { row, col };
    selCtx.isSelecting = true;
    selCtx.hideSelection = false;
  }
}

function handleCellMouseEnter(row: number, col: string) {
  if (selCtx.isSelecting) {
    selCtx.selectionEnd = { row, col };
  }
}

// Window mouseup -- end drag even if mouse leaves grid
$effect(() => {
  function onMouseUp() {
    if (selCtx.isSelecting) {
      selCtx.isSelecting = false;
    }
  }
  window.addEventListener('mouseup', onMouseUp);
  return () => window.removeEventListener('mouseup', onMouseUp);
});
```

**Why no normalization on mouseup:** The old code normalized start/end to top-left/bottom-right on mouseup. With string cols, the overlay computation already handles arbitrary corner ordering via `Math.min(indexOf...)`. No normalization step needed.

### Pattern 5: Overlay Position Computation with String Cols

**What:** The existing `computeVisualOverlay()` works with numeric col indices for pixel math. With string cols, convert at point of use.

```typescript
function computeVisualOverlay(
  start: { row: number; col: string },
  end: { row: number; col: string },
) {
  // ... row logic unchanged ...

  const startColIdx = keys.indexOf(start.col);
  const endColIdx = keys.indexOf(end.col);
  if (startColIdx === -1 || endColIdx === -1) return null;

  const minCol = Math.min(startColIdx, endColIdx);
  const maxCol = Math.max(startColIdx, endColIdx);

  let left = 0;
  for (let c = 0; c < minCol; c++) left += getWidth(keys[c]);
  let width = 0;
  for (let c = minCol; c <= maxCol; c++) width += getWidth(keys[c]);

  // ... rest unchanged ...
}
```

### Pattern 6: Arrow Key Navigation with String Cols

**What:** Arrow keys move selection. Left/right moves by column key, up/down by asset array position.

```typescript
function getArrowTarget(
  key: string,
  current: { row: number; col: string },
  keys: string[],
  assets: Record<string, any>[],
): { row: number; col: string } | null {
  const rowIdx = assets.findIndex(a => a.id === current.row);
  if (rowIdx === -1) return null;
  const colIdx = keys.indexOf(current.col);
  if (colIdx === -1) return null;

  switch (key) {
    case 'ArrowUp':    return rowIdx > 0 ? { row: assets[rowIdx - 1].id, col: current.col } : null;
    case 'ArrowDown':  return rowIdx < assets.length - 1 ? { row: assets[rowIdx + 1].id, col: current.col } : null;
    case 'ArrowLeft':  return colIdx > 0 ? { row: current.row, col: keys[colIdx - 1] } : null;
    case 'ArrowRight': return colIdx < keys.length - 1 ? { row: current.row, col: keys[colIdx + 1] } : null;
    default:           return null;
  }
}
```

**Boundary behavior recommendation:** Stop at edges (return null). Do not wrap. This is the Excel/Google Sheets convention and what users expect. The current code already does this.

**colBounds helper update:**
```typescript
function colBounds(col: string): { left: number; right: number } {
  const colIdx = keys.indexOf(col);
  if (colIdx === -1) return { left: 0, right: 0 };
  let left = 0;
  for (let c = 0; c < colIdx; c++) left += getWidth(keys[c]);
  return { left, right: left + getWidth(col) };
}
```

### Pattern 7: EditHandler Adaptation

**What:** EditHandler's `editCol` changes from numeric index to string key. This simplifies the component -- the `editKey` derivation becomes unnecessary.

**Current:**
```typescript
const editKey = $derived(editingCtx.editCol >= 0 ? keys[editingCtx.editCol] ?? null : null);
```

**After migration:**
```typescript
const editKey = $derived(editingCtx.editCol !== '' ? editingCtx.editCol : null);
```

**`computeEditorPosition` update:**
```typescript
export function computeEditorPosition(
  editRowId: number,
  editCol: string,    // was: number
  columnWidths: SvelteMap<string, number>,
  keys: string[],
  assets: Record<string, any>[],
  virtualScroll: VirtualScrollManager
): { top: number; left: number; width: number; height: number } | null {
  // ... row logic unchanged ...

  const colIdx = keys.indexOf(editCol);
  if (colIdx === -1) return null;

  let left = 0;
  for (let i = 0; i < colIdx; i++) {
    left += columnWidths.get(keys[i]) ?? DEFAULT_WIDTH;
  }

  const width = columnWidths.get(editCol) ?? DEFAULT_WIDTH;
  // ... rest unchanged ...
}
```

Note: The `editKey` parameter is now redundant since `editCol` IS the key. The function signature simplifies.

### Pattern 8: Copy/Paste with String Cols

**Current copy uses numeric col for slicing:**
```typescript
const startCol = selCtx.selectionStart.col;  // number
const endCol = selCtx.selectionEnd.col;        // number
const colKeys = keys.slice(startCol, endCol + 1);
```

**After migration:**
```typescript
const startColIdx = keys.indexOf(selCtx.selectionStart.col);
const endColIdx = keys.indexOf(selCtx.selectionEnd.col);
const minCol = Math.min(startColIdx, endColIdx);
const maxCol = Math.max(startColIdx, endColIdx);
const colKeys = keys.slice(minCol, maxCol + 1);
```

**Paste similarly:** `startCol` used as numeric offset for `keys[startCol + c]` -- becomes `keys[startColIdx + c]`.

### Anti-Patterns to Avoid

- **Separate "col adapter" layer:** Do NOT create a wrapper that converts string cols to numbers at context boundaries. The whole point is to eliminate numeric col indices. Convert at point-of-use for pixel math only.
- **Storing both `col: string` and `colIndex: number`:** Redundant, falls out of sync. Store string, derive index when needed.
- **Accumulating selectedCells from events:** The derived rectangle approach is the locked decision. Never push/pop individual cells.
- **Using `onmousemove` for drag tracking instead of `onmouseenter`:** `mousemove` fires at 60fps with sub-pixel coordinates. `mouseenter` fires once per cell entry -- much cheaper and gives exactly the data needed (which cell was entered).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtual scroll | Custom scroll virtualization | Existing `virtualScrollManager.svelte.ts` | Already handles visible range, overscan, row heights |
| Column width tracking | New width state | Existing `ColumnWidthContext` + `SvelteMap` | Already reactive, used everywhere |
| Panel mutex | Custom panel manager | Existing `setOpenPanel()` helper | Already handles mutual exclusion |

## Common Pitfalls

### Pitfall 1: Forgetting to Update Sentinel Values
**What goes wrong:** Code checks `col !== -1` but col is now a string, so `-1` check passes for empty string.
**Why it happens:** Mechanical find-replace misses conditional checks.
**How to avoid:** Search for every `-1` literal in selection/editing/clipboard contexts. Replace with `''` for col, keep `-1` for row.
**Warning signs:** Selection appears stuck or editing triggers on wrong cell.

### Pitfall 2: Math.min/max on String Cols
**What goes wrong:** `Math.min('location', 'status')` returns `NaN`.
**Why it happens:** Existing code uses `Math.min(s.col, e.col)` which works for numbers.
**How to avoid:** Always convert to index first: `Math.min(keys.indexOf(s.col), keys.indexOf(e.col))`.
**Warning signs:** Overlay doesn't render (returns `null` from NaN comparisons).

### Pitfall 3: keys Array Instability
**What goes wrong:** `keys.indexOf(col)` returns -1 because keys changed (e.g., view switch, filter removing all data).
**Why it happens:** `keys` is derived from `Object.keys(assets[0] ?? {})`. If assets change shape or become empty, keys changes.
**How to avoid:** Guard `indexOf` results: `if (colIdx === -1) return null`. Already done in most overlay code.
**Warning signs:** Selection disappears after view/filter change.

### Pitfall 4: ContextMenu Still Uses Numeric Col
**What goes wrong:** Context menu receives `col` prop, writes `editingCtx.editCol = col`. If ContextMenu still sends number, type mismatch.
**Why it happens:** ContextMenu gets col from GridOverlays' `ctxMenu` local state. Must update both.
**How to avoid:** Update `ctxMenu` type in GridOverlays AND ContextMenu prop type. The `openContextMenu` function already receives `key` -- use that as the col value.

### Pitfall 5: Existing data-header-col / data-resize-handle / data-filter-trigger
**What goes wrong:** Removing ALL `data-*` attributes breaks header menu toggle, column resize, and filter panel.
**Why it happens:** Overzealous cleanup. CELL-02 says remove `data-row`/`data-col` only.
**How to avoid:** Only remove `data-row` and `data-col` from GridRow. Keep `data-header-col`, `data-resize-handle`, `data-filter-trigger` -- these are header/toolbar concerns, not cell interaction. They are explicitly out of scope for this phase (GridOverlays cleanup is Phase 3).

### Pitfall 6: Button Styling Differences
**What goes wrong:** Switching from `<div>` to `<button>` introduces default button styles (border, padding, background, font).
**Why it happens:** Browser default button styles differ from div.
**How to avoid:** Add reset styles: `appearance: none; border: none; background: none; font: inherit; padding: 0; margin: 0;` or use Tailwind classes that achieve the same.

### Pitfall 7: mousedown vs click for Selection
**What goes wrong:** Using `onclick` instead of `onmousedown` makes drag selection impossible -- click fires on mouseup, not mousedown.
**Why it happens:** CONTEXT.md mentions `onclick` in the cell handler list but drag requires mousedown.
**How to avoid:** Use `onmousedown` for selection start (drag anchor). The existing code already uses mousedown. The CONTEXT.md's "onclick" description refers to the general "click a cell" behavior -- implement it as mousedown.

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `data-*` + `closest()` DOM crawling | Per-element callbacks from render scope | No DOM queries in interaction path |
| Numeric column index | String column key | Eliminates index-to-key translation layer, matches pending edits shape |
| Selection from accumulated mouse events | Derived from anchor points | Guaranteed complete rectangles |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | svelte-check (TypeScript) |
| Config file | `frontend/tsconfig.json` |
| Quick run command | `cd frontend && npx svelte-check --tsconfig ./tsconfig.json` |
| Full suite command | `cd frontend && npx svelte-check --tsconfig ./tsconfig.json` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEL-01 | GridCell type uses col: string | type-check | `cd frontend && npx svelte-check` | N/A (type system) |
| SEL-02 | selectedCells derived from bounds | manual | Dev server visual check | N/A |
| SEL-03 | Click cell to select | manual | Dev server click test | N/A |
| SEL-04 | Shift+click range selection | manual | Dev server shift+click test | N/A |
| SEL-05 | Drag selection | manual | Dev server drag test | N/A |
| SEL-06 | Window mouseup ends drag | manual | Drag then release outside grid | N/A |
| SEL-07 | Arrow key navigation | manual | Dev server arrow key test | N/A |
| SEL-08 | Shift+arrow extends selection | manual | Dev server shift+arrow test | N/A |
| SEL-10 | Escape clears selection | manual | Dev server escape test | N/A |
| SEL-11 | Selection survives scroll | manual | Select, scroll away, scroll back | N/A |
| CELL-01 | Cells are `<button tabindex="-1">` | type-check + inspect | Browser dev tools element inspection | N/A |
| CELL-02 | No data-row/data-col in cell path | manual-only | Grep codebase for data-row/data-col in GridRow | N/A |
| CELL-03 | mouseenter updates selectionEnd | manual | Dev server drag test | N/A |
| CELL-04 | dblclick triggers edit | manual | Dev server double-click test | N/A |
| CELL-05 | Right-click opens context menu | manual | Dev server right-click test | N/A |
| CONT-03 | Atomic col migration | type-check | `cd frontend && npx svelte-check` | N/A |

### Sampling Rate
- **Per task commit:** `cd frontend && npx svelte-check --tsconfig ./tsconfig.json`
- **Per wave merge:** Full type check + manual grid interaction test
- **Phase gate:** Type check green + all 5 success criteria verified manually

### Wave 0 Gaps
None -- no unit test framework exists for this project. Validation is via TypeScript type checking (`svelte-check`) and manual browser testing. This is appropriate for a UI refactor where the primary risks are type errors and visual regressions.

## Open Questions

1. **Header menu DOM query in GridHeader**
   - What we know: `GridHeader.svelte` L24 uses `document.querySelector('[data-header-col="..."]')` for menu alignment
   - What's unclear: Whether this should be refactored in Phase 1
   - Recommendation: Leave it alone. This is header concern, not cell interaction. Phase 3 (GridOverlays cleanup) can address it.

2. **Copy overlay after col migration**
   - What we know: `clipCtx.copyStart/copyEnd` use `GridCell` type, so they change to `col: string`
   - What's unclear: Whether the copy overlay sentinel check `clipCtx.copyStart.row !== -1` is sufficient
   - Recommendation: It is sufficient -- row is still numeric. The col sentinel (`''`) is only needed if col is checked independently.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `gridContext.svelte.ts`, `GridOverlays.svelte`, `GridRow.svelte`, `EditHandler.svelte`, `editHandler.svelte.ts`, `GridContextProvider.svelte`, `contextMenu.svelte`, `GridContainer.svelte`, `GridHeader.svelte`
- `CLAUDE.md` project instructions and file responsibilities
- `01-CONTEXT.md` user decisions

### Secondary (MEDIUM confidence)
- Svelte 5 `createContext` API -- verified in codebase (imported from `svelte`, returns `[getter, setter]` tuple)
- `$derived.by()` pattern -- verified in codebase (`dirtyCellOverlays` in GridOverlays)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, pure refactor of existing code
- Architecture: HIGH -- patterns derived directly from codebase analysis and locked user decisions
- Pitfalls: HIGH -- identified from actual code patterns (grep-verified consumer list)

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable -- internal refactor, no external dependency concerns)
