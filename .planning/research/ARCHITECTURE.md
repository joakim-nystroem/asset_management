# Architecture Research: Distributed Event Ownership

**Research date:** 2026-03-05
**Domain:** Decomposing GridOverlays god component in Svelte 5

## Current Architecture (Problem)

```
GridContainer
  └── GridOverlays (GOD COMPONENT)
        ├── onkeydown (ALL keyboard events)
        ├── onmousedown/onmousemove/onmouseup (ALL mouse events)
        ├── closest('[data-row]') → DOM crawling for cell identity
        ├── Selection state management
        ├── Resize drag state
        ├── Context menu positioning
        ├── Panel open/close logic
        └── Renders 4 overlay layers:
              ├── Selection border overlay
              ├── Copy border overlay
              ├── Dirty cell overlay
              └── User cursor overlay
        └── {children(columnWidths)} → wraps entire grid
```

**Problems:**
1. Single file owns all interaction — ~800+ lines
2. DOM crawling to identify cells (`data-row`, `data-col` attributes)
3. Event handling, state management, and rendering all in one component
4. Adding new interactions means touching GridOverlays

## Target Architecture

### Component Boundaries

```
+page.svelte (seeds assetStore)
  └── GridContextProvider (creates contexts)
        └── EventListener (watches context flags, enqueues events)
              └── Toolbar
              └── GridContainer (virtual scroll)
                    ├── GridHeader (sort, resize, header menu)
                    ├── GridRow[] (per-cell buttons, cell clicks)
                    │     └── <button> per cell → writes to selectionCtx
                    ├── EditHandler (inline editor)
                    ├── GridOverlays (VISUAL ONLY)
                    │     ├── Selection border (reads selectionCtx)
                    │     ├── Copy border (reads clipboardCtx)
                    │     ├── Dirty indicators (reads pendingCtx)
                    │     └── User cursors (reads realtimeManager)
                    └── ContextMenu
```

### Data Flow

**Cell Click → Selection:**
```
GridRow button onclick
  → writes to selectionCtx.selectedCells
  → GridOverlays reads selectionCtx, renders border
```

**Keyboard Event → Action:**
```
keyboardHandler.ts (pure TS)
  → wired via svelte:window or container onkeydown
  → reads/writes contexts (selection, editing, clipboard, ui)
  → EventListener picks up context changes via $effect
  → enqueues events to queue
```

**Selection Context Shape:**
```typescript
type GridCell = { row: number, col: string, value: string };

interface SelectionContext {
  selectedCells: GridCell[];      // the actual selection
  anchorCell: GridCell | null;    // for shift+click range
  isSelecting: boolean;           // drag in progress
}
```

**Derived selection bounds (for overlay rendering):**
```typescript
const bounds = $derived(() => {
  if (!selectionCtx.selectedCells.length) return null;
  const rows = selectionCtx.selectedCells.map(c => c.row);
  const cols = selectionCtx.selectedCells.map(c => keys.indexOf(c.col));
  return {
    minRow: Math.min(...rows), maxRow: Math.max(...rows),
    minCol: Math.min(...cols), maxCol: Math.max(...cols)
  };
});
```

### Component Responsibilities After Refactor

| Component | Owns | Reads | Writes |
|-----------|------|-------|--------|
| GridRow | Cell click handlers | assetStore.filteredAssets | selectionCtx |
| keyboardHandler.ts | Keyboard logic | selectionCtx, editingCtx | selectionCtx, editingCtx, clipboardCtx, uiCtx |
| GridOverlays | Overlay rendering | selectionCtx, clipboardCtx, pendingCtx, realtime | nothing (pure visual) |
| EventListener | Event dispatching | all contexts (via $effect) | event queue |
| EditHandler | Inline editing | editingCtx, pendingCtx | editingCtx, pendingCtx |
| GridHeader | Sort, resize, header menu | assetStore | assetStore (sort), columnWidths |
| ContextMenu | Right-click actions | uiCtx | editingCtx, queryCtx |

## Suggested Refactor Order

**Phase 1: Selection Model + Per-Cell Buttons**
- Define `GridCell` type and `SelectionContext` shape
- Add per-cell `<button>` elements to GridRow with click handlers
- Write selection logic (click, shift+click, drag)
- Update GridOverlays to read new selection context for border rendering
- Remove DOM crawling from selection path

**Phase 2: Keyboard Handler Extraction**
- Extract keyboard logic to `keyboardHandler.ts` (pure TS)
- Wire into event system (investigate svelte:window vs container)
- Remove keyboard event listeners from GridOverlays
- Ensure arrow navigation, F2, escape, copy/paste signals work

**Phase 3: GridOverlays Cleanup**
- Remove all remaining event handlers from GridOverlays
- Remove state management from GridOverlays
- GridOverlays becomes purely: read context → render positioned divs
- Remove `data-row`/`data-col` attributes from DOM if no longer needed

**Dependencies:**
- Phase 1 must complete before Phase 2 (keyboard needs selection model)
- Phase 2 must complete before Phase 3 (can't remove handlers until replacements work)

---
*Research completed: 2026-03-05*
