# Phase 1: Grid Fixes - Research

**Researched:** 2026-03-04
**Domain:** Svelte 5 drag-to-resize interaction, SvelteMap reactivity, module constants consolidation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Resize interaction:**
- Live drag resize — writing to `colWidthCtx.widths` SvelteMap on mousemove, readers react via Svelte reactivity
- Drag handler lives in **GridOverlays** (owns all user interactions) — detects mousedown on resize handle via data attribute, manages mousemove/mouseup lifecycle
- GridHeader resize handle div is visual target only — no interaction logic

**Double-click behavior:**
- Keep current behavior — double-click deletes the width entry, resetting to 150px default

**Default widths:**
- Uniform 150px default for all columns — no per-column map needed
- Consolidate `DEFAULT_WIDTH` (and future constants like `ROW_HEIGHT`) into a new `gridConfig.ts` module with plain exported constants
- All 4 consumers import from `gridConfig.ts` instead of defining their own local `DEFAULT_WIDTH = 150`

### Claude's Discretion
- Minimum column width during drag
- Visual feedback during drag (cursor, handle highlight)
- Resize handle hit-target width

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GRID-01 | Column widths from ColumnWidthContext are applied in GridHeader column rendering | GridHeader already reads `colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH` correctly. The missing piece is the drag write path. Once drag writes to the SvelteMap, existing reactive bindings update automatically. |
| GRID-02 | Column widths from ColumnWidthContext are applied in GridRow cell rendering | GridRow already reads `colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH` correctly. SvelteMap reactivity propagates writes from the drag handler to GridRow bindings automatically. |
</phase_requirements>

---

## Summary

Phase 1 is purely additive: the width-reading infrastructure already exists and works correctly across all four consumers (GridHeader, GridRow, GridOverlays, editHandler.svelte.ts). Every consumer uses the pattern `colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH` to style width. The only missing piece is a write path — drag-to-resize — that sets widths into the SvelteMap.

The implementation has two tasks: (1) add a `gridConfig.ts` constants module and update the four `DEFAULT_WIDTH = 150` local declarations to import from it, and (2) implement drag-to-resize in GridOverlays, which owns all user interactions. GridHeader's resize handle `<div>` is already rendered and handles stopPropagation and double-click reset — it just needs a `data-resize-handle` attribute so GridOverlays can identify mousedown events on it.

Because `colWidthCtx.widths` is a `SvelteMap<string, number>`, writing `.set(key, newWidth)` on mousemove is sufficient to trigger reactive updates in all consumers. No `$effect` wrappers, no additional derivations, and no changes to GridRow or editHandler are required.

**Primary recommendation:** Implement in two sequential tasks — Task 1: create `gridConfig.ts` and migrate imports. Task 2: add drag-to-resize in GridOverlays.

---

## Standard Stack

### Core (already in use — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Svelte 5 `$state` | 5.49.1 | Reactive state for context objects | Project standard |
| `SvelteMap` from `svelte/reactivity` | 5.49.1 | Reactive Map that triggers updates on `.set()`/`.delete()` | Already used for `colWidthCtx.widths` |
| TypeScript | project version | Type safety for drag state | Project standard |

No new packages required. This phase is pure TypeScript/Svelte within the existing stack.

### Installation
```bash
# No new packages needed
```

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
frontend/src/lib/grid/
├── gridConfig.ts                    # NEW: shared constants module
├── components/
│   ├── grid-header/GridHeader.svelte   # MODIFY: add data-resize-handle attr
│   ├── grid-overlays/GridOverlays.svelte  # MODIFY: add drag-to-resize
│   ├── grid-row/GridRow.svelte         # MODIFY: import from gridConfig
│   └── edit-handler/editHandler.svelte.ts  # MODIFY: import from gridConfig
```

### Pattern 1: gridConfig.ts — Shared Constants Module

**What:** A plain TypeScript module exporting named constants used across grid components.
**When to use:** Any value that is duplicated across 2+ files.
**Example:**
```typescript
// frontend/src/lib/grid/gridConfig.ts
export const DEFAULT_WIDTH = 150;
export const ROW_HEIGHT = 36; // placeholder for future use
```

**Migration — each consumer replaces:**
```typescript
// Before (in GridHeader, GridRow, GridOverlays, editHandler.svelte.ts):
const DEFAULT_WIDTH = 150;

// After:
import { DEFAULT_WIDTH } from '$lib/grid/gridConfig';
```

### Pattern 2: Drag-to-Resize in GridOverlays

**What:** Mouse event lifecycle (mousedown → mousemove → mouseup) owned entirely by GridOverlays. GridHeader's resize handle is a passive visual target identified by `data-resize-handle` attribute.

**When to use:** Any drag interaction in the grid. GridOverlays owns all mouse input per architecture.

**Drag state (local to GridOverlays — not in context):**
```typescript
// Local $state — not shared, no context needed
let resizeDrag = $state<{
  key: string;
  startX: number;
  startWidth: number;
} | null>(null);
```

**mousedown handler — detect resize handle:**
```typescript
function handleMouseDown(e: MouseEvent) {
  // Check for resize handle first (before any other mousedown logic)
  const handle = (e.target as HTMLElement).closest('[data-resize-handle]') as HTMLElement | null;
  if (handle) {
    const key = handle.dataset.resizeHandle!;
    const startWidth = colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH;
    resizeDrag = { key, startX: e.clientX, startWidth };
    e.preventDefault(); // prevent text selection during drag
    e.stopPropagation();
    return;
  }

  // ... existing header and cell mousedown logic unchanged ...
}
```

**Window-level mousemove/mouseup — add to existing $effect:**
```typescript
// Inside the existing $effect that registers window.addEventListener('mouseup', ...) and window.addEventListener('click', ...)
function onMouseMove(e: MouseEvent) {
  if (!resizeDrag) return;
  const delta = e.clientX - resizeDrag.startX;
  const newWidth = Math.max(MIN_COLUMN_WIDTH, resizeDrag.startWidth + delta);
  colWidthCtx.widths.set(resizeDrag.key, newWidth);
}

function onMouseUp() {
  endSelection();        // existing
  resizeDrag = null;     // end resize if active
}

window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onMouseUp);
// cleanup: remove both listeners in return function
```

**GridHeader resize handle — add data attribute only:**
```svelte
<!-- GridHeader.svelte line 62-69: add data-resize-handle={key} -->
<div
  class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 z-50"
  data-resize-handle={key}
  onclick={(e) => e.stopPropagation()}
  ondblclick={(e) => {
    e.stopPropagation();
    colWidthCtx.widths.delete(key);
  }}
></div>
```

Note: `onclick` and `ondblclick` remain in GridHeader because they are passive event suppression and reset (no interaction logic, just stopPropagation and the already-approved double-click reset). The actual resize drag logic is in GridOverlays.

### Pattern 3: SvelteMap Reactivity for Width Propagation

**What:** Writing `colWidthCtx.widths.set(key, newWidth)` during drag is sufficient to reactively update all four consumers. No `$effect`, no additional signals needed.

**Why it works:** `SvelteMap` from `svelte/reactivity` is a reactive proxy. Mutations (`.set()`, `.delete()`) are tracked by Svelte's fine-grained reactivity. Template bindings like `style="width: {colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH}px"` re-evaluate when the map changes.

**Confirmed:** `SvelteMap` is already used in this project for `colWidthCtx.widths` (initialized in GridContextProvider) and for `rowCtx.rowHeights`. The `.delete(key)` double-click reset in GridHeader already works via this mechanism.

### Anti-Patterns to Avoid

- **Don't put drag state in context.** Resize drag is transient, local to GridOverlays. There is no reason for other components to read it.
- **Don't add interaction logic to GridHeader.** The architecture decision is clear: GridHeader owns visual rendering; GridOverlays owns all interaction. Adding mousemove/mouseup to GridHeader would violate the ownership model.
- **Don't use `$effect` to propagate width changes.** Direct `.set()` on SvelteMap is reactive. An `$effect` wrapper would add unnecessary indirection.
- **Don't throttle mousemove artificially.** Live drag resize (every mousemove event) is the locked decision. The browser handles frame pacing naturally.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive width propagation | Custom event bus / store subscription | `SvelteMap.set()` — already reactive | SvelteMap is purpose-built for this; all consumers already use it |
| Constant sharing | Config context / store | Plain TypeScript module with `export const` | No reactivity needed for static constants; module import is simpler and cheaper |
| Drag state management | Complex state machine | Three local `$state` fields (key, startX, startWidth) + null check | The drag lifecycle is simple: start on mousedown, update on mousemove, end on mouseup |

---

## Common Pitfalls

### Pitfall 1: Forgetting `e.preventDefault()` on Mousedown During Resize

**What goes wrong:** Without `preventDefault()` on the resize handle mousedown, the browser initiates text selection as the user drags. The grid content gets highlighted, which is disruptive and interferes with the drag visual.

**Why it happens:** Drag operations on non-draggable elements trigger the browser's default text-selection behavior.

**How to avoid:** Call `e.preventDefault()` in the mousedown handler when a resize is starting, before setting `resizeDrag` state.

**Warning signs:** Text in grid cells becomes selected during column resize drag.

### Pitfall 2: mousemove Registered Without mousemove Cleanup

**What goes wrong:** If the window-level `mousemove` listener is added inside the existing `$effect` but not removed in the cleanup return function, it leaks. The handler fires after the component unmounts, causing errors.

**Why it happens:** The existing `$effect` already registers `mouseup` and `click` on the window and removes them in the cleanup return. Adding `mousemove` to the effect body without adding it to the cleanup will cause the leak.

**How to avoid:** The cleanup `return () => { ... }` in the `$effect` must remove all three listeners: `mouseup`, `click`, and `mousemove`.

### Pitfall 3: Resize Drag Intercepting Cell Click/Selection

**What goes wrong:** The `handleMouseDown` handler in GridOverlays currently runs cell-selection logic for any mousedown. If the resize handle check is not the first branch (before the cell check), a mousedown on the handle could also trigger cell selection.

**Why it happens:** The resize handle `<div>` is inside a header column `<div>` (`[data-header-col]`). The current code returns early for `[data-header-col]` on line 293. However, the resize check must still come first, or the `return` from the header check will swallow resize events.

**How to avoid:** In the revised `handleMouseDown`, check for `[data-resize-handle]` before checking for `[data-header-col]`. The resize check should be the very first branch.

**Warning signs:** Clicking a resize handle also selects a header column (both behaviors fire).

### Pitfall 4: Minimum Width Not Enforced

**What goes wrong:** Without a minimum width clamp, the user can drag a column to 0px or negative width. This breaks the layout — cells become invisible, overlays misalign, and the editor positions incorrectly.

**Why it happens:** `Math.max` is not applied to the computed width.

**How to avoid:** Define `MIN_COLUMN_WIDTH` in `gridConfig.ts` (e.g., `50`) and apply `Math.max(MIN_COLUMN_WIDTH, startWidth + delta)` in the mousemove handler. This is a Claude's discretion item — a value of 50px is reasonable.

### Pitfall 5: Double-Click Still Works on Existing GridHeader Handle

**What goes wrong:** The existing `ondblclick` handler on the resize `<div>` in GridHeader calls `colWidthCtx.widths.delete(key)` to reset. After adding `data-resize-handle`, it is possible that the GridOverlays window click handler (`onWindowClick`) fires after the double-click and inadvertently opens the header menu.

**Why it happens:** Double-click triggers two `click` events. The `onWindowClick` logic checks for `[data-header-col]` and opens the menu. The resize handle `<div>` is inside `[data-header-col]`.

**How to avoid:** The resize handle already calls `onclick={(e) => e.stopPropagation()}`, which stops the click from bubbling to the `[data-header-col]` handler. Verify this remains intact after the refactor.

---

## Code Examples

### gridConfig.ts (complete new file)

```typescript
// frontend/src/lib/grid/gridConfig.ts
// Shared constants for the grid. Import these instead of defining local copies.

/** Default column width in pixels when no explicit width is set in ColumnWidthContext. */
export const DEFAULT_WIDTH = 150;

/** Minimum column width in pixels during drag-to-resize. */
export const MIN_COLUMN_WIDTH = 50;
```

### GridOverlays.svelte — resize additions (diff summary)

```typescript
// 1. Import from gridConfig instead of local const
import { DEFAULT_WIDTH, MIN_COLUMN_WIDTH } from '$lib/grid/gridConfig';
// Remove: const DEFAULT_WIDTH = 150;

// 2. Add local drag state (near other local UI state, line ~31)
let resizeDrag = $state<{ key: string; startX: number; startWidth: number } | null>(null);

// 3. New first branch in handleMouseDown
function handleMouseDown(e: MouseEvent) {
  // Resize handle check — must come first
  const handle = (e.target as HTMLElement).closest('[data-resize-handle]') as HTMLElement | null;
  if (handle) {
    const key = handle.dataset.resizeHandle!;
    resizeDrag = {
      key,
      startX: e.clientX,
      startWidth: colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH,
    };
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  // ... existing header col check and cell check unchanged ...
}

// 4. In the existing $effect — add mousemove listener and update onMouseUp
$effect(() => {
  function onMouseMove(e: MouseEvent) {
    if (!resizeDrag) return;
    const delta = e.clientX - resizeDrag.startX;
    const newWidth = Math.max(MIN_COLUMN_WIDTH, resizeDrag.startWidth + delta);
    colWidthCtx.widths.set(resizeDrag.key, newWidth);
  }

  function onMouseUp() {
    endSelection();
    resizeDrag = null;
  }

  function onWindowClick(e: MouseEvent) {
    // ... existing logic unchanged ...
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('click', onWindowClick);
  return () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('click', onWindowClick);
  };
});
```

### GridHeader.svelte — add data attribute only

```svelte
<!-- Line 62-69: only change is adding data-resize-handle={key} -->
<div
  class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 z-50"
  data-resize-handle={key}
  onclick={(e) => e.stopPropagation()}
  ondblclick={(e) => {
    e.stopPropagation();
    colWidthCtx.widths.delete(key);
  }}
></div>
```

### Consumer import migration (all four files)

```typescript
// GridHeader.svelte, GridRow.svelte, GridOverlays.svelte: replace local const
import { DEFAULT_WIDTH } from '$lib/grid/gridConfig';
// Remove: const DEFAULT_WIDTH = 150;

// editHandler.svelte.ts: replace local const
import { DEFAULT_WIDTH } from '$lib/grid/gridConfig';
// Remove: const DEFAULT_WIDTH = 150;
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `DEFAULT_WIDTH = 150` duplicated in 4 files | Single `gridConfig.ts` export | Single source of truth; change propagates everywhere |
| No drag-to-resize (widths only settable programmatically) | Drag handle in GridHeader, drag logic in GridOverlays | Fulfills GRID-01 and GRID-02 requirements |

---

## Open Questions

1. **Cursor style during drag**
   - What we know: The resize handle already has `cursor-col-resize` class. During drag, the cursor may revert to default when the mouse moves off the handle.
   - What's unclear: Whether to apply a global cursor override to `document.body` during drag.
   - Recommendation (Claude's discretion): Apply `document.body.style.cursor = 'col-resize'` on drag start and restore it (`document.body.style.cursor = ''`) on drag end. This prevents cursor flicker as the mouse moves between columns. Low complexity, high UX value.

2. **Handle highlight during drag**
   - What we know: `hover:bg-blue-400` provides passive highlight. Active drag has no persistent highlight.
   - What's unclear: Whether to add a class during drag to keep the handle highlighted.
   - Recommendation (Claude's discretion): Add a CSS class (e.g., `bg-blue-400`) to the active handle during drag via a local `$derived` checking `resizeDrag?.key === key`. Adds clarity to the active resize column.

---

## Sources

### Primary (HIGH confidence)

- Direct code reading of project source files — all findings are from the actual codebase, not external docs
  - `GridHeader.svelte` — existing resize handle structure (lines 59-69)
  - `GridRow.svelte` — existing width consumption pattern (line 26)
  - `GridOverlays.svelte` — existing mousedown handler (lines 290-308), $effect window listener pattern (lines 354-392)
  - `editHandler.svelte.ts` — existing DEFAULT_WIDTH usage (line 4)
  - `gridContext.svelte.ts` — SvelteMap type for ColumnWidthContext (line 107)
  - `GridContextProvider.svelte` — SvelteMap initialization (lines 106-109)
- `01-CONTEXT.md` — all locked decisions verified against code

### Secondary (MEDIUM confidence)

- Svelte 5 SvelteMap reactivity behavior — inferred from existing double-click reset (`.delete()`) already working reactively in GridHeader, confirmed by project memory noting `SvelteMap` is reactive for `.set()`/`.delete()`.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all existing patterns confirmed in source
- Architecture: HIGH — all integration points read directly from source code; patterns verified against CONTEXT.md locked decisions
- Pitfalls: HIGH — derived directly from reading the actual handler code and event lifecycle

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable codebase; no external dependencies)
