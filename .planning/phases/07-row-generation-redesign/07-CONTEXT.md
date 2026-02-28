# Phase 7: Architectural Correction - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning (REWORK — updated with post-implementation reality)
**Replaces:** Previous context that referenced EventListener pattern (now Smart Owner)

<domain>
## Phase Boundary

Eliminate all legacy controllers and ghost context imports so the codebase matches the Smart Owner + assetStore architecture. After this phase: zero legacy controllers, zero ghost imports, `svelte-check` passes with 0 errors.

**Already implemented (committed):**
- Smart Owner event system: `EventOwner.svelte` → `eventQueue.ts` → `eventHandler.ts`
- `assetStore.svelte.ts` — module-level `$state` singleton for all server data
- `+page.svelte` seeds `assetStore`, renders component tree
- Old event files deleted (`EventListener.svelte`, `EventQueue.svelte.ts`, `EventHandler.svelte.ts`)

**Remaining work:**
- 36 svelte-check errors across 13 files (ghost context imports, missing UiContext properties, implicit any types)
- 10 legacy controller files to delete + `interactionHandler.ts`
- `searchManager.svelte.ts` to eliminate
- Components need migration from ghost contexts to `assetStore` / correct context imports

</domain>

<decisions>
## Implementation Decisions

### DataContext → assetStore Migration
- `getDataContext()` no longer exists — all 6 components importing it swap to `import { assetStore } from '$lib/data/assetStore.svelte.ts'`
- Direct property access: `assetStore.filteredAssets`, `assetStore.baseAssets`, `assetStore.locations`, etc.
- No DataContext, no data in contexts — `assetStore` is the single source of truth for server data

### searchManager Elimination
- `searchManager` is deleted entirely — search/filter state moves to context
- Filter state lives in context; components (headerMenu, filterPanel) write to context directly
- EventOwner watches filter context changes via `$effect`, enqueues FILTER events
- eventHandler processes FILTER events (API call, updates `assetStore.filteredAssets`)
- 5 files currently importing searchManager need migration

### UiContext Cleanup
- `getCurrentUrlState` / `updateSearchUrl` — **SCRAPPED**, URL sync deferred to future phase
- `applySort` — moves to GridHeader (local JS rearrangement, completely local operation)
- `handleFilterSelect` — moves through context (component writes context → EventOwner watches → eventHandler processes)
- Remove all 5 missing properties from UiContext references

### Edit Flow (FloatingEditor Ownership)
- FloatingEditor owns the complete local edit lifecycle:
  1. User edits cell
  2. Check if value === original value → if same, revert (remove editCtx entry), return
  3. Validate value
  4. Upsert editCtx entry (`{ row, col, original, value, valid }`)
  5. GridOverlays reacts to editCtx changes (dirty/invalid visual feedback)
  6. Edit event pushed through event queue → websocket broadcast (real-time sync)
- "Cell editing is cell editing" — identical path for existing rows (number ID) and new rows ("NEW-N" string ID)
- Only exception: new rows skip websocket broadcast (don't exist for other users yet)
- gridEdit, gridChanges, gridValidation, gridHistory all fold into FloatingEditor + editCtx/historyCtx

### Controller Deletion Strategy
- **Delete first, fix what breaks** — no cautious migration waves
- Delete all 10 legacy controllers + interactionHandler in one pass
- Fix resulting errors against the target architecture
- Legacy controllers to delete:
  1. `gridValidation.svelte.ts`
  2. `gridChanges.svelte.ts`
  3. `gridEdit.svelte.ts`
  4. `gridHistory.svelte.ts`
  5. `gridSelection.svelte.ts`
  6. `gridColumns.svelte.ts`
  7. `gridRows.svelte.ts`
  8. `rowGeneration.svelte.ts`
  9. `gridClipboard.svelte.ts`
  10. `gridShortcuts.svelte.ts`
  11. `interactionHandler.ts` (in `lib/utils/interaction/`)

### Sort Extraction
- `applySort` moves to GridHeader — local JS sort, rearranges the grid in-place
- GridHeader owns the sort interaction AND the sort implementation
- `getSortContext()` ghost imports fixed — sort state lives in `sortCtx` (already defined)

### Remaining Architecture (LOCKED from prior decisions)
- Contexts = ephemeral UI state ONLY (editCtx, historyCtx, selCtx, etc.)
- Validation = part of edit flow in FloatingEditor, NOT a separate system
- No validationCtx, no changeCtx — these were eliminated
- GridOverlays = parent wrapper for input handling + visual feedback
- NewRow component set replaces rowGeneration controller
- NEW-N monotonic string counter for new row IDs

### Claude's Discretion
- Internal module structure for each component (inline vs co-located .svelte.ts)
- Import organization and file-level code structure
- Order of fixing the 36 errors (whatever is most efficient)
- How to handle any remaining callers of deleted controllers

</decisions>

<specifics>
## Specific Ideas

### Execution Approach
- Delete all legacy controllers + searchManager in one pass
- Fix ghost context imports across all 13 error files
- Swap `getDataContext()` → `import { assetStore }`
- Remove UiContext properties that no longer exist
- Add missing type annotations for implicit `any` parameters
- Gate on `svelte-check` 0 errors

### Error Breakdown (36 errors, 13 files)
| Category | Count | Fix |
|----------|-------|-----|
| Ghost context imports (getDataContext, getSortContext, getValidationContext, getChangeContext, getRowGenControllerContext, etc.) | ~17 | Swap to assetStore / correct context |
| Missing UiContext properties (applySort, getCurrentUrlState, updateSearchUrl, handleFilterSelect) | ~13 | Remove references, move logic to owners |
| Implicit `any` types | ~6 | Add type annotations |

### Success Criteria
1. ALL legacy controller files deleted (10 controllers + interactionHandler)
2. `searchManager.svelte.ts` deleted
3. Zero ghost context imports
4. `assetStore` used for all server data access
5. Filter/search flow: context → EventOwner → eventHandler
6. Sort logic lives in GridHeader
7. Edit flow owned by FloatingEditor
8. `svelte-check` 0 errors
9. All existing functionality works: sort, filter, view change, commit, discard, add row, edit

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `assetStore.svelte.ts`: Already implemented, module-level `$state` singleton — components import directly
- `EventOwner.svelte` / `eventQueue.ts` / `eventHandler.ts`: Smart Owner pipeline already working
- `GridContextProvider.svelte`: Creates context shells — already exists, may need minor updates
- `gridContext.svelte.ts`: Context type definitions — needs ghost exports removed

### Established Patterns
- Smart Owner pattern: EventOwner watches context flags → snapshots → enqueue → eventHandler routes → target mutates proxies/assetStore
- Module singleton pattern: `assetStore` imported directly (no context), `$state` at module level
- Component sets: `.svelte` + `.svelte.ts` co-located pairs (FloatingEditor, headerMenu, contextMenu, etc.)

### Integration Points
- `+page.svelte` seeds `assetStore` on init — already done
- `GridContextProvider` creates empty context shells — may need context type updates
- `eventHandler.ts` imports `assetStore` directly for data mutations
- Components read contexts via `getXContext()` for ephemeral UI state

### Files Needing Migration (callers of ghost contexts)
- `GridContainer.svelte` — imports getDataContext, getSortContext
- `Toolbar.svelte` — imports getDataContext, getChangeContext, getRowGenControllerContext
- `GridHeader.svelte` — imports getSortContext
- `GridOverlays.svelte` — imports getDataContext
- `FloatingEditor.svelte` — imports getDataContext
- `contextMenu.svelte` — imports getDataContext, getRowGenControllerContext
- `gridChanges.svelte.ts` — imports getValidationContext, getChangeContext (DELETE file)
- `gridValidation.svelte.ts` — imports getValidationContext (DELETE file)
- `rowGeneration.svelte.ts` — imports getValidationContext (DELETE file)

</code_context>

<deferred>
## Deferred Ideas

- **URL solution** — URL sync scrapped. Full URL redesign (popstate/back-forward, initial load from URL params, removing `reactiveUrl` SvelteURL hack) is a future phase
- **GridOverlays as parent wrapper** — structural DOM change (GridOverlays wrapping GridHeader + GridRows) not in this pass; focus is on eliminating legacy dependencies
- **NewRow component set** — full component pair creation deferred; rowGeneration controller deleted but replacement component set is separate work

</deferred>

---

*Phase: 07-architectural-correction*
*Context gathered: 2026-02-28 (rework — updated to reflect Smart Owner implementation reality)*
