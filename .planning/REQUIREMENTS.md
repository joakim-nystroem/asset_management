# Requirements: Asset Management System

**Defined:** 2026-03-04
**Core Value:** The grid must feel like a native spreadsheet — fast cell editing, keyboard navigation, multi-cell selection, copy/paste, and instant visual feedback for dirty state.

## v1 Requirements

Requirements for completing the architecture refactor. Each maps to roadmap phases.

### Undo/Redo

- [ ] **UNDO-01**: User can undo last cell edit with Ctrl+Z (restores previous value in pending edits)
- [ ] **UNDO-02**: User can redo an undone edit with Ctrl+Y (re-applies the undone change)
- [ ] **UNDO-03**: Multi-cell paste is a single undo step (batch undo restores all pasted cells at once)
- [ ] **UNDO-04**: Undo/redo persists across commits (undoing after commit creates new pending edits against the new baseline)

### Validation

- [ ] **VALID-01**: Cell save checks constraints (dropdown values must match allowed options, required fields cannot be empty)
- [ ] **VALID-02**: PendingContext edits reflect actual validation state (isValid flag set by constraint check, not hardcoded true)
- [ ] **VALID-03**: Commit is blocked when any pending edit has isValid=false (commit button disabled, user informed)

### New Row

- [ ] **NROW-01**: User can add a new row via Toolbar (creates row object with `NEW-N` string ID)
- [ ] **NROW-02**: New rows are pushed into `filteredAssets` and render as regular GridRows
- [ ] **NROW-03**: New row cells use the same editing, pending edits, and validation as existing rows
- [ ] **NROW-04**: User can delete an individual new row before commit (removes from filteredAssets and newRowCtx)
- [ ] **NROW-05**: Discard clears all new rows (removes from filteredAssets, empties newRowCtx, resets counter)

### Custom Scrollbar

- [ ] **SCRL-01**: Grid uses a custom-styled scrollbar replacing browser default
- [ ] **SCRL-02**: Scrollbar appearance is consistent across browsers (Chrome, Firefox, Edge)
- [ ] **SCRL-03**: Scrollbar integrates with virtual scroll manager (thumb size reflects content ratio, drag scrolls content)

### Grid Fixes

- [x] **GRID-01**: Column widths from ColumnWidthContext are applied in GridHeader column rendering
- [x] **GRID-02**: Column widths from ColumnWidthContext are applied in GridRow cell rendering

## v2 Requirements

Deferred to after refactor completion.

### Code Quality

- **QUAL-01**: Remove `startCellEdit()` helper from GridOverlays — inline into F2/double-click handlers
- **QUAL-02**: Remove dead code and unused imports from refactor
- **QUAL-03**: Consolidate duplicated logic across components

### Admin & Mobile Refactor

- **ADMN-01**: Admin panel refactored to match new architecture patterns
- **MOBL-01**: Mobile pages refactored to match new architecture patterns

### Testing

- **TEST-01**: Unit test coverage for event queue pipeline
- **TEST-02**: Unit test coverage for undo/redo system
- **TEST-03**: Integration tests for commit/discard workflow

## Out of Scope

| Feature | Reason |
|---------|--------|
| Admin panel refactor | Deferred until main grid refactor complete |
| Mobile page refactor | Deferred until main grid refactor complete |
| Test suite | Separate initiative from architecture refactor |
| Pagination/lazy-loading | Virtual scroll handles current dataset sizes |
| Conflict resolution (CRDT/OT) | WebSocket locking sufficient for current user count |
| Code cleanup | Deferred to v2 — focus on feature completion first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| GRID-01 | Phase 1 | Complete (01-01) |
| GRID-02 | Phase 1 | Complete (01-01) |
| VALID-01 | Phase 2 | Pending |
| VALID-02 | Phase 2 | Pending |
| VALID-03 | Phase 2 | Pending |
| NROW-01 | Phase 3 | Pending |
| NROW-02 | Phase 3 | Pending |
| NROW-03 | Phase 3 | Pending |
| NROW-04 | Phase 3 | Pending |
| NROW-05 | Phase 3 | Pending |
| UNDO-01 | Phase 4 | Pending |
| UNDO-02 | Phase 4 | Pending |
| UNDO-03 | Phase 4 | Pending |
| UNDO-04 | Phase 4 | Pending |
| SCRL-01 | Phase 5 | Pending |
| SCRL-02 | Phase 5 | Pending |
| SCRL-03 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-03-04*
*Last updated: 2026-03-04 — traceability filled after roadmap creation*
