---
status: diagnosed
phase: 04-context-split-component-autonomy
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md]
started: 2026-02-26T06:10:00Z
updated: 2026-02-26T06:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Drag Selection Across Cells
expected: Click and hold on a cell, then drag across multiple cells. The selection should highlight as you drag over cells (blue highlight). Release to finalize selection.
result: pass

### 2. Context Menu on Right-Click
expected: Right-click on a grid cell. A custom context menu appears (not the browser's native menu). The menu shows relevant actions for that cell.
result: pass

### 3. FloatingEditor Font Size Matches Grid
expected: Double-click a cell to start editing. The text in the editor/textarea should match the font size of the surrounding grid cells (small text, consistent with the grid).
result: pass

### 4. Toolbar Functions Without Props
expected: The toolbar row (commit, discard, add row, view switcher, search) renders and all buttons are clickable. Commit/discard respond to dirty state. Add row creates a new row. View switcher changes views. Search filters assets.
result: issue
reported: "Commit and discard buttons are not rendered. filter button is clickable. +new row creates a new row. views works. Searching filtered assets works. Searching and then filtering from the header menu shows an unfiltered list of items as if a search hadn't been performed."
severity: major

### 5. Commit Changes (Save)
expected: Edit one or more cells, then click the commit/save button in the toolbar. Changes are saved to the server. The dirty indicator clears. Refreshing the page shows the saved values.
result: skipped
reason: Commit button not rendered (blocked by Test 4)

### 6. Discard Changes
expected: Edit one or more cells (dirty state appears), then click the discard button. All edits revert to the original values. Dirty indicator clears.
result: skipped
reason: Discard button not rendered (blocked by Test 4)

### 7. Add New Row
expected: Click the "add row" button in the toolbar. A new empty row appears at the bottom of the grid. The grid scrolls to the new row and selects it.
result: pass

### 8. Copy and Paste Cells
expected: Select one or more cells, press Ctrl+C. A visual copy indicator appears. Navigate to another cell, press Ctrl+V. The copied values are pasted into the target cells.
result: pass

### 9. Undo and Redo
expected: Make an edit to a cell. Press Ctrl+Z — the edit reverts. Press Ctrl+Y or Ctrl+Shift+Z — the edit reappears.
result: issue
reported: "undo redo works on copy and paste but not on edit. Also, clicking edit from the right click context menu does NOT close the context menu which it should"
severity: major

### 10. Column Sorting via Header
expected: Click a column header to open header menu. Select "Sort A to Z" or "Sort Z to A". Sorting applies correctly. Clicking the active sort option again removes the sort.
result: pass

### 11. Context Menu Filter By Value
expected: Right-click a cell and select "Filter" from the context menu. The grid filters to show only rows matching that cell's value. The URL updates with the filter parameter.
result: issue
reported: "the filter button does nothing and does not work"
severity: major

### 12. Page Loads Without Errors
expected: Navigate to the asset page. The grid loads with data, toolbar renders, no console errors related to context or undefined properties.
result: issue
reported: "The data load is slower than before. 'Query Successful, but no data was returned' is displayed for a split second before the data is populated. Before this refactor, the data display was instant. Also commit and discard are not shown in the toolbar as they should when editing. Other than that no errors displayed."
severity: major

## Summary

total: 12
passed: 6
issues: 4
pending: 0
skipped: 2

## Gaps

- truth: "Toolbar commit and discard buttons render and respond to dirty state"
  status: failed
  reason: "User reported: Commit and discard buttons are not rendered."
  severity: major
  test: 4
  root_cause: "Toolbar.svelte creates its own orphaned createChangeController() instance (line 8) whose hasChanges is permanently false. The real dirty state lives in DataController's separate instance which writes to changeCtx.hasUnsavedChanges. Toolbar reads changes.hasChanges from its dead local instance instead of changeCtx.hasUnsavedChanges."
  artifacts:
    - path: "frontend/src/lib/components/grid/Toolbar.svelte"
      issue: "Line 8: orphaned createChangeController(), line 113: reads changes.hasChanges instead of changeCtx.hasUnsavedChanges"
    - path: "frontend/src/lib/context/gridContext.svelte.ts"
      issue: "ChangeContext has hasUnsavedChanges field — already synced by DataController"
  missing:
    - "Replace changes.hasChanges with changeCtx.hasUnsavedChanges in Toolbar"
    - "Remove orphaned createChangeController() from Toolbar"
    - "Add hasNewRows and invalidCount bridge fields to ChangeContext for rowGen"

- truth: "Searching then filtering from header menu preserves search results"
  status: failed
  reason: "User reported: Searching and then filtering from the header menu shows an unfiltered list of items as if a search hadn't been performed."
  severity: major
  test: 4
  root_cause: "updateSearchUrl() in DataController.svelte unconditionally deletes all URL params (q, filter, view) before re-adding. handleViewChange() calls updateSearchUrl({ view: viewName }) without passing q or filters, so they are permanently wiped. Any code path that calls updateSearchUrl without preserving existing params loses them."
  artifacts:
    - path: "frontend/src/lib/components/grid/DataController.svelte"
      issue: "Lines 139-149: updateSearchUrl unconditionally deletes q/filter before re-adding; line 329: handleViewChange passes only {view}"
  missing:
    - "Make updateSearchUrl a safe partial-update — only delete params explicitly provided"
    - "Fix handleViewChange to preserve q and filters via getCurrentUrlState()"

- truth: "After pasting cells, the target paste area should show selection highlights"
  status: failed
  reason: "User reported: After copying and pasting, the target paste area should have selection highlights"
  severity: minor
  test: 5
  root_cause: "paste() in gridClipboard.svelte.ts never clears selCtx.isHiddenAfterCopy (set to true by copy()) and never updates selectionStart/selectionEnd to cover the pasted range. The overlay guard !selCtx.isHiddenAfterCopy in GridOverlays keeps the selection hidden after paste."
  artifacts:
    - path: "frontend/src/lib/grid/utils/gridClipboard.svelte.ts"
      issue: "paste() never resets isHiddenAfterCopy=false and never updates selectionStart/End to pasted range"
    - path: "frontend/src/lib/components/grid/GridOverlays.svelte"
      issue: "Line 282: guard !selCtx.isHiddenAfterCopy blocks highlight after paste"
  missing:
    - "In paste(), after computing pasted range: set selCtx.isHiddenAfterCopy = false"
    - "In paste(), update selCtx.selectionStart/End to cover the pasted area"

- truth: "Context menu 'Filter' action filters grid to matching rows and updates URL"
  status: failed
  reason: "User reported: the filter button does nothing and does not work"
  severity: major
  test: 11
  root_cause: "handleFilterByValue() in contextMenu.svelte.ts calls getUiContext() at click-handler runtime, not during component initialization. Svelte 5's createContext getters only work during synchronous component setup — calling at runtime returns undefined, so the function silently does nothing."
  artifacts:
    - path: "frontend/src/lib/grid/components/context-menu/contextMenu.svelte.ts"
      issue: "Line 48: getUiContext() called inside handleFilterByValue() at runtime instead of component init"
    - path: "frontend/src/lib/grid/components/context-menu/contextMenu.svelte"
      issue: "Line 79: onclick calls handleFilterByValue without passing uiCtx"
  missing:
    - "Change handleFilterByValue to accept uiCtx as parameter"
    - "Pass uiCtx from contextMenu.svelte component where it was captured during init"

- truth: "Data loads instantly without flash of 'no data' message"
  status: failed
  reason: "User reported: data load is slower than before. 'Query Successful, but no data was returned' flashes for a split second before data populates. Before refactor it was instant."
  severity: major
  test: 12
  root_cause: "GridContextProvider initializes dataCtx.assets as empty array (line 91). DataController populates it via $effect which is deferred until after first render. GridContainer's {#if assets.length > 0} check evaluates against empty array on first paint, showing 'no data' for one frame."
  artifacts:
    - path: "frontend/src/lib/context/GridContextProvider.svelte"
      issue: "Line 91: dataCtx.assets initialized to [] before DataController can populate"
    - path: "frontend/src/lib/components/grid/DataController.svelte"
      issue: "Line 64: $effect deferred — assets only written to context after first render"
    - path: "frontend/src/lib/components/grid/GridContainer.svelte"
      issue: "Line 88/206: shows 'no data' message when assets.length === 0"
  missing:
    - "Synchronously seed dataCtx.assets in DataController's script block (not in $effect)"

- truth: "Undo/redo reverts and reapplies cell edits"
  status: failed
  reason: "User reported: undo redo works on copy and paste but not on edit"
  severity: major
  test: 9
  root_cause: "FloatingEditor calls edit.save() and discards the return value — no history.record() call. The history controller lives in GridOverlays which has no callback hook into FloatingEditor's save events. history.record() is never called anywhere in the codebase — only recordBatch() from paste."
  artifacts:
    - path: "frontend/src/lib/grid/components/floating-editor/FloatingEditor.svelte"
      issue: "Lines 71,98,111,135,160,170: edit.save() return value discarded, no history recording"
    - path: "frontend/src/lib/components/grid/GridOverlays.svelte"
      issue: "Line 33: owns history instance but has no path to record edit saves from FloatingEditor"
    - path: "frontend/src/lib/grid/utils/gridHistory.svelte.ts"
      issue: "record() exists but is never called anywhere"
  missing:
    - "Add onSave callback prop to FloatingEditor for history recording"
    - "Wire GridOverlays to pass history.record + changes.update via onSave callback"

- truth: "Clicking edit from right-click context menu closes the context menu"
  status: failed
  reason: "User reported: clicking edit from the right click context menu does NOT close the context menu which it should"
  severity: major
  test: 9
  root_cause: "Edit button's onclick in contextMenu.svelte (line 42) only calls edit.startEdit() — never calls uiCtx.contextMenu?.close(). After migration to domain contexts, the close call was lost. Other actions (Delete Row, Filter) correctly call close()."
  artifacts:
    - path: "frontend/src/lib/grid/components/context-menu/contextMenu.svelte"
      issue: "Line 42: Edit onclick missing uiCtx.contextMenu?.close() before startEdit"
  missing:
    - "Add uiCtx.contextMenu?.close() to Edit button onclick, before edit.startEdit()"
