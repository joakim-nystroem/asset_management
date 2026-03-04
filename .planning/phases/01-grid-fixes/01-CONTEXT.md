# Phase 1: Grid Fixes - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Apply ColumnWidthContext widths correctly in GridHeader and GridRow. Implement drag-to-resize on column headers so widths can actually be set. Ensure column width state is the sole source of truth for all width rendering.

</domain>

<decisions>
## Implementation Decisions

### Resize interaction
- Live resize — column width updates continuously as the user drags (not on release)
- Drag-resize uses mousedown/mousemove/mouseup on the existing resize handle div in GridHeader
- Width is written to `colWidthCtx.widths` SvelteMap on each mousemove — all readers (GridHeader, GridRow, GridOverlays, EditHandler) update reactively

### Double-click behavior
- Double-click the resize handle triggers auto-fit to content (replaces current reset-to-default behavior)
- Auto-fit measures the widest value in the currently visible (virtual-scrolled) rows — fast, DOM-based
- Auto-fit accounts for both the header label width and cell content — takes the wider of the two
- Auto-fit has a maximum width cap to prevent columns with long text from becoming unreasonably wide

### Default width strategy
- Per-column initial widths via a hardcoded key-to-width map (e.g., id:60, status:100, notes:250)
- One shared map for all views — same column gets the same default regardless of active view
- Unmapped columns fall back to the general default (150px)
- User's manual resizes persist across view switches within the same session (SvelteMap keeps all entries)
- The duplicated `DEFAULT_WIDTH = 150` constant across 4 files should be consolidated to one source

### Claude's Discretion
- Minimum column width during drag (something sensible to prevent unusably narrow columns)
- Visual feedback during drag (blue highlight on edge, or just cursor change)
- Resize handle width (current 4px vs wider for easier targeting)
- Exact maximum width cap for auto-fit
- Exact per-column default width values in the map

</decisions>

<specifics>
## Specific Ideas

- The existing resize handle already has `hover:bg-blue-400` styling — extend this pattern for drag state
- The resize handle has `cursor-col-resize` — keep this as the primary drag affordance

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ColumnWidthContext` (`colWidthCtx.widths: SvelteMap<string, number>`) — already created in GridContextProvider, already read by all 4 consumers
- Resize handle `<div>` in GridHeader (line 62-69) — exists with stopPropagation and double-click reset, needs drag behavior added
- `createVirtualScroll()` in ViewContext — provides visible row range for auto-fit measurement

### Established Patterns
- All width consumers use `colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH` — this pattern stays, just needs consolidated default
- Style binding: `style="width: {width}px; min-width: {width}px;"` — both width and min-width set together
- Context mutation pattern: components write directly to context proxies (e.g., `colWidthCtx.widths.set(key, newWidth)`)

### Integration Points
- **GridHeader** (line 44): reads widths for header cell styling — already correct, needs drag handler added to resize div
- **GridRow** (line 26): reads widths for data cell styling — already correct, no changes needed beyond default consolidation
- **GridOverlays** (line 57): reads widths for overlay positioning — already correct
- **EditHandler** (editHandler.svelte.ts line 35): reads widths for editor positioning — already correct

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-grid-fixes*
*Context gathered: 2026-03-04*
