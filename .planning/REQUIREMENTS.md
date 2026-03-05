# Requirements: GridOverlays Decomposition

**Defined:** 2026-03-05
**Core Value:** Events belong to their source — each cell, header, and button owns its interactions and knows its own data without DOM inspection.

## v1 Requirements

Requirements for this refactor. Each maps to roadmap phases.

### Selection Model

- [ ] **SEL-01**: Selection uses two anchor points (`selectionStart`, `selectionEnd`) with `{ row: number, col: string }` — col is column key, not numeric index
- [ ] **SEL-02**: `selectedCells: GridCell[]` is `$derived` from rectangle bounds (min/max of start/end) by iterating `filteredAssets` within range — always complete, no gaps
- [ ] **SEL-03**: User can click a cell to select it (per-cell `<button>` with click handler, no DOM crawling)
- [ ] **SEL-04**: User can shift+click to select rectangular range from current selection to clicked cell
- [ ] **SEL-05**: User can drag to select range — mousedown sets anchor, mouseenter on cells updates `selectionEnd`, rectangle derived from bounds
- [ ] **SEL-06**: Drag mouseup listener on window — drag ends even if mouse leaves the grid
- [ ] **SEL-07**: User can arrow-key navigate between cells (moves selection)
- [ ] **SEL-08**: User can shift+arrow to extend selection range
- [ ] **SEL-09**: User can Ctrl+Shift+Arrow to select from current cell to edge of grid (Excel-style)
- [ ] **SEL-10**: User can press Escape to clear selection
- [ ] **SEL-11**: Selection survives virtual scroll — selected cells remain selected when scrolled out of view and back

### Per-Cell Interaction

- [ ] **CELL-01**: Each cell in GridRow renders as `<button tabindex="-1">` with inline click handler knowing its own `(row, col, value)`
- [ ] **CELL-02**: All `data-row`/`data-col` DOM attributes removed — no `closest()` crawling in interaction paths
- [ ] **CELL-03**: Per-cell `onmouseenter` updates `selectionEnd` during drag (when `isSelecting` is true)
- [ ] **CELL-04**: Per-cell `ondblclick` triggers cell edit (writes to `editingCtx`)
- [ ] **CELL-05**: Per-cell right-click (`oncontextmenu`) opens context menu with cell data

### Keyboard Handling

- [ ] **KEY-01**: Keyboard logic extracted to pure TypeScript `keyboardHandler.ts` — no DOM dependencies, receives contexts as arguments
- [ ] **KEY-02**: EventListener wraps grid with `onkeydown` on its container div — keyboard scoped to grid, no `svelte:window`
- [ ] **KEY-03**: Lightweight `isInput` guard for Toolbar inputs inside EventListener tree (search bar, filter panel)
- [ ] **KEY-04**: Arrow keys navigate selection (move `selectionStart`/`selectionEnd` to adjacent cell)
- [ ] **KEY-05**: F2 starts cell editing on selected cell
- [ ] **KEY-06**: Escape cancels edit or clears selection
- [ ] **KEY-07**: Ctrl+C triggers copy signal via `clipboardCtx`
- [ ] **KEY-08**: Ctrl+V triggers paste signal via `editingCtx`
- [ ] **KEY-09**: Ctrl+Shift+Arrow selects from current cell to grid edge

### GridOverlays Cleanup

- [ ] **OVER-01**: GridOverlays has zero event handlers — no `onkeydown`, `onmousedown`, `onmousemove`, `onmouseup`, `oncontextmenu`
- [ ] **OVER-02**: GridOverlays has zero state management — no local `$state` for selection, drag, resize, panel logic
- [ ] **OVER-03**: GridOverlays reads contexts and renders positioned divs only: selection border, copy border, dirty cell indicators, other-user cursors
- [ ] **OVER-04**: Selection border overlay derives position from `selectionCtx` bounds + column widths + virtual scroll offset
- [ ] **OVER-05**: All existing visual overlays continue working through the refactor (selection, copy, dirty, cursors)

### Functional Continuity

- [ ] **CONT-01**: All existing grid functionality works after refactor: edit, sort, filter, context menu, header menu, column resize, commit, discard, search, new row, view selector
- [ ] **CONT-02**: Each phase leaves the grid in a fully working state — no intermediate breakage
- [ ] **CONT-03**: `col: number` → `col: string` migration is atomic — all consumers updated in same commit (overlay math, clipboard, editor position)

## v2 Requirements

Deferred to future milestones. Tracked but not in current roadmap.

### Undo/Redo
- **HIST-01**: User can Ctrl+Z to undo last edit
- **HIST-02**: User can Ctrl+Y to redo last undone edit
- **HIST-03**: HistoryContext tracks undo/redo stacks

### NewRow Component
- **NROW-01**: NewRow component set replaces rowGeneration.svelte.ts
- **NROW-02**: New rows use `NEW-N` string IDs in pending context

### Validation
- **VAL-01**: Cell validation checks constraints on save (required fields, allowed values)
- **VAL-02**: Invalid cells visually indicated and blocked from commit

### Visual Polish
- **VIS-01**: Overlay hover problem solved — dirty cell overlays don't occlude hover on real cells

## Out of Scope

| Feature | Reason |
|---------|--------|
| Undo/redo implementation | HistoryContext exists but deferred — separate milestone |
| NewRow component set | Working via rowGeneration.svelte.ts, refactor later |
| Validation system | All edits isValid: true, constraint checking deferred |
| Overlay hover fix | Cosmetic — dirty cell overlays occlude hover, defer |
| Formula support | Not a spreadsheet — asset data is flat |
| Column reorder/hide | Scope creep, not core interaction |
| Tab-to-next-cell editing | Depends on selection model but deferred |
| Enter-to-next-row editing | Depends on selection model but deferred |
| Delete key clears cells | Depends on selection model but deferred |
| Select all (Ctrl+A) | Low priority, defer |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEL-01 | Phase 1 | Pending |
| SEL-02 | Phase 1 | Pending |
| SEL-03 | Phase 1 | Pending |
| SEL-04 | Phase 1 | Pending |
| SEL-05 | Phase 1 | Pending |
| SEL-06 | Phase 1 | Pending |
| SEL-07 | Phase 1 | Pending |
| SEL-08 | Phase 1 | Pending |
| SEL-09 | Phase 2 | Pending |
| SEL-10 | Phase 1 | Pending |
| SEL-11 | Phase 1 | Pending |
| CELL-01 | Phase 1 | Pending |
| CELL-02 | Phase 1 | Pending |
| CELL-03 | Phase 1 | Pending |
| CELL-04 | Phase 1 | Pending |
| CELL-05 | Phase 1 | Pending |
| KEY-01 | Phase 2 | Pending |
| KEY-02 | Phase 2 | Pending |
| KEY-03 | Phase 2 | Pending |
| KEY-04 | Phase 2 | Pending |
| KEY-05 | Phase 2 | Pending |
| KEY-06 | Phase 2 | Pending |
| KEY-07 | Phase 2 | Pending |
| KEY-08 | Phase 2 | Pending |
| KEY-09 | Phase 2 | Pending |
| OVER-01 | Phase 3 | Pending |
| OVER-02 | Phase 3 | Pending |
| OVER-03 | Phase 3 | Pending |
| OVER-04 | Phase 3 | Pending |
| OVER-05 | Phase 3 | Pending |
| CONT-01 | All | Pending |
| CONT-02 | All | Pending |
| CONT-03 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after initial definition*
