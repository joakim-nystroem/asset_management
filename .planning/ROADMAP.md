# Roadmap: Asset Management — Refactor Completion

## Overview

Five phases that complete the arch-rehaul refactor. The grid already renders, edits, sorts, filters, copies, pastes, and commits. What remains is correctness (column widths, validation), feature parity (new rows, undo/redo), and UX polish (custom scrollbar). Each phase delivers one coherent capability that can be verified independently before moving on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Grid Fixes** - Apply ColumnWidthContext widths correctly in GridHeader and GridRow
- [x] **Phase 01.1: closePanels helper** - Extract repeated panel-closing pattern into reusable helper (INSERTED)
- [ ] **Phase 01.2: Interaction Grid Layer** - Gut GridOverlays, move interaction to GridContainer (INSERTED)
- [ ] **Phase 2: Validation** - Real constraint checking on cell save with commit gating
- [ ] **Phase 3: New Row** - NewRow component set with full editing parity to existing rows
- [ ] **Phase 4: Undo/Redo** - HistoryContext population, Ctrl+Z/Y, batch undo for paste
- [ ] **Phase 5: Custom Scrollbar** - Styled scrollbar replacing browser default, integrated with virtual scroll

## Phase Details

### Phase 1: Grid Fixes
**Goal**: Column widths are applied correctly everywhere the grid renders
**Depends on**: Nothing (first phase)
**Requirements**: GRID-01, GRID-02
**Success Criteria** (what must be TRUE):
  1. Resizing a column header updates the rendered width in both the header and all data rows simultaneously
  2. Column width state from ColumnWidthContext is the sole source of width for GridHeader and GridRow — no hardcoded or fallback widths override it
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md — Create gridConfig.ts constants module, migrate DEFAULT_WIDTH imports, implement drag-to-resize in GridOverlays

### Phase 01.2: Interaction Grid Layer (INSERTED)

**Goal:** GridContainer owns all user interaction (mouse, keyboard, resize, context menu, panel management) and GridOverlays is a pure overlay-only renderer with zero event listeners
**Requirements**: None (inserted phase, no formal requirements)
**Depends on:** Phase 01.1
**Success Criteria** (what must be TRUE):
  1. GridContainer.svelte owns all mouse/keyboard event listeners and context menu rendering
  2. GridOverlays.svelte renders only visual overlays (dirty cells, selection, copy, user cursors) with no event handlers
  3. All existing interaction works identically: cell selection, keyboard navigation, column resize, context menu, panel management
  4. DOM structure inverted: GridOverlays is a child of GridContainer, not a wrapper
**Plans:** 2 plans

Plans:
- [ ] 01.2-01-PLAN.md — Create companion files: gridContainer.svelte.ts, gridKeyboardHandler.ts, gridContainerHelpers.ts
- [ ] 01.2-02-PLAN.md — Rewrite GridContainer.svelte and GridOverlays.svelte (atomic swap)

### Phase 01.1: closePanels helper function (INSERTED)

**Goal:** Consolidate the repeated panel-closing pattern in GridOverlays into a single closePanels() helper function
**Requirements**: None (inserted polish phase, no formal requirements)
**Depends on:** Phase 1
**Plans:** 1 plan

Plans:
- [x] 01.1-01-PLAN.md — Create setOpenPanel() helper and replace all 5 inline panel-closing patterns in GridOverlays

### Phase 2: Validation
**Goal**: Cell saves check real constraints and the commit workflow reflects actual validity
**Depends on**: Phase 1
**Requirements**: VALID-01, VALID-02, VALID-03
**Success Criteria** (what must be TRUE):
  1. Saving a cell with a dropdown column rejects any value not in the allowed options list
  2. Saving a required field with an empty value marks that cell as invalid
  3. A pending edit's isValid flag reflects the actual constraint check result — never hardcoded true
  4. The commit button is disabled when any pending edit has isValid=false, and a message tells the user why
**Plans**: TBD

### Phase 3: New Row
**Goal**: Users can add new rows that use the exact same editing path as existing rows
**Depends on**: Phase 2
**Requirements**: NROW-01, NROW-02, NROW-03, NROW-04, NROW-05
**Success Criteria** (what must be TRUE):
  1. Clicking "New Row" in the Toolbar inserts a blank row at the bottom of the grid, immediately visible without a page reload
  2. A new row cell can be edited, validated, and shows dirty-state overlays identically to an existing row cell
  3. An uncommitted new row can be deleted individually via a row-level delete action
  4. Clicking Discard removes all new rows from the grid and resets the new-row counter
**Plans**: TBD

### Phase 4: Undo/Redo
**Goal**: Users can reverse and replay cell edits, including multi-cell paste operations, even after committing
**Depends on**: Phase 2
**Requirements**: UNDO-01, UNDO-02, UNDO-03, UNDO-04
**Success Criteria** (what must be TRUE):
  1. Pressing Ctrl+Z while the grid is focused restores the previous cell value in pending edits
  2. Pressing Ctrl+Y re-applies an undone edit
  3. A multi-cell paste undoes as a single step — Ctrl+Z restores all pasted cells at once
  4. Pressing Ctrl+Z after a successful commit creates new pending edits against the committed baseline (not the pre-commit values)
**Plans**: TBD

### Phase 5: Custom Scrollbar
**Goal**: The grid scrollbar is styled consistently and integrated with the virtual scroll manager
**Depends on**: Phase 4
**Requirements**: SCRL-01, SCRL-02, SCRL-03
**Success Criteria** (what must be TRUE):
  1. The grid no longer shows the browser's native scrollbar
  2. The custom scrollbar thumb size reflects the ratio of visible rows to total rows (shorter thumb = more content)
  3. Dragging the scrollbar thumb scrolls the grid content at the correct proportional position
  4. The scrollbar appearance is visually consistent in Chrome, Firefox, and Edge
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 01.1 → 01.2 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Grid Fixes | 1/1 | Complete    | 2026-03-04 |
| 01.1. closePanels helper | 1/1 | Complete    | 2026-03-04 |
| 01.2. Interaction Grid Layer | 0/2 | Not started | - |
| 2. Validation | 0/TBD | Not started | - |
| 3. New Row | 0/TBD | Not started | - |
| 4. Undo/Redo | 0/TBD | Not started | - |
| 5. Custom Scrollbar | 0/TBD | Not started | - |
