---
status: complete
phase: 03-floating-editor-context-menu
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: 2026-02-26T00:30:00Z
updated: 2026-02-26T01:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Right-click context menu appears at cursor position
expected: Right-click on any data cell. A context menu should appear near your cursor with options: Edit, Copy, Paste, Filter by Value. The menu should be positioned at the click location (not offset or stuck in a corner).
result: pass

### 2. Double-click to open FloatingEditor
expected: Double-click a data cell. A floating editor (textarea) should appear positioned directly over that cell, matching its size. The cell content should be selected/focused immediately so you can start typing.
result: pass

### 3. Edit via context menu
expected: Right-click a cell → click Edit. The FloatingEditor overlay should appear over that specific cell (same position as double-clicking it directly).
result: issue
reported: "pass. Not a major issue, but font size should be the same as the default grid while editing (obviously same with the previous double-click step)"
severity: cosmetic

### 4. FloatingEditor — save with Enter
expected: Double-click a cell to open editor, type new content, press Enter. The editor should close and the cell should display the new value.
result: pass

### 5. FloatingEditor — cancel with Escape
expected: Double-click a cell to open editor, type something, press Escape. The editor should close and the original cell value should be restored unchanged.
result: pass

### 6. Filter by value from context menu
expected: Right-click a cell that has a value → click "Filter by Value". The grid should filter to show only rows where that column matches that cell's value.
result: issue
reported: "Fail. Nothing happens when filter is clicked through the context menu"
severity: major

### 7. Delete row only for new rows
expected: Right-click a pre-existing (loaded from DB) row — no "Delete" option should appear in the context menu. Right-click a freshly generated/new row — a Delete Row option should appear and selecting it should remove that row.
result: issue
reported: "Fail. When in 'new row mode' the context menu does not work at all and the default browser right click menu is displayed no matter where you click on the page. How new row mode is tracked might need a revisit"
severity: major

### 8. Drag selection still works
expected: Click on a cell and drag the mouse across other cells. The dragged cells should highlight (selection state) as you drag.
result: issue
reported: "Fail. Click and drag selection does not work. Shift+arrow key does work to increase selection range though."
severity: major

### 9. Copy and Paste via context menu
expected: Right-click a cell → Copy. Right-click a different cell → Paste. The value from the first cell should appear in the second cell (or the clipboard value pastes).
result: pass

## Summary

total: 9
passed: 5
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "FloatingEditor textarea font size matches the grid cell font size"
  status: failed
  reason: "User reported: font size should be the same as the default grid while editing"
  severity: cosmetic
  test: 3
  artifacts: []
  missing: []

- truth: "Filter by Value in context menu filters the grid to matching rows"
  status: failed
  reason: "User reported: Nothing happens when filter is clicked through the context menu"
  severity: major
  test: 6
  artifacts: []
  missing: []

- truth: "Context menu appears correctly when right-clicking in new row mode"
  status: failed
  reason: "User reported: In new row mode the context menu does not work at all — default browser right-click menu appears no matter where you click on the page. How new row mode is tracked might need a revisit"
  severity: major
  test: 7
  artifacts: []
  missing: []

- truth: "Click and drag across cells selects them (drag selection works)"
  status: failed
  reason: "User reported: Click and drag selection does not work. Shift+arrow key does work to increase selection range though."
  severity: major
  test: 8
  artifacts: []
  missing: []
