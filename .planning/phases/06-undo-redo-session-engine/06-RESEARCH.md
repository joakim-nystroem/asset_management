# Phase 6: Undo/Redo Session Engine - Research

**Researched:** 2026-02-26
**Domain:** Svelte 5 reactive history stack, keyboard shortcut integration, draft/overlay coordination
**Confidence:** HIGH — based entirely on direct code audit of the existing implementation

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Undo granularity**
- One undo entry per logical operation — a paste filling 10 cells is one Ctrl+Z
- Bulk operations (clearing a selection) are also one undo entry
- Edits within a single cell focus session are grouped — undo restores the value from before the cell was entered, not each keystroke
- Scope is cell values only — column reordering, hiding, or layout changes are not tracked

**Visual feedback**
- Match Excel behavior — no flash, no toast, no animation. Value simply reverts.
- Auto-scroll to the affected cell if it's off-screen
- No toolbar undo/redo buttons — keyboard-only (Ctrl+Z / Ctrl+Y)
- Multi-cell undo (e.g., undoing a paste): no per-cell highlighting, values just revert

**History lifetime and clearing**
- History persists across DB commits — critical so users can undo a mistakenly committed value
- History clears on page navigation (leaving the grid view)
- History clears on browser refresh (F5) — in-memory only, no sessionStorage persistence
- Since commits don't clear history, partial commit failure handling is not a concern for the undo layer

**Redo behavior**
- Standard Excel model: undo 3 steps, make a new edit, redo stack is discarded
- No branching/tree undo

**History depth**
- Unlimited — no cap on undo entries per session
- Memory pressure from a typical editing session is negligible

**Conflict handling**
- Undo stack is purely local — no awareness of other users' edits
- Ctrl+Z always restores YOUR previous local value, no queue validation
- Multi-user sync conflicts are deferred to Phase 8 (WebSocket Delta Sync)

**Column type handling**
- Type-agnostic — history stores old/new values regardless of column type (text, dropdown, date, etc.)
- Restoring a value works the same way for all types

### Claude's Discretion
- Internal data structure for the history stack (array, linked list, etc.)
- How grouping by cell focus session is detected and bounded
- Integration specifics with changeContext internals
- Any debounce or batching mechanics for rapid operations

### Deferred Ideas (OUT OF SCOPE)
- Conflict resolution when another user edits the same cell — Phase 8 (WebSocket Delta Sync)
- Undo for column-level changes (reorder, hide/show) — future consideration
</user_constraints>

---

## Summary

Phase 6 is primarily an audit-and-gap-closure phase, not a build-from-scratch one. The history controller (`gridHistory.svelte.ts`), keyboard wiring (`interactionHandler.ts` + `gridShortcuts.svelte.ts`), and the undo/redo callback chain in `GridOverlays.svelte` are all already implemented. The `HistoryController` instance is created in `GridContextProvider.svelte` and shared via `setHistoryControllerContext` so both `GridOverlays` and `DataController` operate on the same stack.

The implementation satisfies most requirements, but the code audit reveals two specific gaps against the CONTEXT.md spec:

1. **Auto-scroll after undo/redo is missing.** The `onUndo` and `onRedo` callbacks in `GridOverlays.svelte` revert values and update `changeContext`, but do not set `viewCtx.scrollToRow` to bring the affected cell into view.

2. **`commitChanges()` does not clear the history stack.** This is actually CORRECT per the locked decision ("history persists across DB commits"), but the code has a comment gap — `discard` correctly calls `history.clearCommitted()` (preserving remaining history while removing the committed baseline), while `commitChanges` intentionally leaves history untouched. This asymmetry needs to be verified and documented.

**Primary recommendation:** Audit the six history call-sites, fix the auto-scroll gap, add a `selection.selectCell()` call after undo/redo to highlight the reverted cell, and verify the discard path uses `clearCommitted` not `clear`.

---

## Architecture: How The System Currently Works

### Component Ownership

The history controller is NOT a free-floating singleton. It follows the Phase 4 pattern exactly:

```
GridContextProvider.svelte
  └── createHistoryController()          ← instance created once here
      setHistoryControllerContext(...)   ← published to context tree

GridOverlays.svelte
  ├── getHistoryControllerContext()      ← reads the shared instance
  ├── onUndo callback  → history.undo() + changes.update()
  ├── onRedo callback  → history.redo() + changes.update()
  ├── onPaste callback → history.recordBatch()
  └── FloatingEditor onSave → history.record()

DataController.svelte
  └── getHistoryControllerContext()      ← same shared instance
      ├── commitChanges()  → (no history call — by design)
      ├── discardChanges() → history.clearCommitted(changesToRevert)
      ├── view change      → history.clear()
      └── search/filter    → history.clear()
      └── $effect cleanup  → history.clear()
```

### Data Flow: Single Edit

```
User presses Enter in FloatingEditor
  → edit.save(assets) returns { id, key, oldValue, newValue }
  → FloatingEditor.onSave callback fires (passed from GridOverlays)
  → history.record(id, key, oldValue, newValue)    ← stores pre-edit original
  → changes.update({ id, key, oldValue, newValue }) ← marks cell dirty/valid
```

### Data Flow: Ctrl+Z

```
User presses Ctrl+Z
  → interactionHandler.handleKeyDown detects Ctrl+Z (not inside input/textarea)
  → callbacks.onUndo() fires (defined in GridOverlays)
  → history.undo(dataCtx.assets)
      ├── pops batch from undoStack
      ├── calls revert(batch, assets) — sets asset[key] = oldValue in place
      └── pushes batch to redoStack
  → for each action in batch:
      changes.update({ id, key, newValue: action.oldValue, oldValue: action.newValue })
  → [GAP] no scrollToRow set → off-screen cells are NOT scrolled into view
```

### Data Flow: Ctrl+Y

```
User presses Ctrl+Y
  → callbacks.onRedo() fires
  → history.redo(dataCtx.assets)
      ├── pops batch from redoStack
      ├── re-applies all actions: asset[key] = newValue
      └── pushes batch to undoStack
  → for each action in batch:
      changes.update(action)
  → [GAP] no scrollToRow set
```

### Data Flow: Paste (multi-cell)

```
User presses Ctrl+V
  → clipboard.paste(target, assets, keys) returns { changes: HistoryAction[] }
  → history.recordBatch(result.changes)   ← one stack entry for all pasted cells
  → for each change: changes.update(change) ← marks all cells dirty
```

---

## Existing Implementation: What Is Correct

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Ctrl+Z triggers undo | Correct | `interactionHandler.ts:72-75` |
| Ctrl+Y triggers redo | Correct | `interactionHandler.ts:78-81` |
| Paste is one undo entry | Correct | `history.recordBatch()` in `GridOverlays.svelte:67` |
| Single edit is one undo entry | Correct | `history.record()` in `GridOverlays.svelte:331` |
| Cell-focus grouping (pre-edit original) | Correct | `edit.save()` returns `editOriginalValue`, not per-keystroke value |
| Redo stack cleared on new edit | Correct | `history.record()` calls `redoStack = []` |
| No toolbar buttons | Correct | Keyboard-only via `interactionHandler` |
| History in-memory only | Correct | Pure `$state`, no sessionStorage |
| Clears on view change | Correct | `DataController.svelte:234` |
| Clears on search/filter | Correct | `DataController.svelte:272` |
| Clears on component unmount | Correct | `$effect` cleanup at `DataController.svelte:603` |
| Commits do NOT clear history | Correct | `commitChanges()` has no `history.*` call — matches locked decision |
| Discard uses `clearCommitted` | Correct | `discardChanges()` calls `history.clearCommitted(changesToRevert):569` |
| Undo updates dirty-cell overlays | Correct | `changes.update()` updates `changeCtx.hasUnsavedChanges` and `dirtyCells` |
| History controller shared instance | Correct | Created in `GridContextProvider`, retrieved via context in both consumers |

---

## Gaps Against Spec

### Gap 1: Auto-scroll after undo/redo (MISSING)

**Spec says:** "Auto-scroll to the affected cell if it's off-screen"

**Current code** (`GridOverlays.svelte` lines 72-95):
```typescript
get onUndo() {
  return () => {
    const batch = history.undo(dataCtx.assets);
    if (batch) {
      for (const action of batch) {
        changes.update({ id: action.id, key: action.key, newValue: action.oldValue, oldValue: action.newValue });
      }
      // ← NO scrollToRow, NO selection.selectCell()
    }
  };
},
```

**Fix needed:** After undo/redo, locate the first affected cell's row/col and set `viewCtx.scrollToRow`. For multi-cell batches (paste undo), scroll to the first cell in the batch.

The scroll mechanism already exists: `viewCtx.scrollToRow = row` triggers `GridContainer.svelte`'s `$effect` which calls `virtualScroll.ensureVisible(row)`.

To find row/col from a `HistoryAction`:
- `row`: `dataCtx.assets.findIndex(a => a.id === action.id)`
- `col`: `colCtx.keys.indexOf(action.key)`

### Gap 2: No `selection.selectCell()` on undo/redo (MINOR — Excel UX)

**Excel behavior:** After Ctrl+Z, the affected cell becomes the active selection. The current code reverts the value and updates overlays, but does not move the selection cursor.

**Fix needed:** After computing row/col for scroll, also call `selection.moveTo(row, col)`. For multi-cell batches, move to the first cell in the batch.

Note: `selection` is not directly accessible in the `callbacks` object in `GridOverlays` — but `selection` IS created in `GridOverlays` script scope and used in other callbacks. The `onScrollIntoView` callback pattern is already wired — this just needs a direct `selection.moveTo()` call.

### Gap 3: `F8.4` requirement says "history cleared after successful commit" — conflicts with locked decision

**REQUIREMENTS.md F8.4:** "History cleared after successful commit"
**CONTEXT.md locked decision:** "History persists across DB commits — critical so users can undo a mistakenly committed value"

**Resolution:** The CONTEXT.md (gathered from user discussion) supersedes REQUIREMENTS.md (earlier spec). The current `commitChanges()` correctly does NOT clear history. Phase 6 should document this explicit decision and mark F8.4 as revised. No code change needed.

---

## Standard Stack

No new libraries needed. All required primitives already exist in the project:

| Component | File | Purpose |
|-----------|------|---------|
| History controller | `frontend/src/lib/grid/utils/gridHistory.svelte.ts` | Stack management, revert, redo |
| Change controller | `frontend/src/lib/grid/utils/gridChanges.svelte.ts` | Dirty cell tracking, overlay state |
| Keyboard handler | `frontend/src/lib/utils/interaction/interactionHandler.ts` | Ctrl+Z/Y event detection |
| Shortcut attach | `frontend/src/lib/grid/utils/gridShortcuts.svelte.ts` | Svelte 5 `{@attach}` factory |
| Context provision | `frontend/src/lib/context/GridContextProvider.svelte` | Shared instance creation |
| Callbacks wiring | `frontend/src/lib/components/grid/GridOverlays.svelte` | onUndo/onRedo/onPaste |
| Commit/discard | `frontend/src/lib/components/grid/DataController.svelte` | History lifecycle on nav/discard |
| Scroll trigger | `viewCtx.scrollToRow` in `GridContextProvider` | Auto-scroll mechanism |

---

## Architecture Patterns

### Pattern: History Controller as Shared Context Instance

The controller is created ONCE in `GridContextProvider.svelte` and read by both consumers via `getHistoryControllerContext()`. This is the established Phase 4 pattern — do not change this architecture.

```typescript
// GridContextProvider.svelte (correct — do not change)
const historyController = createHistoryController();
setHistoryControllerContext(historyController);

// GridOverlays.svelte (correct — do not change)
const history = getHistoryControllerContext();

// DataController.svelte (correct — do not change)
const history = getHistoryControllerContext();
```

### Pattern: Batch is the Unit of Undo

```typescript
// Single-cell edit: batch of 1
history.record(id, key, oldValue, newValue);
// → undoStack.push([{ id, key, oldValue, newValue }])

// Multi-cell paste: batch of N
history.recordBatch(actions);
// → undoStack.push([action1, action2, ...actionN])

// Undo always pops one batch → one Ctrl+Z for paste, one for edit
```

### Pattern: Auto-scroll Via viewCtx.scrollToRow

```typescript
// Set scroll target (GridContainer watches this via $effect)
viewCtx.scrollToRow = row;

// Find row index from asset id
const row = dataCtx.assets.findIndex(a => a.id === action.id);
// Find col index from key
const col = colCtx.keys.indexOf(action.key);
```

### Pattern: Undo Updates changeContext via changes.update()

Undo does NOT directly manipulate `dirtyCells` or `hasUnsavedChanges`. It goes through `changes.update()` which handles:
- If reverted to original: removes from `dirtyChanges` map (cell becomes clean)
- If still different from original: updates `newValue` in dirty map
- Triggers reactivity on `changeCtx.hasUnsavedChanges` and `changeCtx.hasInvalidChanges`

The key inversion when calling `changes.update()` from undo:
```typescript
// On undo: action.oldValue is the target, action.newValue was the "before undo" state
changes.update({
  id: action.id,
  key: action.key,
  newValue: action.oldValue,   // ← what we're reverting TO
  oldValue: action.newValue,   // ← what it was before this undo
});

// On redo: use action as-is (newValue is what to restore)
changes.update(action);
```

This inversion is already correctly implemented in `GridOverlays.svelte`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stack data structure | Custom linked list | Plain JS array with `.push()/.pop()` | Already works; batches as array elements are sufficient |
| Scroll-to-cell | Custom scroll logic | `viewCtx.scrollToRow = row` | Triggers existing `GridContainer` `$effect` → `virtualScroll.ensureVisible()` |
| Cell coordinates from asset | Custom lookup | `dataCtx.assets.findIndex()` + `colCtx.keys.indexOf()` | O(n) is fine for typical asset counts |
| Dirty state updates | Direct `$state` mutation | `changes.update()` | Handles all dirty/invalid/reversion logic in one place |

---

## Common Pitfalls

### Pitfall 1: Calling `changes.update()` with wrong value polarity on undo

**What goes wrong:** Passing `action` directly to `changes.update()` during undo instead of inverting old/new. The dirty-cell system tracks "net change from original" — using wrong polarity means the cell stays dirty when it should become clean after an undo back to original.

**Current code correctly inverts:** `newValue: action.oldValue, oldValue: action.newValue`

**Warning sign:** Cell overlay stays yellow/green after undoing back to the original value.

### Pitfall 2: Separate history controller instances in GridOverlays vs DataController

**What goes wrong:** If `createHistoryController()` is called separately in both components, they have independent stacks. DataController's `discard` would call `clearCommitted` on an empty stack while GridOverlays' undo stack has all the entries.

**Current code correctly avoids this:** Both read from `getHistoryControllerContext()` — the same instance from `GridContextProvider`.

**Warning sign:** Undo works but Discard doesn't revert to correct baseline.

### Pitfall 3: `history.clear()` vs `history.clearCommitted()` confusion

| Method | When | Effect |
|--------|------|--------|
| `history.clear()` | View change, search, unmount | Wipes both stacks entirely |
| `history.clearCommitted(actions)` | Discard changes | Removes only specified entries; preserves unrelated history |
| _(no call)_ | After commit | History intentionally preserved per spec |

**Warning sign:** Using `history.clear()` in `discardChanges()` would wipe undo history for cells that were NOT discarded.

### Pitfall 4: Ctrl+Z fires inside FloatingEditor textarea

**What goes wrong:** `interactionHandler.handleKeyDown` has an early-return guard:
```typescript
const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
if (isInput) return;
```
Ctrl+Z inside the active textarea correctly does NOT trigger history undo — it allows the browser's native text-undo within the textarea. This is correct Excel behavior and must not be changed.

### Pitfall 5: Auto-scroll row lookup using index vs asset id

**What goes wrong:** Using `action.row` (which doesn't exist in `HistoryAction`) instead of looking up by `action.id`. After sorting or filtering, the visual row index of an asset changes — only `id` is stable.

**Correct approach:**
```typescript
const row = dataCtx.assets.findIndex(a => a.id === action.id);
if (row === -1) return; // asset not in current view (filtered out)
```

---

## Code Examples

### Current onUndo callback (GridOverlays.svelte — needs auto-scroll added)

```typescript
// Source: frontend/src/lib/components/grid/GridOverlays.svelte:72-85
get onUndo() {
  return () => {
    const batch = history.undo(dataCtx.assets);
    if (batch) {
      for (const action of batch) {
        changes.update({
          id: action.id,
          key: action.key,
          newValue: action.oldValue,
          oldValue: action.newValue,
        });
      }
      // GAP: no scroll/selection update here
    }
  };
},
```

### Fixed onUndo with auto-scroll (target implementation)

```typescript
get onUndo() {
  return () => {
    const batch = history.undo(dataCtx.assets);
    if (batch) {
      for (const action of batch) {
        changes.update({
          id: action.id,
          key: action.key,
          newValue: action.oldValue,
          oldValue: action.newValue,
        });
      }
      // Scroll to first affected cell
      const firstAction = batch[0];
      const row = dataCtx.assets.findIndex(a => a.id === firstAction.id);
      const col = colCtx.keys.indexOf(firstAction.key);
      if (row !== -1) {
        viewCtx.scrollToRow = row;
        selection.moveTo(row, col !== -1 ? col : 0);
      }
    }
  };
},
```

### Fixed onRedo with auto-scroll (target implementation)

```typescript
get onRedo() {
  return () => {
    const batch = history.redo(dataCtx.assets);
    if (batch) {
      for (const action of batch) {
        changes.update(action);
      }
      // Scroll to first affected cell
      const firstAction = batch[0];
      const row = dataCtx.assets.findIndex(a => a.id === firstAction.id);
      const col = colCtx.keys.indexOf(firstAction.key);
      if (row !== -1) {
        viewCtx.scrollToRow = row;
        selection.moveTo(row, col !== -1 ? col : 0);
      }
    }
  };
},
```

### History record from FloatingEditor save (correct — do not change)

```typescript
// Source: frontend/src/lib/components/grid/GridOverlays.svelte:330-333
{#if editCtx.isEditing}
  <FloatingEditor onSave={(change) => {
    history.record(change.id, change.key, change.oldValue, change.newValue);
    changes.update(change);
  }} />
{/if}
```

### HistoryAction type (gridHistory.svelte.ts)

```typescript
// Source: frontend/src/lib/grid/utils/gridHistory.svelte.ts:7-12
export type HistoryAction = {
  id: number | string;
  key: string;
  oldValue: string;
  newValue: string;
};
```

---

## State of the Art

| Area | Current State | Spec Requirement | Delta |
|------|--------------|------------------|-------|
| Ctrl+Z/Y wiring | Implemented | Required | None |
| Single-cell undo granularity | Implemented (pre-edit original) | Required | None |
| Paste as one undo entry | Implemented (`recordBatch`) | Required | None |
| Dirty overlay update on undo | Implemented (`changes.update`) | Required | None |
| Auto-scroll on undo/redo | **Missing** | Required | Must add `viewCtx.scrollToRow` |
| Selection cursor on undo | **Missing** | Implied by Excel UX | Should add `selection.moveTo()` |
| History persists across commit | Implemented (no `clear` in commit path) | Required | None |
| History clears on view change | Implemented | Required | None |
| History clears on discard (selective) | Implemented (`clearCommitted`) | Required | None |
| F8.4 "clears after commit" | Intentionally not implemented | SUPERSEDED by CONTEXT.md | Document decision |

---

## Open Questions

1. **Should undo/redo move the selection cursor for multi-cell batches?**
   - What we know: Spec says scroll to affected cell. Excel moves selection to first undone cell.
   - What's unclear: For a paste of 10 cells, should selection jump to first cell or show no change?
   - Recommendation: Move selection to `batch[0]` coordinates (first cell in batch). This matches Excel.

2. **What if the undone asset is not in the current filtered view?**
   - What we know: `dataCtx.assets.findIndex()` returns `-1` if asset is filtered out.
   - What's unclear: Should undo still work? (It does — `revert()` mutates `baseAssets` if the asset is there; but if the asset is filtered out, the `item` lookup in `revert()` also returns null.)
   - Recommendation: On `findIndex() === -1`, skip scroll/selection silently. The revert silently no-ops (existing behavior). This is acceptable — filtered views are an edge case.

3. **F8.4 conflict documentation**
   - What we know: REQUIREMENTS.md says "History cleared after successful commit" but CONTEXT.md (user decision) says the opposite.
   - Recommendation: Phase 6 plan should include a task to update REQUIREMENTS.md F8.4 to match the CONTEXT.md decision, and add a code comment in `commitChanges()` explaining the intentional omission.

---

## Plan Shape Recommendation

Phase 6 is small — the existing implementation is mostly correct. Two plans recommended:

**Plan 06-01: Audit and document**
- Read all 6 history call-sites and verify each matches spec
- Add inline code comment to `commitChanges()` explaining history is intentionally preserved
- Update REQUIREMENTS.md F8.4 to reflect the overriding decision from CONTEXT.md
- No functional code changes — audit only

**Plan 06-02: Auto-scroll and selection fix**
- Add `viewCtx.scrollToRow` assignment to `onUndo` callback in `GridOverlays.svelte`
- Add `viewCtx.scrollToRow` assignment to `onRedo` callback in `GridOverlays.svelte`
- Add `selection.moveTo()` call for both undo and redo
- `colCtx` is already available in `GridOverlays` script scope
- `svelte-check` must pass

---

## Sources

### Primary (HIGH confidence)
- Direct code audit of `frontend/src/lib/grid/utils/gridHistory.svelte.ts` — complete implementation review
- Direct code audit of `frontend/src/lib/components/grid/GridOverlays.svelte` — undo/redo callbacks, overlay derivations
- Direct code audit of `frontend/src/lib/components/grid/DataController.svelte` — commit/discard/clear paths
- Direct code audit of `frontend/src/lib/utils/interaction/interactionHandler.ts` — keyboard event wiring
- Direct code audit of `frontend/src/lib/context/GridContextProvider.svelte` — instance creation and sharing
- Direct code audit of `frontend/src/lib/grid/utils/gridChanges.svelte.ts` — dirty state update logic
- Direct code audit of `frontend/src/lib/grid/components/floating-editor/FloatingEditor.svelte` — save/record flow
- `.planning/phases/06-undo-redo-session-engine/06-CONTEXT.md` — locked user decisions
- `.planning/REQUIREMENTS.md` — F8.1–F8.4 requirements

### No external sources needed
This phase is entirely internal — no npm packages, no external APIs, no framework features beyond what is already in use (Svelte 5 `$state`, `$derived`, `createContext`).

---

## Metadata

**Confidence breakdown:**
- Current implementation status: HIGH — based on direct line-by-line code audit
- Gap identification: HIGH — spec vs code comparison is deterministic
- Fix approach: HIGH — scroll mechanism and selection patterns already established in codebase

**Research date:** 2026-02-26
**Valid until:** Stable — internal codebase, no external dependency churn
