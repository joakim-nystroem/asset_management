# Phase 7: Architectural Correction - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning
**Replaces:** Previous context (updated 02-28 with corrected event architecture decisions)

<domain>
## Phase Boundary

Correct the codebase to match the target architecture defined in CLAUDE.md. Eliminate ALL 11 legacy controllers by moving their logic to owning components. Move data ownership to `+page.svelte`. Restructure GridOverlays as parent wrapper. Unify the edit flow so existing and new rows share the same path. After this phase, every component owns its logic — no external controllers remain.

Controller eliminations:
1. `gridValidation` → FloatingEditor edit flow
2. `gridChanges` → editCtx (entry exists = dirty)
3. `gridEdit` → FloatingEditor
4. `gridHistory` → FloatingEditor (owns push/undo/redo) + historyCtx (data)
5. `gridSelection` → GridOverlays + selCtx
6. `gridColumns` → GridHeader + colCtx
7. `gridRows` → rowCtx + virtualScrollManager
8. `rowGeneration` → newRowCtx + NewRow component set
9. `gridClipboard` → clipboardCtx (copy in GridOverlays, paste in FloatingEditor)
10. `gridShortcuts` → GridOverlays owns all input directly
11. `interactionHandler` → GridOverlays

Also in scope:
- Data ownership move to `+page.svelte` (done in 07-01)
- Event architecture correction (07-02) — EventListener rebuilt, EventHandler thinned
- Sort extraction to GridHeader
- Filter extraction (components write searchManager, EventListener reacts)
- NEW-N string IDs for new rows

</domain>

<decisions>
## Implementation Decisions

### Data Ownership
- `+page.svelte` owns ALL server load data as individual `$state` declarations (done in 07-01)
- EventListener receives ZERO props — reads contexts only

### Event Architecture (07-02 scope)
- **EventListener is gutted and rebuilt** — pure context watcher, zero props, zero data responsibilities
- EventListener reads contexts via `getXContext()`, watches via `$effect`, produces self-contained events
- EventListener imports EventQueue.svelte.ts directly (simple import) to enqueue events
- **No EventQueueContext** — no context needed for queue access, just an import
- **No DataSeeder.svelte** — don't create new components to shuffle props around
- **URL sync is SCRAPPED** from EventListener — different solution in a future phase
- **Events are self-contained** — carry ALL relevant data in the event object (e.g., COMMIT carries edits array)
- **EventHandler becomes pure switch routing in 07-02** — business logic moves to target modules NOW, not deferred
- EventHandler does NOT read contexts, does NOT contain business logic beyond routing
- +page.svelte initializes the event system (EventQueue, EventHandler) per CLAUDE.md

### GridOverlays Restructure
- GridOverlays becomes PARENT wrapper: GridContainer → GridOverlays → (GridHeader + GridRows + FloatingEditor)
- Invisible overlay that listens to all input and renders visual feedback (selections, dirty cells, invalid overlays)
- Passes props DOWN to FloatingEditor (edit keystrokes) and GridHeader (resize events) as children
- Absorbs 4 controllers: gridShortcuts, gridSelection, interactionHandler, gridClipboard (copy)
- One job: input handling + visual feedback. Not too big — keyboard input handling is not that much code

### Edit Flow Unification
- "Cell editing is cell editing" — identical path for existing rows (number ID) and new rows (string "NEW-N" ID)
- FloatingEditor.svelte.ts runs the full edit flow: save → validate → upsert editCtx → optimistic-update asset → push to historyCtx
- Undo/redo applies values then runs the same edit flow per cell
- Only exception: new rows (string ID) skip WebSocket broadcast — they don't exist for other users yet
- editCtx shape: array of `CellEdit { row: number|string, col, original, value, valid }`

### Validation
- FloatingEditor validates on save for ALL cells — no separate validation system
- `validateAll()` is removed along with gridValidation controller
- Frontend validation in FloatingEditor is sufficient for the client
- Server-side validation handles the rest on commit
- No validationCtx — validation is part of the edit flow, not a separate concern

### Change Tracking
- gridChanges folds into editCtx — that simple
- If an editCtx entry exists for [row, col], the cell is dirty
- If value === original, remove the entry (cell reverts to clean)
- No additional logic needed beyond editCtx

### History
- FloatingEditor owns ALL history operations: push (on save), undo, redo, paste
- FloatingEditor reads/writes historyCtx directly — no separate history controller
- historyCtx shape: `{ undoStack: HistoryAction[][], redoStack: HistoryAction[][] }`

### NewRow
- rowGeneration.svelte.ts eliminated entirely — replaced by newRowCtx + NewRow component set
- NEW-N monotonic string counter for IDs
- NewRow component set lives inside GridContainer's render tree

### Sort Extraction
- Sort logic (sortData, sortDataAsync, applySort) moves to GridHeader
- GridHeader owns the sort interaction AND the sort implementation
- Same destination as the old plan — this was already correct

### Filter Extraction
- Components write to searchManager directly (HeaderMenu, ContextMenu)
- EventListener watches filter state via $effect and enqueues FILTER event
- Same approach as old plan — still valid

### GridHeader Group
- gridColumns eliminated — width state lives in colCtx, resize logic in GridHeader
- Sort logic moves to GridHeader (see above)

### Row Management
- gridRows eliminated — height state lives in rowCtx, height math in virtualScrollManager

### Claude's Discretion
- Internal module structure for each component (inline vs co-located .svelte.ts)
- How GridContextProvider seeds constraint data
- Import organization and file-level code structure
- Whether GridOverlays uses a co-located .svelte.ts or keeps logic inline
- Where EventHandler's business logic lands (target module structure for commit/discard/filter handlers)

</decisions>

<specifics>
## Specific Ideas

### Execution Waves (5 waves, 1 plan each)

**Wave 1 (done):**
- 07-01: Data ownership lift to +page.svelte, GridOverlays as parent wrapper

**Wave 2:**
- 07-02: Event architecture correction — gut EventListener (pure context watcher), self-contained events, EventHandler becomes pure routing (business logic moves to target modules), URL sync scrapped

**Wave 3:**
- 07-03: FloatingEditor group — absorb gridEdit, gridChanges→editCtx, gridHistory→historyCtx, gridValidation. Unified edit flow for all cells.

**Wave 4:**
- 07-04: GridHeader group — gridColumns→colCtx + sort extraction, eliminate gridRows

**Wave 5:**
- 07-05: Final cleanup — delete all 11 controller files, svelte-check gate

### Success Criteria
1. ALL 11 legacy controller files deleted
2. `+page.svelte` owns ALL server load data as `$state`
3. EventListener has ZERO props — pure context watcher
4. EventHandler is pure switch routing — no business logic
5. Events are self-contained — carry all data in payload
6. GridOverlays is parent wrapper around GridHeader + GridRows
7. FloatingEditor owns complete edit flow: save, validate, undo, redo, paste
8. Identical edit path for existing and new rows (only diff: WS broadcast skip for new rows)
9. editCtx replaces gridChanges — entry exists = dirty
10. historyCtx replaces gridHistory — FloatingEditor owns all operations
11. New rows use "NEW-N" string IDs
12. Sort logic lives in GridHeader
13. Filter selection dispatched through event queue
14. `svelte-check` 0 errors
15. All existing functionality works: sort, filter, view change, commit, discard, add row, edit, undo/redo

</specifics>

<deferred>
## Deferred Ideas

- **URL solution** — URL sync scrapped from EventListener. Full URL redesign (popstate/back-forward, initial load from URL params, removing `reactiveUrl` SvelteURL hack) is a future phase
- **Phase 8+** renamed/rescoped — Spatial Clipboard Hardening, WebSocket Delta Sync remain as future phases

</deferred>

---

*Phase: 07-architectural-correction*
*Context gathered: 2026-02-28 (updated with corrected event architecture decisions)*
