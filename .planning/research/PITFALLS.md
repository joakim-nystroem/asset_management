# Pitfalls Research: Grid Interaction Refactor Risks

**Research date:** 2026-03-05
**Domain:** Risks when decomposing centralized event handling to distributed ownership

## Critical Pitfalls

### 1. Selection State Race Conditions

**Risk:** Multiple cells writing to `selectionCtx` simultaneously during drag operations cause inconsistent state.

**Warning signs:** Selection flickers, wrong cells highlighted, selection "jumps" during drag.

**Prevention:**
- Drag selection should compute the full cell set from anchor to current position, then write the entire set at once (not append one cell at a time)
- Use `$state.snapshot()` when passing selection to event queue
- Single writer pattern: only the click handler or keyboard handler writes to selectionCtx at any given time

**Phase:** Phase 1 (Selection Model)

### 2. Keyboard Events Firing in Wrong Context

**Risk:** If using `svelte:window`, keyboard shortcuts fire when user is typing in search bar, filter input, login form, etc.

**Warning signs:** Pressing arrow keys in search input moves grid selection. F2 in filter opens cell editor.

**Prevention:**
```typescript
function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' ||
         target.isContentEditable || target.closest('[role="dialog"]') !== null;
}
```
- Guard EVERY keyboard handler with `isInputElement` check
- Test with: search bar focused, header menu open, edit handler active, context menu open

**Phase:** Phase 2 (Keyboard Extraction)

### 3. Breaking Existing Functionality During Incremental Refactor

**Risk:** Removing event handlers from GridOverlays before replacements are fully wired causes functionality gaps (e.g., can't select cells, can't navigate with arrows).

**Warning signs:** Features work in one phase but break in the next.

**Prevention:**
- Each phase must leave the grid in a fully working state
- Don't remove old code until new code is verified working
- Maintain a functionality checklist: click select, drag select, shift+click, arrow nav, F2 edit, escape, copy, paste, context menu, column resize, sort
- Test the full checklist after each phase

**Phase:** All phases

### 4. Performance Regression from ~800 Button Elements

**Risk:** 800 `<button>` elements with individual handlers cause noticeable render time increase, especially during virtual scroll reflows.

**Warning signs:** Scroll stuttering, delayed click response, high memory usage.

**Prevention:**
- Buttons are `<button tabindex="-1">` (no tab-order overhead)
- Handlers are inline arrow functions referencing loop variables (Svelte compiles efficiently)
- Virtual scroll already limits visible DOM to ~30-50 rows — actual button count is ~400-600, not 800
- Profile with Chrome DevTools if scroll FPS drops below 30

**Phase:** Phase 1 (Per-Cell Buttons)

### 5. Lost Drag Selection Across Component Boundaries

**Risk:** Mousedown on one cell, drag across rows/columns, mouseup on another — if each cell only handles its own click, multi-cell drag selection breaks.

**Warning signs:** Can only select individual cells, not ranges via drag.

**Prevention:**
- Mousedown on a cell sets `selectionCtx.isSelecting = true` and `anchorCell`
- Mousemove on cells (while `isSelecting`) updates the selection range
- Mouseup anywhere (window-level listener) sets `isSelecting = false`
- The mouseup listener MUST be on window, not on cells — user might release outside the grid
- Consider: `onmousedown` on cell, `onmousemove` on GridContainer, `onmouseup` on window

**Phase:** Phase 1 (Selection Model)

### 6. Context Menu Positioning After GridOverlays Restructure

**Risk:** Context menu positioning relies on mouse coordinates relative to GridOverlays container. After restructure, coordinates may be wrong.

**Warning signs:** Context menu appears offset, outside viewport, or at wrong position.

**Prevention:**
- Context menu positioning should use `e.clientX`/`e.clientY` (viewport-relative), not container-relative
- ContextMenu component is rendered inside GridContainer — positioning stays relative to scroll container
- Test: right-click at top of grid, middle, bottom, after scrolling

**Phase:** Phase 3 (GridOverlays Cleanup)

### 7. Svelte 5 Reactivity Gotcha: $effect Ordering

**Risk:** Multiple `$effect` blocks reading/writing the same context can create dependency cycles or execute in unexpected order.

**Warning signs:** Infinite loops, stale values, "Maximum update depth exceeded" errors.

**Prevention:**
- Each `$effect` should have a clear trigger (one context property) and a clear action
- Never write to a context that the same `$effect` reads
- EventListener's `$effect` blocks should be one-way: read flag → enqueue → reset flag
- If two effects need to coordinate, use a single effect or explicit sequencing

**Phase:** Phase 2 (Keyboard Handler wiring)

### 8. Selection Shape Change Breaks All Consumers (col: number → col: string)

**Risk:** Changing `col` from numeric index to string key must be atomic across 5+ files. TypeScript won't catch `Array.slice(string)` or `string > 0` comparisons — they silently return wrong results.

**Warning signs:** Copy/paste returns empty arrays (`keys.slice(startCol, endCol+1)` with string args returns `[]`). Overlay positions compute as `NaN`.

**Prevention:**
- Grep for ALL uses of `col` in selection/overlay/clipboard code BEFORE changing the type
- `computeEditorPosition`, `computeVisualOverlay`, `colBounds()` all assume numeric col — must convert string keys via `keys.indexOf(col)` internally
- Copy/paste `keys.slice()` calls need index conversion
- Make this change in a single commit touching all consumers

**Phase:** Phase 1 (Selection Model)

### 9. $effect Cascade Storm with O(n) Lookups

**Risk:** Overlay derivations that call `assetIndex()` with O(n) lookup per cell cause frame drops during arrow key navigation when selection changes rapidly.

**Warning signs:** Visible lag when holding arrow key. DevTools shows long $effect execution times.

**Prevention:**
- Maintain a `Map<id, index>` for O(1) row lookups instead of `filteredAssets.findIndex()` per render
- Debounce overlay recalculation if needed, or batch selection updates

**Phase:** Phase 1 (Selection Model)

### 10. Drag Selection Must Stay at Parent Level

**Risk:** Per-cell buttons handle click/dblclick/contextmenu, but `isDragging` state must NOT be per-cell — it must stay at a parent level (GridContainer or GridOverlays).

**Warning signs:** Drag selection inconsistent, misses cells when mouse moves fast.

**Prevention:**
- `onmousedown` on cell starts drag (sets anchor + `isSelecting`)
- `onmousemove` on GridContainer (not per-cell) computes selection range from cursor position
- `onmouseup` on window ends drag
- Per-cell handlers only for: click, dblclick, contextmenu

**Phase:** Phase 1 (Selection Model)

### 11. Virtual Scroll + Selection Overlay Mismatch

**Risk:** When user scrolls, selected cells may move off-screen but selection overlay stays rendered at old positions, or overlay doesn't update with scroll offset.

**Warning signs:** Selection border floats incorrectly after scroll, or disappears when selected cells scroll out of view.

**Prevention:**
- GridOverlays already handles this — ensure the refactored version still uses `scrollTop` offset for overlay positioning
- Selection overlay should clip to visible rows and recalculate positions on scroll
- Existing `virtualScrollManager` provides `getOffsetY()` — continue using it

**Phase:** Phase 3 (GridOverlays Cleanup)

---
*Research completed: 2026-03-05*
