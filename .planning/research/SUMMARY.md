# Research Summary: GridOverlays Decomposition

**Research date:** 2026-03-05

## Key Findings

### Stack
- Per-cell inline handlers (`onclick={() => handleClick(row, col, value)}`) are the right pattern — ~800 buttons is fine with virtual scroll limiting visible DOM
- Keyboard handler should be extracted to pure TypeScript (`keyboardHandler.ts`), wired via `svelte:window` initially with `isInputElement` guard
- Selection model: `selectedCells: GridCell[]` with `{ row, col, value }` — same shape as pending edits, border derived from min/max bounds

### Features
- All table stakes features already exist (selection, editing, clipboard, column ops, data ops)
- Keyboard handling is PARTIAL — currently requires focus on GridOverlays div
- Key differentiators not yet implemented: undo/redo, tab-to-next-cell, delete clears selection, select-all (all out of scope for this refactor but depend on the selection model being built)
- Critical dependency chain: cell-based selection → per-cell buttons → global keyboard → undo/redo

### Architecture
- Target: GridOverlays becomes purely visual (read context → render positioned divs)
- Cells own their clicks, keyboard handler is pure TS, EventListener dispatches through queue
- Suggested 3-phase refactor order: (1) Selection model + per-cell buttons, (2) Keyboard extraction, (3) GridOverlays cleanup
- Each phase must leave the grid fully working

### Watch Out For
1. **Drag selection across component boundaries** — mousedown on cell, mouseup on window (not on cells)
2. **Keyboard events in wrong context** — `isInputElement` guard on every handler when using `svelte:window`
3. **Breaking existing functionality** — don't remove old code until new code is verified; maintain functionality checklist
4. **$effect ordering** — one-way flow only (read flag → enqueue → reset flag), never write to what you read
5. **Virtual scroll + selection overlay** — continue using `virtualScrollManager.getOffsetY()` for position calculations

## Refactor Order (Dependencies)

```
Phase 1: Selection Model + Per-Cell Buttons
  ↓ (keyboard needs selection model)
Phase 2: Keyboard Handler Extraction
  ↓ (can't remove handlers until replacements work)
Phase 3: GridOverlays Cleanup
```

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Drag selection breaks | HIGH | Window-level mouseup listener |
| Keyboard fires in inputs | HIGH | isInputElement guard |
| Functionality regression | HIGH | Full checklist after each phase |
| Performance regression | LOW | Virtual scroll limits visible buttons |
| $effect cycles | MEDIUM | One-way flow pattern |

---
*Research synthesized: 2026-03-05*
