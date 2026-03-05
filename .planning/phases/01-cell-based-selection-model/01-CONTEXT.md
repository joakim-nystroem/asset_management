# Phase 1: Cell-Based Selection Model - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-cell buttons in GridRow, selection via anchor points with col-as-string, drag selection with live preview, all DOM crawling removed from interaction paths. GridOverlays is NOT cleaned up in this phase — it still has event handlers, but selection and cell interaction move to their new owners.

</domain>

<decisions>
## Implementation Decisions

### Selection Model
- Two anchor points: `selectionStart` and `selectionEnd`, both `{ row: number, col: string }` — col is column KEY, not numeric index
- `GridCell` type changes from `{ row: number, col: number }` to `{ row: number, col: string }`
- `selectedCells: GridCell[]` is `$derived` from rectangle bounds by iterating `filteredAssets` within the row/col range — always complete, no gaps possible
- Selection rectangle = min/max of start and end points
- `col: number` → `col: string` migration must be atomic — ALL consumers updated in same commit (overlay math, clipboard, editor position, selection context, editing context)

### Per-Cell Interaction
- Each cell in GridRow becomes `<button tabindex="-1">` with inline click handler: `onclick={() => onCellClick(asset.id, key, asset[key])`
- Remove `data-row`/`data-col` attributes — cells know their own identity from render scope
- Cell owns: `onclick` (select), `ondblclick` (edit), `oncontextmenu` (right-click menu), `onmouseenter` (drag tracking)
- Cell does NOT own: drag state (`isSelecting`), keyboard events, overlay rendering

### Drag Mechanics
- `onmousedown` on cell sets `selectionCtx.isSelecting = true` and `selectionStart` (anchor)
- `onmouseenter` on cells updates `selectionEnd` when `isSelecting` is true — provides live visual feedback of selection growing
- `onmouseup` on window (via temporary listener) sets `isSelecting = false` — drag ends even if mouse leaves grid
- Rectangle computed from corners guarantees all cells in range are selected, even if `mouseenter` skips cells during fast movement
- Selection integrity: always correct because it's computed from anchor+current, not accumulated from events

### Overlay Rendering
- Keep existing pixel math approach — compute overlay positions from column widths + row heights
- Use `keys.indexOf(col)` for string→index conversion at point of use
- No DOM queries (no `getBoundingClientRect`, no `document.querySelector`) for overlay positioning
- Dirty cell overlay: pendingCtx already uses `col: string` — same `indexOf` conversion for positioning

### Edit Trigger
- Double-click: Cell's `ondblclick` writes directly to `editingCtx` (`isEditing=true`, `editRow=row`, `editCol=col`). EditHandler picks it up reactively.
- F2: Keyboard handler reads `selectionCtx.selectionStart` and writes that cell to `editingCtx`. Same end path.
- Both paths converge on EditHandler — single rendering logic regardless of trigger source
- Note: `editingCtx.editCol` changes from `number` to `string` as part of the atomic col migration

### Claude's Discretion
- Exact implementation of shift+click range computation
- How to handle arrow key navigation at grid boundaries (wrap vs stop)
- Internal structure of the `$derived` selectedCells computation
- Whether to use `$effect` + `addEventListener` or Svelte's `on()` from `svelte/events` for the window mouseup listener

</decisions>

<specifics>
## Specific Ideas

- "Two anchor points: selectionStart and selectionEnd. Mouse drag updates selectionEnd. The rectangle is always min/max of those two points."
- "The {row, col, value} set — that gets derived from the rectangle bounds by iterating filteredAssets within that range. It's not built up from mouse visits."
- "Since cells own their own mouse events now, ondblclick can be on the cell. F2 needs to read from selection context — it starts editing the starting cell of the selector grid."
- "It is IMPERATIVE that we don't miss cells. ALL cells within the selection NEEDS to be in the selection matrix."

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SelectionContext` in `gridContext.svelte.ts` (line 38-44): Already has `selectionStart`, `selectionEnd`, `isSelecting`. Needs `GridCell` type change from `col: number` to `col: string`.
- `EditingContext` (line 10-15): Has `editRow`, `editCol` — `editCol` changes from number to string.
- `ClipboardContext` (line 47-51): Has `copyStart`, `copyEnd` — same GridCell type change.
- `PendingContext` (line 19): Already uses `col: string` — no change needed.
- `virtualScrollManager.svelte.ts`: Provides row position math — continue using for overlay Y coordinates.
- `ColumnWidthContext`: Already used by GridRow for cell widths — same widths used for overlay X positioning.

### Established Patterns
- Component sets (`.svelte` + `.svelte.ts`): GridRow may need a companion `.svelte.ts` if logic grows.
- Context writes from components: Same pattern as Toolbar writing to `uiCtx.commitRequested`.
- `$state.snapshot()` for event queue payloads: Use when selection data flows to EventListener.

### Integration Points
- `GridRow.svelte`: Currently `<div data-row data-col>` → becomes `<button>` with handlers. Needs callback props or direct context access.
- `GridOverlays.svelte`: Reads `selectionCtx` for overlay rendering — continues to work, just reads new shape.
- `EditHandler.svelte`: Reads `editingCtx` — needs `editCol` type change from number to string.
- `eventHandler.ts`: Copy/paste logic uses numeric col — needs string conversion.

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-cell-based-selection-model*
*Context gathered: 2026-03-05*
