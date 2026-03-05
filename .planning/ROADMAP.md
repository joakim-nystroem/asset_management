# Roadmap: GridOverlays Decomposition

## Overview

Decompose GridOverlays from a god component into three clean layers: cells that own their interactions, a pure TypeScript keyboard handler, and a visual-only overlay renderer. Three phases follow the natural dependency chain -- selection model first (keyboard needs it), keyboard extraction second (cleanup needs both done), GridOverlays cleanup last.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Cell-Based Selection Model** - Per-cell buttons in GridRow, selection via anchor points with col-as-string, drag selection, all DOM crawling removed
- [ ] **Phase 2: Keyboard Handler Extraction** - Pure TypeScript keyboardHandler.ts wired through EventListener, arrow nav, F2/Escape, copy/paste signals, edge selection
- [ ] **Phase 3: GridOverlays Cleanup** - Strip all event handlers and state from GridOverlays, leaving a read-only overlay renderer

## Phase Details

### Phase 1: Cell-Based Selection Model
**Goal**: Users interact with grid cells directly -- each cell knows its own identity and handles its own clicks, selection is tracked by anchor points using column keys, and no DOM crawling exists in any interaction path
**Depends on**: Nothing (first phase)
**Requirements**: SEL-01, SEL-02, SEL-03, SEL-04, SEL-05, SEL-06, SEL-07, SEL-08, SEL-10, SEL-11, CELL-01, CELL-02, CELL-03, CELL-04, CELL-05, CONT-03
**Success Criteria** (what must be TRUE):
  1. User can click any cell to select it, and the selection highlight appears on that cell
  2. User can shift+click or drag to select a rectangular range of cells, with the selection rectangle rendering correctly
  3. User can arrow-key navigate between cells and shift+arrow to extend selection
  4. User can double-click a cell to start editing it, and right-click to open the context menu with that cell's data
  5. No `closest()`, `dataset`, `data-row`, or `data-col` lookups exist anywhere in the interaction code paths
**Plans:** 1/2 plans executed

Plans:
- [ ] 01-01-PLAN.md — Atomic col:number to col:string migration across all consumers
- [ ] 01-02-PLAN.md — Per-cell buttons in GridRow + callback-based selection mechanics

### Phase 2: Keyboard Handler Extraction
**Goal**: All keyboard interaction is handled by a pure TypeScript module with no DOM dependencies, wired into the grid through EventListener's container div
**Depends on**: Phase 1
**Requirements**: KEY-01, KEY-02, KEY-03, KEY-04, KEY-05, KEY-06, KEY-07, KEY-08, KEY-09, SEL-09
**Success Criteria** (what must be TRUE):
  1. User can press arrow keys to navigate selection, F2 to edit, Escape to cancel edit or clear selection -- all handled by keyboardHandler.ts
  2. User can Ctrl+C to copy and Ctrl+V to paste, with signals routed through clipboard/editing contexts
  3. User can Ctrl+Shift+Arrow to jump selection to grid edge (Excel-style)
  4. Keyboard shortcuts do not fire when typing in toolbar search, filter panel, or other input elements
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: GridOverlays Cleanup
**Goal**: GridOverlays is a purely visual component -- zero event handlers, zero local state, reads contexts and renders positioned overlay divs
**Depends on**: Phase 2
**Requirements**: OVER-01, OVER-02, OVER-03, OVER-04, OVER-05
**Success Criteria** (what must be TRUE):
  1. GridOverlays has zero `on*` event handler attributes and zero `$state` declarations in its code
  2. Selection border, copy border, dirty cell indicators, and other-user cursors all render correctly by reading from contexts
  3. All existing grid functionality works end-to-end: edit, sort, filter, context menu, header menu, column resize, commit, discard, search, new row, view selector
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Cell-Based Selection Model | 1/2 | In Progress|  |
| 2. Keyboard Handler Extraction | 0/2 | Not started | - |
| 3. GridOverlays Cleanup | 0/1 | Not started | - |
