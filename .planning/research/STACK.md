# Stack Research: Svelte 5 Grid Interaction Patterns

**Research date:** 2026-03-05
**Domain:** Svelte 5 event delegation and selection models for spreadsheet-like grids

## Event Delegation Patterns in Svelte 5

### Per-Cell Click Handlers (~800 cells)

**Recommendation:** Per-cell inline handlers via `onclick={() => handleClick(row, col, value)}`
**Confidence:** HIGH

Svelte 5 uses **automatic event delegation** — `onclick` on 800 elements creates ONE root listener, not 800. The "performance concern" is a non-issue. Each cell knows its own data at render time (row ID, column key, cell value), eliminating DOM crawling.

**Pattern:**
```svelte
<!-- GridRow.svelte -->
{#each keys as key}
  <button tabindex="-1" onclick={() => onCellClick(asset.id, key, asset[key])}>
    {asset[key]}
  </button>
{/each}
```

**Why NOT event delegation on parent:**
- Requires `data-*` attributes and `closest()` crawling — the exact pattern being removed
- Svelte 5 compiles each handler efficiently; no closure performance concern at this scale
- Cell components naturally have access to their data via props/each-block scope

### Keyboard Event Handling

**Option A: `svelte:window` with onkeydown**
**Confidence:** MEDIUM — viable but needs guard logic

```svelte
<!-- EventListener.svelte -->
<svelte:window onkeydown={handleKeydown} />
```

Pros: Captures all keyboard events regardless of focus. No DOM coupling.
Cons: Must guard against firing in input/textarea elements. Must check `isInput(e.target)` to avoid interfering with text editing.

**Option B: Container-level `onkeydown` with tabindex**
**Confidence:** MEDIUM

```svelte
<div tabindex="0" onkeydown={handleKeydown}>
  <!-- grid content -->
</div>
```

Pros: Scoped to grid. No guard needed for inputs outside grid.
Cons: Requires focus management — clicks outside grid lose keyboard access.

**Option C: Pure TS handler wired to window event**
**Confidence:** HIGH for logic extraction

```typescript
// keyboardHandler.ts
export function handleKeydown(e: KeyboardEvent, contexts: { selection, editing, clipboard, ui }) {
  if (isInputElement(e.target)) return;
  // pure logic, no DOM dependencies
}
```

The handler itself should be pure TS regardless of where it's wired. The wiring location (svelte:window vs container) is a separate decision.

**Recommendation:** Extract to pure TS first. Wire via `svelte:window` initially, fall back to container if issues arise.

### Selection Model

**Recommendation:** `selectedCells: GridCell[]` where `GridCell = { row: number, col: string, value: string }`
**Confidence:** HIGH

- Selection border derives from `Math.min/max` of row indices and column indices
- Column index derived via `keys.indexOf(col)` for positioning math
- Same `{row, col}` shape as `pendingCtx` entries — eliminates translation layers
- Range selection: on shift+click, compute all cells in rectangular bounds

## What NOT to Do

1. **Don't use event delegation on a parent div** — defeats the purpose of removing DOM crawling
2. **Don't use Svelte actions for per-cell handlers** — overkill; inline handlers are simpler and sufficient
3. **Don't store selection as start/end coordinates** — cell-based set is more flexible and doesn't require DOM measurement
4. **Don't put keyboard handler in GridOverlays** — that's the god component being decomposed
5. **Don't use `$effect` for keyboard events** — keyboard events are imperative, use event handlers

## Svelte 5 APIs Used

| API | Purpose |
|-----|---------|
| `$state()` | Selection context, UI context state |
| `$derived()` | Selection bounds from cell set, overlay positions |
| `$effect()` | EventListener watching context flags |
| `$props()` | Cell data passed to GridRow |
| `createContext()` | Shared selection/editing/UI state |
| `$state.snapshot()` | Freezing data for event queue payloads |

---
*Research completed: 2026-03-05*
