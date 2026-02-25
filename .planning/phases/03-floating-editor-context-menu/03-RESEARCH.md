# Phase 3: FloatingEditor & ContextMenu - Research

**Researched:** 2026-02-25
**Domain:** Svelte 5 component extraction, overlay positioning, context-driven edit lifecycle
**Confidence:** HIGH (all findings from direct codebase inspection; no external library research required)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**FloatingEditor placement — inside GridOverlay (Layer 2)**
- FloatingEditor lives inside GridOverlay (the interaction overlay, Layer 2 of the two-layer cake)
- GridOverlay is inside the `virtual-chunk` div that does `transform: translateY(offsetY)` — FloatingEditor automatically shifts with scroll
- Positioned absolutely at cell-relative coordinates (row × rowHeight gives Y offset; column offset gives X)
- No need to account for viewport scroll position — the translateY takes care of it
- Unmounts when no cell is in edit mode (`$derived` conditional render off `ctx.activeEdit`)
- Roadmap says "outside GridContainer" — this referred to the old architecture where GridContainer meant everything. In the new model, GridOverlay IS the correct layer.

**FloatingEditor edit lifecycle**
- Mounting: FloatingEditor renders only when `ctx.activeEdit !== null` — the overlay conditionally includes it
- Saving: Dispatches save via a context callback (Fast Lane → syncQueue `LOCAL_COMMIT_EDIT` event)
- Cancelling: Escape key triggers cancel via context callback — clears `ctx.activeEdit` without committing
- Local typing: Stays in Fast Lane (synchronous, no queue) — drafts update local state only
- Blur behavior: Claude's discretion — whether blur triggers save or cancel depends on the cell type

**Sub-component routing inside FloatingEditor**
- FloatingEditor reads `ctx.activeEdit.cellType` (or equivalent) to decide which editor to render
- Three modes: `textarea` (free-text), `EditDropdown` (enum/select), `Autocomplete` (foreign-key lookup)
- Sub-components are conditionally rendered inside FloatingEditor — not swapped via prop
- FloatingEditor owns the positioning wrapper; the active sub-component fills it

**GridRow cleanup**
- Remove all inline textarea/editor markup from GridRow.svelte
- GridRow becomes pure display: renders cell `<div>` elements with `data-row`, `data-col`, display text
- Zero event listeners on GridRow or its cells — event delegation on the data-layer wrapper handles all clicks

**ContextMenu — escape hatch, already in +page.svelte**
- ContextMenu is already in `+page.svelte` template, rendered as a `position: fixed` escape hatch (per Spelunker model and Phase 2)
- Phase 3 scope: verify it reads `ctx.contextMenuTarget` directly from context and self-positions when set
- If it currently receives props instead of reading context, refactor to be self-contained
- No new ContextMenu features — just ensure it's architecturally clean

**syncQueue — NOT introduced in Phase 3**
- The dual-track event engine (syncQueue.svelte.ts) is still deferred to Phase 4
- Phase 3 commit path calls the API directly (existing pattern) — syncQueue wraps it in Phase 4
- FloatingEditor's save callback follows the existing commit mechanism

### Claude's Discretion
- Exact coordinates calculation for positioning FloatingEditor within GridOverlay
- Blur-triggers-save vs blur-triggers-cancel decision per cell type
- Animation/transition on FloatingEditor mount/unmount (or none)
- How `ctx.activeEdit` is structured (coords + cellType + initialValue, or similar)

### Deferred Ideas (OUT OF SCOPE)
- syncQueue wrapping FloatingEditor commits — Phase 4. Phase 3 uses direct API call; Phase 4 migrates to queue.
- Optimistic UI + rollback on failed commit — Phase 5 (Undo/Redo Engine).
- Multiplayer typing indicators in GridOverlay — Phase 7 (WebSocket Delta Sync).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| F3.1 | `<FloatingEditor>` must live outside the grid DOM hierarchy | CONTEXT.md resolves this: "outside grid DOM hierarchy" means outside GridRow/data-layer, not outside GridContainer. FloatingEditor lives in GridOverlay (Layer 2). Both layers are siblings inside the same translateY-shifted chunk — no overflow clipping affects overlays. |
| F3.2 | It reads active cell coordinates from context and positions itself absolutely | Edit state (editRow, editCol, editKey) already exists in GridContext. Positioning formula: Y = rows.getOffsetY(editRow) - virtualScroll.getOffsetY(rows) (row position relative to the visible window top); X = sum of column widths 0..editCol-1. |
| F3.3 | When no cell is active in edit mode, FloatingEditor unmounts/hides itself | `{#if ctx.isEditing}<FloatingEditor />{/if}` in GridOverlays template — simple conditional render. |
| F3.4 | FloatingEditor handles all keyboard events (Enter/Escape/Tab), dropdown, and autocomplete | All keyboard handling currently in GridRow.svelte textarea onkeydown. Move verbatim into FloatingEditor. Sub-components (EditDropdown, Autocomplete) already exist as standalone components that accept controller instances. |
| F3.5 | FloatingEditor dispatches save/cancel events consumed by InventoryGrid | Save/cancel wired via `ctx.pageActions.onSaveEdit` and `ctx.pageActions.onCancelEdit` — already in context. FloatingEditor calls these directly. No new context fields needed. |
</phase_requirements>

---

## Summary

Phase 3 is a focused extraction task. The inline editor currently lives entirely inside `GridRow.svelte` — about 120 lines of textarea markup plus EditDropdown and Autocomplete sub-components. All the business logic (startEdit, save, cancel, validation, dropdown show/hide) lives in `+page.svelte` functions (`handleEditAction`, `saveEdit`, `cancelEdit`) already wired into `ctx.pageActions`. The goal is to lift the textarea and its sub-components out of GridRow into a new `FloatingEditor.svelte` that lives in GridOverlay and positions itself from context state.

The key insight from reading the actual code: the edit state (`ctx.isEditing`, `ctx.editRow`, `ctx.editCol`, `ctx.editKey`, `ctx.inputValue`) and the save/cancel callbacks (`ctx.pageActions.onSaveEdit`, `ctx.pageActions.onCancelEdit`) are already fully in context. FloatingEditor needs zero new context fields to operate — it reads what's already there. The positioning math is straightforward: compute pixel offsets from `editRow`/`editCol` using the same `rows.getOffsetY()` and `columns.getWidth()` formulas that GridOverlays already uses for selection overlays.

The ContextMenu audit reveals it currently receives 6 props from `+page.svelte` (state, onEdit, onCopy, onPaste, onFilterByValue, onDelete, showDelete). It does NOT read context directly. Phase 3 must make it self-contained: move `onEdit`/`onCopy`/`onPaste`/`onFilterByValue`/`onDelete` logic into the component (reading from `ctx.pageActions` and `ctx.contextMenu`), reducing props to zero or one (`showDelete` computed internally from `ctx.contextMenu.row >= ctx.filteredAssetsCount`).

**Primary recommendation:** Create `FloatingEditor.svelte` + `floatingEditor.svelte.ts` in `lib/grid/components/floating-editor/`. Mount in GridOverlays template behind `{#if ctx.isEditing}`. Refactor ContextMenu to be self-contained (reads ctx directly). Strip GridRow to pure display.

---

## Standard Stack

### Core (already installed — no new dependencies)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Svelte 5 | 5.49.1 | `$state`, `$derived`, `$effect`, `createContext` | Installed |
| SvelteKit | current | Route framework | Installed |

No new npm packages needed. Phase 3 is pure component restructuring within the existing stack.

---

## Architecture Patterns

### Current Architecture (as-built after Phase 2)

```
+page.svelte                          (context owner, 1203 lines)
├── setGridContext(ctx)               (sync, before effects)
├── ctx.pageActions = { onSaveEdit, onCancelEdit, onEditAction, ... }
├── ctx.editDropdown = editDropdown   (createEditDropdown instance)
├── ctx.autocomplete = autocomplete   (createAutocomplete instance)
├── ctx.contextMenu = contextMenu     (ContextMenuState instance)
├── handleEditAction()                (validates, calls edit.startEdit)
├── saveEdit()                        (calls edit.save, records history)
├── cancelEdit()                      (calls edit.cancel)
├── <Toolbar />
├── <GridContainer assets={...} />
│   └── (internal) virtual-chunk div [translateY]
│       ├── <GridOverlays />          (Layer 2 — overlays only, no editor)
│       └── {#each visibleData}
│           └── <GridRow />           (has inline textarea, EditDropdown, Autocomplete)
└── <ContextMenu state={contextMenu}  (receives 6 props from page)
    onEdit={handleEditAction}
    onCopy={handleCopy}
    ... />
```

### Target Architecture (after Phase 3)

```
+page.svelte                          (context owner — same logic, unchanged)
├── ctx.pageActions = { onSaveEdit, onCancelEdit, ... }  (unchanged)
├── <Toolbar />
├── <GridContainer assets={...} />
│   └── virtual-chunk div [translateY]
│       ├── <GridOverlays />
│       │   ├── selection/copy/dirty overlays (unchanged)
│       │   └── {#if ctx.isEditing}
│       │       └── <FloatingEditor />   (NEW — positioned by ctx.editRow/editCol)
│       └── {#each visibleData}
│           └── <GridRow />             (display only — zero editor markup)
└── <ContextMenu />                     (self-contained — reads ctx directly, zero props)
```

### Pattern 1: FloatingEditor Positioning Within GridOverlay

**What:** FloatingEditor is `position: absolute` within the GridOverlay div. GridOverlay has `class="contents"` (no layout box), so FloatingEditor positions relative to the translated virtual-chunk wrapper — the same ancestor that positions all other overlays.

**The coordinate math:**

```typescript
// Source: derived from virtualScrollManager.svelte.ts + gridRows.svelte.ts + gridColumns.svelte.ts
// Both already used by GridOverlays for selection overlay positioning

// Y position: absolute distance from the top of the virtual-chunk origin
// rows.getOffsetY(editRow) gives cumulative row heights from row 0 to editRow
// virtualScroll.getOffsetY(rows) gives the translateY offset applied to the chunk
// The chunk's transform shifts the visible window, so row N's visual position
// relative to the chunk origin is: rows.getOffsetY(N) - virtualScroll.getOffsetY(rows)
// But since FloatingEditor is INSIDE the translated chunk, translateY is already applied.
// Therefore: top = rows.getOffsetY(editRow) - virtualScroll.getOffsetY(rows)
//
// Simpler view: same formula as selection overlay top calculation.
// selectionOverlay.top is already computed this way in GridOverlays.

// X position: sum of column widths for columns 0..editCol-1
function getEditorLeft(editCol: number, keys: string[], columns: ColumnController): number {
  let left = 0;
  for (let i = 0; i < editCol; i++) {
    left += columns.getWidth(keys[i]);
  }
  return left;
}

// Width: the current (possibly expanded) column width
function getEditorWidth(editKey: string, columns: ColumnController): number {
  return columns.getWidth(editKey);
}

// Height: the current row height (may expand for multiline textarea)
function getEditorHeight(editRow: number, rows: RowController): number {
  return rows.getHeight(editRow);
}
```

**Confirmed by:** GridOverlays.svelte already computes `selectionOverlay.top/left/width/height` using the exact same `computeVisualOverlay()` method which calls `rows.getOffsetY` and `columns.getWidth`. FloatingEditor uses the same formula directly (or via a helper in `floatingEditor.svelte.ts`).

**Key verification:** `computeVisualOverlay` in `gridSelection.svelte.ts` already handles the visible-range offset math. The FloatingEditor can either call the same helper or derive its own simpler version since it only needs to position a single cell, not a range.

### Pattern 2: FloatingEditor Sub-Component Routing

**What:** FloatingEditor reads `ctx.editDropdown.isVisible` to determine which mode is active.

```svelte
<!-- Source: derived from existing GridRow.svelte edit block -->
<!-- FloatingEditor.svelte -->
<script lang="ts">
  import { getGridContext } from '$lib/context/gridContext.svelte.ts';
  import { createEditController } from '$lib/grid/utils/gridEdit.svelte.ts';
  import { createRowController } from '$lib/grid/utils/gridRows.svelte.ts';
  import { createColumnController } from '$lib/grid/utils/gridColumns.svelte.ts';
  import EditDropdownComponent from '$lib/grid/components/edit-dropdown/editDropdown.svelte';
  import AutocompleteComponent from '$lib/grid/components/suggestion-menu/autocomplete.svelte';

  const ctx = getGridContext();
  const edit = createEditController();
  const rows = createRowController();
  const columns = createColumnController();

  // Positioning — recomputed reactively when editRow/editCol changes
  const editorStyle = $derived.by(() => {
    if (!ctx.isEditing) return '';
    const top = computeTop(ctx.editRow, rows);
    const left = computeLeft(ctx.editCol, ctx.keys, columns);
    const width = columns.getWidth(ctx.editKey ?? '');
    const height = rows.getHeight(ctx.editRow);
    return `top:${top}px; left:${left}px; width:${width}px; height:${height}px;`;
  });
</script>

<!-- Positioned within GridOverlay's translated chunk -->
<div class="absolute z-[100]" style={editorStyle}>
  <textarea
    bind:value={ctx.inputValue}
    ...keyboard handlers (moved verbatim from GridRow)...
  />
  <EditDropdownComponent
    dropdown={ctx.editDropdown}
    onSelect={(value) => { ctx.inputValue = value; ctx.editDropdown?.hide(); ctx.pageActions?.onSaveEdit(value); }}
  />
  <AutocompleteComponent
    autocomplete={ctx.autocomplete}
    onSelect={(value) => { ctx.inputValue = value; ctx.autocomplete?.clear(); ctx.pageActions?.onSaveEdit(value); }}
  />
</div>
```

**Key finding:** `ctx.editDropdown` and `ctx.autocomplete` are already in context (set in +page.svelte lines 128-130). FloatingEditor does NOT receive them as props — it reads them from context. The sub-components (`EditDropdownComponent`, `AutocompleteComponent`) accept the controller instances as props from FloatingEditor.

### Pattern 3: Self-Contained ContextMenu

**Current state (confirmed by code inspection):**
- `contextMenu.svelte` receives 6 props: `state`, `onEdit`, `onCopy`, `onPaste`, `onFilterByValue`, `onDelete`, `showDelete`
- `ContextMenuState` (contextMenu.svelte.ts) is already in `ctx.contextMenu`
- The action handlers (`onEdit`, `onCopy`, etc.) map directly to `ctx.pageActions` callbacks
- `showDelete` is computed as `contextMenu.row >= filteredAssets.length` — expressible as `ctx.contextMenu.row >= ctx.filteredAssetsCount`

**Target:** ContextMenu reads ctx directly, zero props:

```svelte
<!-- Source: pattern derived from GridOverlays (0 props, reads ctx directly) -->
<script lang="ts">
  import { getGridContext } from '$lib/context/gridContext.svelte.ts';
  const ctx = getGridContext();
  // All actions via ctx.pageActions; all state via ctx.contextMenu
  const showDelete = $derived(
    (ctx.contextMenu?.row ?? -1) >= ctx.filteredAssetsCount
  );
</script>

{#if ctx.contextMenu?.visible}
  <div class="fixed z-[60] ..." style="top: {ctx.contextMenu.y}px; left: {ctx.contextMenu.x}px;">
    <button onclick={() => ctx.pageActions?.onEditAction('ctx', ctx.contextMenu!.row, ctx.contextMenu!.col)}>Edit</button>
    <button onclick={() => ctx.pageActions?.onCopy()}>Copy</button>
    ...
  </div>
{/if}
```

**Implication for +page.svelte:** The `<ContextMenu ... />` element in +page.svelte template simplifies from 7 attributes to zero. The component becomes self-positioning and self-acting.

### Pattern 4: GridRow as Pure Display Component

**Current state (confirmed — GridRow.svelte is 235 lines, ~120 lines are editor markup):**
- Props: 11 (asset, keys, actualIndex, user, editDropdown, autocomplete, assets, onSaveEdit, onCancelEdit, onEditAction, onContextMenu, visibleIndex)
- Has: inline textarea, EditDropdownComponent, AutocompleteComponent mounts, $effect for focus, textareaRef $state, onkeydown handler (~70 lines), oninput handler, onblur handler
- Has: onmousedown, ondblclick, onmouseenter, oncontextmenu per cell

**After Phase 3 (target):**
- Props: asset, keys, actualIndex (3 data props — satisfies F2.5 already satisfied, maintains pattern)
- Remove: editDropdown, autocomplete, assets, onSaveEdit, onCancelEdit, onEditAction, onContextMenu, visibleIndex props
- Remove: all editor markup (textarea block, EditDropdown, Autocomplete, ~120 lines)
- Remove: textareaRef $state and $effect for focus
- Remove: per-cell event listeners (onmousedown, ondblclick, onmouseenter, oncontextmenu) — event delegation on data-layer wrapper handles all these
- Keep: the `{#each keys}` loop rendering cell divs with `data-row`, `data-col` attributes and display span

**CRITICAL FINDING — event delegation gap:** GridContainer's data-layer wrapper currently has an `onclick` handler that reads `dataset.row/col` but does NOT call any action (the comment says "selection handled by selectionController reading ctx" but no actual handler is called). The `ondblclick` (start edit) and `onmouseenter` (extend selection) handlers are ONLY on GridRow cells. Removing them from GridRow without adding delegation handlers to the wrapper would break double-click to edit and drag selection.

**Resolution for planner:** Phase 3 must add proper delegation handlers to GridContainer's data-layer wrapper div:
- `ondblclick` → delegate to `ctx.pageActions.onEditAction`
- `onmouseenter` → delegate to selection.extendSelection (via ctx or direct call)
- `onmousedown` (existing) → wire to selection.handleMouseDown
- `oncontextmenu` → already delegated to `onContextMenu` prop (correct)

### Anti-Patterns to Avoid

- **Passing editDropdown/autocomplete as props to FloatingEditor.** Both are already in `ctx.editDropdown` and `ctx.autocomplete`. FloatingEditor reads them from context.
- **Computing editor position relative to the scroll container viewport.** The translateY chunk is the positioning ancestor, not the scroll container. Position math is relative to the chunk origin (row 0), not the visible viewport.
- **Forgetting the `textareaRef` focus effect.** Currently GridRow has a `$effect` that focuses and selects the textarea when `ctx.isEditing && ctx.editRow === actualIndex`. This effect must move into FloatingEditor (which is only mounted when editing — so a simpler `$effect(() => { textareaRef?.focus(); textareaRef?.select(); })` works on mount).
- **Not calling `edit.updateRowHeight(textareaRef)` in FloatingEditor's oninput.** This is how the row expands for long text — must be preserved.
- **Making ContextMenu too autonomous.** The delete-new-row logic in `+page.svelte` (`handleDeleteNewRow`) uses `filteredAssets.length` local variable — this must be translated to use `ctx.filteredAssetsCount` which is already synced to context.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column X offset | Manual pixel calculation loop | `createColumnController().getWidth()` loop | Already used by GridOverlays for overlay positioning |
| Row Y offset | Manual cumulative sum | `createRowController().getOffsetY(row)` | Already exists, accounts for custom row heights |
| Visible window offset | Manual scrollTop math | `virtualScroll.getOffsetY(rows)` | Already the source of truth for translateY |
| Dropdown display logic | New state | `ctx.editDropdown` (already created, in context) | Fully implemented, just needs new consumer |
| Autocomplete state | New state | `ctx.autocomplete` (already in context) | Fully implemented |
| Edit start/cancel/save | New business logic | `ctx.pageActions.onSaveEdit/onCancelEdit/onEditAction` | Already wired through context from +page.svelte |
| Cell type detection | New field | `ctx.editDropdown.isVisible` after `handleEditAction` sets it | editDropdown.show() already called for constrained columns |

---

## Common Pitfalls

### Pitfall 1: Position Relative to Wrong Ancestor

**What goes wrong:** FloatingEditor positioned relative to the scroll viewport instead of the translateY chunk. Result: editor appears at correct position initially but jumps as user scrolls.

**Why it happens:** `position: absolute` resolves to the nearest positioned ancestor. GridOverlay has `class="contents"` — it contributes no layout box. The actual positioned ancestor is the virtual-chunk div (`position: absolute; top: 8 [header]; transform: translateY(...)`).

**How to avoid:** FloatingEditor's `top` value must be `rows.getOffsetY(editRow) - virtualScroll.getOffsetY(rows)` — the row's absolute position minus the chunk's translateY offset. This gives the row's Y position relative to the chunk's top edge. Since the chunk itself is already translated, the absolute positioning within it gives the correct screen position automatically.

**Warning signs:** Editor appears correct at scroll position 0 but shifts when scrolled. Verify by checking that the formula matches `selectionOverlay.top` for the same row.

### Pitfall 2: Blur Event Fires When Clicking Sub-Components

**What goes wrong:** User clicks a dropdown option. Textarea fires `onblur` before the dropdown's `onmousedown` fires. The `onblur` handler calls `saveEdit()` with the old `ctx.inputValue` (before the dropdown selection updates it). Result: wrong value saved.

**Why it happens:** DOM event order — blur fires synchronously when focus leaves, `mousedown` fires slightly after. The `setTimeout(() => { if (ctx.isEditing) onSaveEdit(); }, 0)` pattern in current GridRow.svelte handles this correctly by deferring to the next tick.

**How to avoid:** Keep the `setTimeout` pattern in FloatingEditor's onblur — it gives dropdown `onmousedown` (with `e.preventDefault()` to steal focus-back) time to update `ctx.inputValue` first.

**Warning signs:** Values don't save when clicking dropdown options. Check that EditDropdown and Autocomplete cells use `onmousedown` with `e.preventDefault()`.

### Pitfall 3: Focus Lost After FloatingEditor Mounts

**What goes wrong:** FloatingEditor mounts (because `ctx.isEditing` becomes true) but textarea never gets focus. User types and nothing happens.

**Why it happens:** In the old code, GridRow had a `$effect` watching `ctx.isEditing && ctx.editRow === actualIndex`. Now FloatingEditor IS the thing that exists only when editing, so the effect can be simpler — but it still must exist.

**How to avoid:** In `floatingEditor.svelte.ts` or the component's `<script>`, add:
```typescript
let textareaRef: HTMLTextAreaElement | null = $state(null);
$effect(() => {
  if (textareaRef) {
    edit.updateRowHeight(textareaRef);
    textareaRef.focus();
    textareaRef.select();
  }
});
```
The dependency on `textareaRef` means this fires when the textarea binds (on mount). Runs once per edit session.

### Pitfall 4: GridContainer Data-Layer onClick/ondblclick Gap

**What goes wrong:** After removing event listeners from GridRow cells, double-clicking a cell does nothing. Drag selection stops working.

**Why it happens:** The current GridContainer `onclick` handler (line 81-88) reads dataset row/col but doesn't call any action. Selection is not actually wired there — it relies on GridRow's `onmousedown` calling `selection.handleMouseDown`. Removing GridRow handlers without replacing them at the delegation level breaks these interactions.

**How to avoid:** The planner must explicitly add to GridContainer's data-layer wrapper:
- `onmousedown` → `selection.handleMouseDown(row, col, e)` (or dispatch via ctx.pageActions)
- `ondblclick` → `ctx.pageActions.onEditAction('dblclick', row, col)`
- `onmouseenter` → `selection.extendSelection(row, col)` (only when dragging)

GridContainer already imports `createSelectionController`, so this is straightforward.

**Warning signs:** Clicking cells does not select them. Double-clicking does not start editing. Cell range selection (drag) does not work.

### Pitfall 5: ContextMenu onEditAction Receives Wrong Target

**What goes wrong:** After making ContextMenu self-contained, clicking "Edit" in the context menu uses `ctx.selectionStart` (selection anchor) instead of `ctx.contextMenu.row/col` (right-click target).

**Why it happens:** The existing `getActionTarget()` function in +page.svelte correctly prefers `contextMenu.visible ? contextMenu.row/col : selection.anchor`. When the action moves into ContextMenu, the component must replicate this priority logic.

**How to avoid:** In the self-contained ContextMenu, call `ctx.pageActions?.onEditAction('ctx', ctx.contextMenu!.row, ctx.contextMenu!.col)` directly — the component KNOWS it's the context menu, so it always uses its own row/col rather than the fallback. The `getActionTarget()` fallback is only needed for keyboard shortcuts, which stay in GridOverlays/+page.svelte.

---

## Code Examples

Verified patterns from existing codebase:

### Computing FloatingEditor Position (matches GridOverlays overlay math)

```typescript
// Source: derived from GridOverlays.svelte computeVisualOverlay usage
// The selection overlay top/left calculation uses the same inputs

// In floatingEditor.svelte.ts or as $derived in FloatingEditor.svelte:
function computeEditorPosition(
  editRow: number,
  editCol: number,
  editKey: string,
  keys: string[],
  rows: RowController,
  columns: ColumnController,
  virtualScroll: VirtualScrollManager
) {
  // Y: row's cumulative offset from chunk top, minus the chunk's translateY shift
  // rows.getOffsetY(N) = sum of heights[0..N-1]
  // virtualScroll.getOffsetY(rows) = rows.getOffsetY(visibleRange.startIndex)
  const chunkOriginY = virtualScroll.getOffsetY(rows);
  const rowAbsoluteY = rows.getOffsetY(editRow);
  const top = rowAbsoluteY - chunkOriginY;

  // X: sum of column widths for columns before editCol
  let left = 0;
  for (let i = 0; i < editCol; i++) {
    left += columns.getWidth(keys[i]);
  }

  const width = columns.getWidth(editKey);
  const height = rows.getHeight(editRow);

  return { top, left, width, height };
}
```

### GridRow After Extraction (pure display, ~25 lines)

```svelte
<!-- Source: GridRow.svelte (current) — stripped to display-only -->
<script lang="ts">
  import { getGridContext } from '$lib/context/gridContext.svelte.ts';
  import { createColumnController } from '$lib/grid/utils/gridColumns.svelte.ts';

  const ctx = getGridContext();
  const columns = createColumnController();

  type Props = {
    asset: Record<string, any>;
    keys: string[];
    actualIndex: number;
  };
  let { asset, keys, actualIndex }: Props = $props();
</script>

{#each keys as key, j}
  <div
    data-row={actualIndex}
    data-col={j}
    class="h-full flex items-center text-xs px-2 cursor-cell
           text-neutral-700 dark:text-neutral-200
           border-r border-neutral-200 dark:border-slate-700 last:border-r-0
           hover:bg-blue-100 dark:hover:bg-slate-600"
    style="width: {columns.getWidth(key)}px; min-width: {columns.getWidth(key)}px;"
  >
    <span class="truncate w-full">{asset[key]}</span>
  </div>
{/each}
```

### FloatingEditor Mounting in GridOverlays

```svelte
<!-- Source: pattern from GridOverlays.svelte conditional rendering -->
<!-- Add inside GridOverlays.svelte template, inside the root div -->
{#if ctx.isEditing}
  <FloatingEditor />
{/if}
```

### Self-Contained ContextMenu (zero props)

```svelte
<!-- Source: +page.svelte lines 1194-1202 (current prop-based) — refactored -->
<script lang="ts">
  import { getGridContext } from '$lib/context/gridContext.svelte.ts';
  const ctx = getGridContext();
  const showDelete = $derived(
    (ctx.contextMenu?.row ?? -1) >= ctx.filteredAssetsCount
  );
</script>

{#if ctx.contextMenu?.visible}
  <div class="fixed z-[60] ..." style="top:{ctx.contextMenu.y}px; left:{ctx.contextMenu.x}px;">
    <button onclick={() => ctx.pageActions?.onEditAction('ctx', ctx.contextMenu!.row, ctx.contextMenu!.col)}>Edit</button>
    <button onclick={() => ctx.pageActions?.onCopy()}>Copy</button>
    <button onclick={() => ctx.pageActions?.onPaste()}>Paste</button>
    <button onclick={handleFilterByValue}>Filter</button>
    {#if showDelete}
      <button onclick={handleDeleteNewRow}>Delete Row</button>
    {/if}
  </div>
{/if}
```

---

## Critical Findings (Planner Must Address)

### Finding 1: ContextMenu Is NOT Self-Contained Yet

**Evidence:** `contextMenu.svelte` line 14: `let { state, onEdit, onCopy, onPaste, onFilterByValue, onDelete, showDelete }: Props = $props()` — receives 7 props including all action callbacks.

**Required work:** Full prop-to-context refactor. The handlers `handleFilterByValue` and `handleDeleteNewRow` from +page.svelte must move into contextMenu.svelte (or its .svelte.ts). These handlers use `ctx.contextMenu.key/value/row`, `ctx.filteredAssetsCount`, `ctx.pageActions`, and `ctx.assets` — all available in context.

**Complexity:** Low-medium. No logic changes — just moving existing code to a new location.

### Finding 2: GridRow Has 11 Props, Many Must Be Removed

**Evidence:** GridRow.svelte Props type lists: asset, keys, actualIndex, user, editDropdown, autocomplete, assets, onSaveEdit, onCancelEdit, onEditAction, onContextMenu, visibleIndex.

**After Phase 3:** Remove editDropdown, autocomplete, assets, onSaveEdit, onCancelEdit, onEditAction, onContextMenu, visibleIndex. Keep asset, keys, actualIndex. The `user` prop is used only for the "Log in to edit" toast guard in the ondblclick handler — with event delegation on the wrapper, the dblclick handler moves to GridContainer, which already has access to `ctx.pageActions.user`.

**GridContainer must be updated:** When removing `onContextMenu` prop from GridRow, GridContainer's own `oncontextmenu` delegation (already on the wrapper) must be confirmed to handle the row/col lookup correctly. GridContainer currently passes `onContextMenu` down to GridRow as a prop — after Phase 3, the wrapper's own `oncontextmenu` handler fires instead. GridContainer already has this handler (lines 89-95), so the prop chain is eliminated.

### Finding 3: FloatingEditor Parent Is GridOverlays, Not GridContainer

**Evidence:** GridOverlays.svelte template wraps its content in a `class="contents"` div — no layout box. All overlays inside are positioned relative to the virtual-chunk div (GridContainer's absolutepositioned inner wrapper). FloatingEditor must be added inside GridOverlays, not GridContainer directly.

**The virtual-chunk div** (GridContainer.svelte line 104-106):
```
<div class="absolute top-8 w-full" style="transform: translateY({virtualScroll.getOffsetY(rows)}px);">
  <GridOverlays />        ← FloatingEditor goes here (inside GridOverlays)
  {#each visibleData ...} ← GridRow renders here
```

FloatingEditor inside GridOverlays is positioned relative to the chunk origin. When chunk translates, FloatingEditor moves with it — correct behavior, no extra scroll compensation needed.

### Finding 4: ctx.activeEdit Does Not Exist — Use Existing Edit Fields

**Evidence:** GridContext type has no `activeEdit` field. What exists:
- `ctx.isEditing: boolean`
- `ctx.editRow: number`
- `ctx.editCol: number`
- `ctx.editKey: string | null`
- `ctx.editOriginalValue: string`
- `ctx.inputValue: string`
- `ctx.editDropdown: EditDropdown | null`
- `ctx.autocomplete: Autocomplete | null`

**CONTEXT.md references `ctx.activeEdit`** but this is architectural shorthand from planning, not an actual field. The planner should NOT add a new `activeEdit` field — the existing flat fields cover everything FloatingEditor needs. The cell type routing (textarea vs dropdown vs autocomplete) is determined by `ctx.editDropdown.isVisible` after `handleEditAction` calls `editDropdown.show()` for constrained columns.

### Finding 5: handleEditAction Called from Three Sites

**Evidence from +page.svelte:**
1. `ctx.pageActions.onEditAction = (_action, _row, _col) => { handleEditAction(); }` — ignores action/row/col parameters! Uses `getActionTarget()` internally.
2. GridRow `ondblclick` calls `onEditAction()` (no args)
3. Keyboard F2 calls `onEditAction` via ctx.pageActions

**Problem:** `handleEditAction()` uses `getActionTarget()` which checks `contextMenu.visible ? contextMenu.row/col : selection.anchor`. After Phase 3, when ContextMenu triggers an edit, it must pass row/col explicitly (since ContextMenu no longer goes through the prop chain). The `onEditAction` signature currently ignores its parameters.

**Resolution:** The planner should update `ctx.pageActions.onEditAction` to actually use its `row`/`col` parameters, or add a separate direct path. The cleanest fix: make `handleEditAction(row: number, col: number)` accept explicit coords, update all call sites.

---

## File Inventory (Current vs Target)

### Files to CREATE
| File | Contents |
|------|----------|
| `frontend/src/lib/grid/components/floating-editor/FloatingEditor.svelte` | Textarea + sub-components, positioning wrapper |
| `frontend/src/lib/grid/components/floating-editor/floatingEditor.svelte.ts` | Position computation, focus effect, keyboard handler logic |

### Files to MODIFY
| File | Changes |
|------|---------|
| `frontend/src/lib/grid/components/context-menu/contextMenu.svelte` | Remove all props; add `getGridContext()` call; inline action handlers |
| `frontend/src/lib/grid/components/context-menu/contextMenu.svelte.ts` | Minor (may move handleFilterByValue/handleDeleteNewRow logic here) |
| `frontend/src/lib/components/grid/GridOverlays.svelte` | Add `import FloatingEditor` + `{#if ctx.isEditing}<FloatingEditor />{/if}` |
| `frontend/src/lib/components/grid/GridRow.svelte` | Strip to ~25 lines: remove editor markup, most props, all event listeners |
| `frontend/src/lib/components/grid/GridContainer.svelte` | Add ondblclick + onmousedown + onmouseenter delegation handlers; remove GridRow event props |
| `frontend/src/routes/+page.svelte` | Remove ContextMenu props (simplify to `<ContextMenu />`); update handleEditAction to accept row/col params |

### Files UNCHANGED
| File | Reason |
|------|--------|
| `frontend/src/lib/context/gridContext.svelte.ts` | All needed state already exists; no new fields required |
| `frontend/src/lib/grid/utils/gridEdit.svelte.ts` | No changes to edit lifecycle logic |
| `frontend/src/lib/grid/components/edit-dropdown/editDropdown.svelte` | No changes — FloatingEditor becomes the new consumer |
| `frontend/src/lib/grid/components/suggestion-menu/autocomplete.svelte` | No changes |
| `frontend/src/lib/grid/utils/gridColumns.svelte.ts` | No changes |
| `frontend/src/lib/grid/utils/gridRows.svelte.ts` | No changes |
| `frontend/src/lib/grid/utils/virtualScrollManager.svelte.ts` | No changes |

---

## State of the Art

| Old Approach | Current Approach | Phase 3 Target |
|--------------|------------------|----------------|
| Editor inline in GridRow (per-row DOM) | Editor inline in GridRow (still per-row) | Single FloatingEditor in overlay (one instance) |
| ContextMenu with 7 props | ContextMenu with 7 props | ContextMenu with 0 props (reads context) |
| GridRow: 11 props, 235 lines | Same (unchanged in Phase 2) | GridRow: 3 props, ~25 lines |
| Event listeners per cell (~11 per row × visible rows) | Same | All delegated to wrapper (~3 permanent) |

---

## Open Questions

1. **handleEditAction row/col parameter gap**
   - What we know: `ctx.pageActions.onEditAction` ignores its row/col params; uses `getActionTarget()` internally
   - What's unclear: How ContextMenu (self-contained) should trigger edit — it can't call `getActionTarget()` since that's in +page.svelte scope
   - Recommendation: Update `handleEditAction` signature to accept optional explicit `(row, col)` params. When called from ContextMenu, pass explicit coords. When called from keyboard/dblclick delegation, use selection anchor.

2. **Tab key in FloatingEditor**
   - What we know: Tab is handled in autocomplete dropdown (advances to next suggestion) but not as a cell-advance shortcut in GridRow
   - What's unclear: Should Tab advance to the next cell (Excel-like) in Phase 3, or remain only for autocomplete?
   - Recommendation: Preserve existing Tab behavior (autocomplete nav only). Cell navigation via Tab is not in the current GridRow code — don't add it in Phase 3.

3. **onmousedown save-on-click-new-cell in GridRow**
   - What we know: GridRow currently has `onmousedown` that calls `onSaveEdit()` before moving selection when `ctx.isEditing`
   - What's unclear: After event delegation, does GridContainer's onmousedown fire on the same click that would save? Could there be a conflict with the textarea's onblur (which also saves)?
   - Recommendation: The textarea onblur with setTimeout handles save-on-click-away correctly. GridContainer's onmousedown can skip the `ctx.isEditing` check and just handle selection. The blur+setTimeout pattern already serializes correctly.

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all listed files — all findings verified against actual source
- `GridRow.svelte` — editor markup, props, event handlers (lines 1-235)
- `GridOverlays.svelte` — overlay positioning math, $derived patterns (lines 1-248)
- `gridContext.svelte.ts` — all context fields confirmed present (lines 1-83)
- `gridEdit.svelte.ts` — startEdit/save/cancel/isEditingCell (lines 1-95)
- `contextMenu.svelte` + `contextMenu.svelte.ts` — prop structure, ContextMenuState (confirmed prop-based, not context-based)
- `GridContainer.svelte` — data-layer wrapper, current delegation gap (lines 1-148)
- `+page.svelte` — handleEditAction, saveEdit, cancelEdit, ctx.pageActions wiring (lines 1-1203)
- `virtualScrollManager.svelte.ts` — getOffsetY, visibleRange (lines 1-187)
- `gridRows.svelte.ts` — getOffsetY, getHeight (lines 1-83)
- `gridColumns.svelte.ts` — getWidth (lines 1-85)
- `editDropdown.svelte.ts` + `editDropdown.svelte` — API and rendering
- `autocomplete.svelte.ts` + `autocomplete.svelte` — API and rendering

### Secondary (MEDIUM confidence)
- Phase 2 CONTEXT.md + VERIFICATION.md — architectural decisions confirmed built as described
- STATE.md — phase completion status, key decisions log

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all patterns from existing code
- Architecture: HIGH — all component relationships verified by direct code reading
- Pitfalls: HIGH — all pitfalls derived from actual code patterns (blur/mousedown race, translateY ancestor, delegation gap)
- Positioning math: HIGH — formula matches existing `computeVisualOverlay` usage in GridOverlays

**Research date:** 2026-02-25
**Valid until:** This research is codebase-specific. Valid until any of the referenced files change. Stable for 30+ days if no Phase 2 files are modified.
