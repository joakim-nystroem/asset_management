# Phase 6: Undo/Redo Session Engine - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the session-scoped undo/redo history stack fully functional. Audit the history controller, ensure entries integrate with `changeContext` as uncommitted drafts, verify Ctrl+Z / Ctrl+Y traversal and visual overlay updates, and clear history appropriately. History controller lives inside the component that owns undo/redo behavior.

</domain>

<decisions>
## Implementation Decisions

### Undo granularity
- One undo entry per logical operation — a paste filling 10 cells is one Ctrl+Z
- Bulk operations (clearing a selection) are also one undo entry
- Edits within a single cell focus session are grouped — undo restores the value from before the cell was entered, not each keystroke
- Scope is cell values only — column reordering, hiding, or layout changes are not tracked

### Visual feedback
- Match Excel behavior — no flash, no toast, no animation. Value simply reverts.
- Auto-scroll to the affected cell if it's off-screen
- No toolbar undo/redo buttons — keyboard-only (Ctrl+Z / Ctrl+Y)
- Multi-cell undo (e.g., undoing a paste): no per-cell highlighting, values just revert

### History lifetime & clearing
- History persists across DB commits — critical so users can undo a mistakenly committed value
- History clears on page navigation (leaving the grid view)
- History clears on browser refresh (F5) — in-memory only, no sessionStorage persistence
- Since commits don't clear history, partial commit failure handling is not a concern for the undo layer

### Redo behavior
- Standard Excel model: undo 3 steps, make a new edit, redo stack is discarded
- No branching/tree undo

### History depth
- Unlimited — no cap on undo entries per session
- Memory pressure from a typical editing session is negligible

### Conflict handling
- Undo stack is purely local — no awareness of other users' edits
- Ctrl+Z always restores YOUR previous local value, no queue validation
- Multi-user sync conflicts are deferred to Phase 8 (WebSocket Delta Sync)

### Column type handling
- Type-agnostic — history stores old/new values regardless of column type (text, dropdown, date, etc.)
- Restoring a value works the same way for all types

### Claude's Discretion
- Internal data structure for the history stack (array, linked list, etc.)
- How grouping by cell focus session is detected and bounded
- Integration specifics with changeContext internals
- Any debounce or batching mechanics for rapid operations

</decisions>

<specifics>
## Specific Ideas

- "We're masters of Excel here — match Excel" — the reference point for all undo/redo UX decisions
- History surviving commits is explicitly important: if you commit the wrong value, you need to be able to undo it back

</specifics>

<deferred>
## Deferred Ideas

- Conflict resolution when another user edits the same cell — Phase 8 (WebSocket Delta Sync)
- Undo for column-level changes (reorder, hide/show) — future consideration

</deferred>

---

*Phase: 06-undo-redo-session-engine*
*Context gathered: 2026-02-26*
