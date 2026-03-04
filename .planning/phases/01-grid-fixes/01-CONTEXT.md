# Phase 1: Grid Fixes - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement drag-to-resize on column headers so ColumnWidthContext widths can actually be set. All width consumers already read from the context correctly — the missing piece is the drag interaction to write widths.

</domain>

<decisions>
## Implementation Decisions

### Resize interaction
- Live drag resize — writing to `colWidthCtx.widths` SvelteMap on mousemove, readers react via Svelte reactivity
- Drag handler lives in **GridOverlays** (owns all user interactions) — detects mousedown on resize handle via data attribute, manages mousemove/mouseup lifecycle
- GridHeader resize handle div is visual target only — no interaction logic

### Double-click behavior
- Keep current behavior — double-click deletes the width entry, resetting to 150px default

### Default widths
- Uniform 150px default for all columns — no per-column map needed
- Consolidate `DEFAULT_WIDTH` (and future constants like `ROW_HEIGHT`) into a new `gridConfig.ts` module with plain exported constants
- All 4 consumers import from `gridConfig.ts` instead of defining their own local `DEFAULT_WIDTH = 150`

### Claude's Discretion
- Minimum column width during drag
- Visual feedback during drag (cursor, handle highlight)
- Resize handle hit-target width

</decisions>

<specifics>
## Specific Ideas

- User suggested `$effect` on colWidthCtx could trigger the reactive resize — the SvelteMap is already reactive, so writing `.set(key, newWidth)` should be sufficient for all readers to update

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ColumnWidthContext` (`colWidthCtx.widths: SvelteMap<string, number>`) — already created in GridContextProvider, already read by all 4 consumers
- Resize handle `<div>` in GridHeader (line 62-69) — exists with stopPropagation and double-click reset, needs drag behavior added

### Established Patterns
- All width consumers use `colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH` pattern
- Style binding: `style="width: {width}px; min-width: {width}px;"` — both set together
- Context mutation: components write directly to context proxies

### Integration Points
- **GridHeader** (line 44): reads widths, needs drag handler on resize div
- **GridRow** (line 26): reads widths — no changes needed
- **GridOverlays** (line 57): reads widths for overlay positioning — no changes needed
- **EditHandler** (editHandler.svelte.ts line 35): reads widths for editor positioning — no changes needed
- `DEFAULT_WIDTH = 150` duplicated in 4 files — consolidating into new `gridConfig.ts`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-grid-fixes*
*Context gathered: 2026-03-04*
