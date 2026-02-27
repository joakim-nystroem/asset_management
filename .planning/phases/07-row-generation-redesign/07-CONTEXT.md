# Phase 7: Row Generation Redesign - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning
**Source:** PRD Express Path (.omc/plans/row-generation-redesign.md)

<domain>
## Phase Boundary

Replace the scattered rowGen shared-context approach with a self-contained `RowGeneration.svelte` + `rowGeneration.svelte.ts` component pair in `frontend/src/lib/grid/components/row-generation/`. A new row IS a grid row — same rendering, same editing (FloatingEditor), same interactions (dblclick, F2, right-click). The only difference is INSERT vs UPDATE at the database level.

</domain>

<decisions>
## Implementation Decisions

### Architecture
- New component pair: `rowGeneration.svelte` + `rowGeneration.svelte.ts` in `frontend/src/lib/grid/components/row-generation/`
- Move existing `frontend/src/lib/grid/utils/rowGeneration.svelte.ts` to new location (keep all logic)
- RowGeneration component renders new rows using `<GridRow>` components (same as regular rows)
- Single context pair exported so Toolbar can read `hasNewRows` for commit button
- Visually distinguishable new rows (subtle background or left border for "pending" state)

### Component Placement
- Inside `GridContainer.svelte`, after virtual-scrolled regular rows, inside the scroll area
- Scrolls with grid content
- Virtual scroll must account for new row heights

### Editing Flow
- Double-click new row cell → same `editCtx` mechanism triggers FloatingEditor
- FloatingEditor opens at correct position relative to the new row
- On save → component's own onSave handler routes to `updateNewRowField()`
- No routing fork in GridOverlays — GridOverlays only handles existing rows

### Commit Flow
- Toolbar sees `rowGen.hasNewRows` → shows Commit button
- Commit calls `dataCtx.addRows()` → enqueues `{ type: 'COMMIT', mode: 'create' }`
- EventHandler.handleCommitCreate reads from rowGen context → POST `/api/create/asset`
- Same flow as today, cleaner dependency chain

### State Management
- `newRows: NewRow[]` — scaffold rows pending commit
- `invalidFields: Map<number, Set<string>>` — validation state
- Validation logic: REQUIRED_FIELDS + constraint lists
- Methods: `addNewRows()`, `updateNewRowField()`, `deleteNewRow()`, `validateAll()`, `clearNewRows()`

### Cleanup Requirements
- Remove `createRowGenerationController()` from GridContextProvider
- Remove `isNewRow` routing fork from GridOverlays FloatingEditor onSave
- Remove `getRowGenControllerContext` from GridOverlays and contextMenu
- Remove new-row detection from dirty cell overlay logic in GridOverlays
- Remove "Delete Row" for new rows from contextMenu (handled by RowGeneration's own context menu)
- Remove `rowGen.newRows` from assets derived in EventListener (`assets = $derived([...filteredAssets])` — no more mixing)
- Delete old `frontend/src/lib/grid/utils/rowGeneration.svelte.ts` after migration

### Toolbar
- Keep `getRowGenControllerContext` for reading `hasNewRows` (commit button visibility)
- Keep the `{:else if rowGen.hasNewRows}` commit button block
- No structural changes — Toolbar just reads state, doesn't manage it

### EventHandler
- `handleCommitCreate` reads rowGen from context (or receives via DI)
- No structural changes to commit logic itself

### Claude's Discretion
- Exact visual styling for pending-row indicator (background color, border style)
- How RowGeneration component handles its own context menu internally
- Whether virtual scroll needs adjustment or new rows sit outside virtual scroll
- Error handling for failed commits
- Keyboard navigation between regular rows and new rows

</decisions>

<specifics>
## Specific Ideas

- Use same `<GridRow>` component for rendering new rows — maximum code reuse
- FloatingEditor positioning must work for new rows the same way as regular rows
- Context menu within RowGeneration should offer "Delete Row" for pending rows
- Multiple new rows supported, batch commit via existing Toolbar button
- Main assets array stays pure — no `[...filteredAssets, ...rowGen.newRows]` mixing

</specifics>

<deferred>
## Deferred Ideas

None — PRD covers phase scope

</deferred>

---

*Phase: 07-row-generation-redesign*
*Context gathered: 2026-02-27 via PRD Express Path*
