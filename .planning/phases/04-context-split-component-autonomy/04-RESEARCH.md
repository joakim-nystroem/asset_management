# Phase 4: Context Split & Component Autonomy — Research

**Researched:** 2026-02-26
**Domain:** Svelte 5 multi-context architecture, component decomposition, event delegation
**Confidence:** HIGH — all findings drawn directly from the existing codebase + confirmed Svelte 5 docs in project memory

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Split the monolithic `GridContext` into ~10 separate contexts, one per controller domain
- Each context gets its own `createContext<T>()` call returning `[get*Context, set*Context]`
- Contexts are pure type + `createContext()` — no logic, no defaults, no factories
- All contexts defined in `gridContext.svelte.ts` (or renamed to `contexts.svelte.ts`)
- `+page.svelte` receives route data via `$props()`, calls `set*Context($state({...}))` for each domain, renders children — target: well under 100 lines (requirement: < 60 lines)
- No business logic, no controllers, no effects, no callback props in `+page.svelte`
- Each component is a self-contained plugin: delete it, app still works minus that feature
- Controller logic (.svelte.ts files) lives inside the component that owns that domain
- Components don't know about each other — they only know about context
- GridContainer handles cell-level events by reading/writing context directly (no callback props)
- Create renderless `DataController.svelte` — owns URL-driven search, fetch/filter, commit, discard, addRows
- `pageActions` callback pattern eliminated — components write to context directly
- Fix 3 diagnosed bugs: contextmenu preventDefault, onmouseenter→onmouseover, text-xs class

### Claude's Discretion
- "If a component NEEDS 100 props to function then we give it 100 props" — props are fine when necessary
- Additional UI contexts as needed (contextMenu, headerMenu, filterPanel, editDropdown, autocomplete)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within scope of architecture realignment and bug fixes.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| F1.1 | Split into ~10 separate domain contexts using `createContext<T>()` returning `[getter, setter]` tuples | Context field audit (below) maps exact groupings |
| F1.2 | No module-level singleton imports inside grid components | All singletons already replaced in Phase 1; pattern is already `getGridContext()` — must remain |
| F1.3 | Export typed `[get*Context, set*Context]` pairs for each domain | `createContext` from `svelte` returns typed tuple — installed 5.49.1 |
| F1.4 | Contexts are pure type + `createContext()` — no logic/defaults | Architecture principle; pattern confirmed in codebase |
| F1.5 | `+page.svelte` calls `set*Context($state({...}))` for each domain | The only valid init point — must be synchronous before any `$effect` |
| F2.1 | `+page.svelte` < 60 lines: set contexts, render children, done | Currently 1,199 lines — DataController extracts ~400 lines |
| F2.2 | Each component independently deletable | Litmus test: delete FloatingEditor → grid still works |
| F2.3 | GridContainer renders only visible rows, ignorant of editors/menus | Already true; must stay that way after prop removal |
| F2.4 | Controller logic lives inside owning component | gridEdit moves into FloatingEditor, gridSelection into GridContainer, etc. |
| F2.5 | No `pageActions` callbacks — direct context writes | FloatingEditor.save() writes to editingContext directly |
| F2.6 | Renderless `DataController.svelte` owns URL search, commit, discard, addRows | ~400 lines of page logic migrate here |
| F2.7 | Props for parent data; context for sibling/descendant shared state | GridContainer drops onContextMenu/onHeaderClick props — reads context instead |
| F3.1–F3.5 | FloatingEditor reads editingContext, handles all keyboard events, saves/cancels by writing context directly | Already mounted in GridOverlays; needs pageActions eliminated |
| F4.1–F4.3 | ContextMenu reads contextMenuContext, independent command dispatcher | Already zero-prop; handleDeleteNewRow must not delegate to pageActions |
</phase_requirements>

---

## Summary

The monolithic `GridContext` in `gridContext.svelte.ts` contains 80+ fields across 10 conceptual domains, all bundled in a single `[getGridContext, setGridContext]` pair. The goal is to split this into ~10 typed domain contexts, reduce `+page.svelte` from 1,199 lines to < 60, and move all controller instantiation and business logic into the components that own those domains.

The architectural pivot is conceptually clean but mechanically large: every component that calls `getGridContext()` must be audited for which fields it reads, those fields must be reassigned to the appropriate new context, and the component must switch to calling `get*Context()` for each domain it needs. The creation order matters — contexts must be set before any child component mounts and reads them.

Three diagnosed bugs have clear, surgical fixes: `onmouseenter` → `onmouseover` in GridContainer (one line), `e.preventDefault()` moved to the oncontextmenu handler before the `closest()` lookup (three lines), and `text-xs` added to the FloatingEditor textarea (one word). These can be applied in the first plan task before any refactoring begins.

**Primary recommendation:** Fix bugs first (surgical, < 5 lines total), then split contexts bottom-up (leaf components before parents), then migrate DataController, then rewrite +page.svelte last when all context setters are established.

---

## Existing Codebase Map

### Current GridContext Fields — Domain Assignment

This is the authoritative field inventory from `gridContext.svelte.ts` (83 lines), annotated with which new context each field belongs to:

| Field | Current Type | New Context |
|-------|-------------|-------------|
| `isEditing` | `boolean` | `editingContext` |
| `editKey` | `string \| null` | `editingContext` |
| `editRow` | `number` | `editingContext` |
| `editCol` | `number` | `editingContext` |
| `editOriginalValue` | `string` | `editingContext` |
| `editOriginalColumnWidth` | `number` | `editingContext` |
| `inputValue` | `string` | `editingContext` |
| `selectionStart` | `GridCell` | `selectionContext` |
| `selectionEnd` | `GridCell` | `selectionContext` |
| `isSelecting` | `boolean` | `selectionContext` |
| `isHiddenAfterCopy` | `boolean` | `selectionContext` |
| `dirtyCells` | `Set<string>` | `selectionContext` |
| `copyStart` | `GridCell` | `clipboardContext` |
| `copyEnd` | `GridCell` | `clipboardContext` |
| `isCopyVisible` | `boolean` | `clipboardContext` |
| `hasUnsavedChanges` | `boolean` | `changeContext` |
| `hasInvalidChanges` | `boolean` | `changeContext` |
| `validationConstraints` | `ValidationConstraints` | `validationContext` |
| `columnWidths` | `SvelteMap<string, number>` | `columnContext` |
| `resizingColumn` | `string \| null` | `columnContext` |
| `keys` | `string[]` | `columnContext` |
| `rowHeights` | `SvelteMap<number, number>` | `rowContext` |
| `sortKey` | `string \| null` | `sortContext` |
| `sortDirection` | `'asc' \| 'desc' \| null` | `sortContext` |
| `activeView` | `string` | `viewContext` |
| `filteredAssetsCount` | `number` | `dataContext` |
| `virtualScroll` | `any` | `viewContext` |
| `scrollToRow` | `number \| null` | `viewContext` |
| `assets` | `Record<string, any>[]` | `dataContext` |
| `baseAssets` | `Record<string, any>[]` | `dataContext` |
| `filterPanel` | `FilterPanelState \| null` | `uiContext` |
| `pageActions` | `{ ... } \| null` | **ELIMINATED** |
| `editDropdown` | `ReturnType<...> \| null` | `editingContext` (or `uiContext`) |
| `autocomplete` | `ReturnType<...> \| null` | `editingContext` (or `uiContext`) |
| `headerMenu` | `any \| null` | `uiContext` |
| `applySort` | `((key, dir) => void) \| null` | **ELIMINATED** (DataController writes sortContext directly) |
| `handleFilterSelect` | `((item, key) => void) \| null` | **ELIMINATED** (DataController owns filter URL logic) |
| `contextMenu` | `any \| null` | `contextMenuContext` |

### Consumer Map — What Each Component Reads

**`+page.svelte`** (1,199 lines — becomes < 60):
- Reads: everything (initializer — sets all contexts)
- Writes: all contexts via `set*Context($state({...}))`
- After: only calls `set*Context`, renders `<DataController>` + `<Toolbar>` + `<GridContainer>` + `<ContextMenu>`

**`GridContainer.svelte`** (183 lines):
- Reads: `ctx.virtualScroll`, `ctx.scrollToRow`, `ctx.keys`, `ctx.headerMenu`, `ctx.sortKey`, `ctx.sortDirection`, `ctx.applySort`, `ctx.handleFilterSelect`, `ctx.baseAssets`, `ctx.isEditing`, `ctx.pageActions`, `ctx.filteredAssetsCount`
- After: reads from `viewContext`, `columnContext`, `dataContext`, `sortContext`, `uiContext`, `editingContext`
- Drops: `onHeaderClick`, `onContextMenu`, `onCloseContextMenu` props — handles inline via context
- Keeps: `assets` prop (passed from DataController up through page)

**`GridOverlays.svelte`** (254 lines):
- Reads: `ctx.contextMenu`, `ctx.headerMenu`, `ctx.virtualScroll`, `ctx.keys`, `ctx.assets`, `ctx.filteredAssetsCount`, `ctx.isEditing`, `ctx.selectionStart`, `ctx.isHiddenAfterCopy`, `ctx.pageActions` (for shortcuts callbacks)
- Controllers created: `selection`, `columns`, `changes`, `rowGen`
- After: reads from `contextMenuContext`, `uiContext`, `viewContext`, `columnContext`, `dataContext`, `editingContext`, `selectionContext`
- Key change: `callbacks` object no longer reads from `ctx.pageActions` — directly invokes context writes

**`FloatingEditor.svelte`** (174 lines):
- Reads: `ctx.isEditing`, `ctx.editKey`, `ctx.editRow`, `ctx.editCol`, `ctx.keys`, `ctx.inputValue`, `ctx.autocomplete`, `ctx.editDropdown`, `ctx.pageActions` (onSaveEdit, onCancelEdit)
- Controllers: `edit`, `rows`, `columns`
- After: reads from `editingContext`, `columnContext`, `rowContext`, `viewContext`
- Key change: `pageActions?.onSaveEdit` → writes directly to `editingContext` + calls `edit.save()`; `pageActions?.onCancelEdit` → calls `edit.cancel()` directly

**`ContextMenu.svelte`** (via `contextMenu.svelte.ts`):
- Reads: `ctx.contextMenu`, `ctx.pageActions` (onDeleteNewRow), `ctx.handleFilterSelect`
- After: reads from `contextMenuContext`, `dataContext`
- Key change: `handleDeleteNewRow` must own rowGen via `rowContext` instead of delegating to `pageActions`

**`Toolbar.svelte`**:
- Currently receives: `user`, `getCurrentUrlState`, `updateSearchUrl`, callbacks for commit/discard/addRows/viewChange/navigateError
- After: reads from `dataContext`, `changeContext`, `viewContext`; onCommit/onDiscard/onAddRows move to DataController

**`GridRow.svelte`** (pure display — 3 props):
- Already stripped in Phase 3. No context reads. No changes needed.

**`GridHeader.svelte`**:
- Receives keys + callbacks. Minimal context dependency.

---

## Architecture Patterns

### Pattern 1: Multiple Small Contexts (Locked Decision)

Each domain gets its own typed context. The file `gridContext.svelte.ts` exports all pairs:

```typescript
// Source: Svelte 5 createContext API (svelte 5.49.1 installed)
import { createContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';

export type EditingContext = {
  isEditing: boolean;
  editKey: string | null;
  editRow: number;
  editCol: number;
  editOriginalValue: string;
  editOriginalColumnWidth: number;
  inputValue: string;
  editDropdown: ReturnType<typeof createEditDropdown> | null;
  autocomplete: ReturnType<typeof createAutocomplete> | null;
};

export const [getEditingContext, setEditingContext] = createContext<EditingContext>();

export type SelectionContext = {
  selectionStart: GridCell;
  selectionEnd: GridCell;
  isSelecting: boolean;
  isHiddenAfterCopy: boolean;
  dirtyCells: Set<string>;
};

export const [getSelectionContext, setSelectionContext] = createContext<SelectionContext>();

// ... and so on for each domain
```

**Critical:** `createContext` returns `[getter, setter]` where getter throws if called outside a component tree that has had the setter called. The setter must be called synchronously in `+page.svelte` before any child mounts.

### Pattern 2: +page.svelte as Thin Wrapper

```svelte
<script lang="ts">
  import type { PageProps } from './$types';
  import { setEditingContext, setSelectionContext, /* ... */ } from '$lib/context/gridContext.svelte.ts';
  import { SvelteMap } from 'svelte/reactivity';
  import DataController from '$lib/components/grid/DataController.svelte';
  import Toolbar from '$lib/components/grid/Toolbar.svelte';
  import GridContainer from '$lib/components/grid/GridContainer.svelte';
  import ContextMenu from '$lib/grid/components/context-menu/contextMenu.svelte';

  let { data }: PageProps = $props();

  // Set all contexts synchronously (MUST be before any $effect or child mount)
  setEditingContext($state({
    isEditing: false, editKey: null, editRow: -1, editCol: -1,
    editOriginalValue: '', editOriginalColumnWidth: 0, inputValue: '',
    editDropdown: null, autocomplete: null
  }));

  setSelectionContext($state({
    selectionStart: { row: -1, col: -1 }, selectionEnd: { row: -1, col: -1 },
    isSelecting: false, isHiddenAfterCopy: false, dirtyCells: new Set()
  }));

  // ... setClipboardContext, setColumnContext, setRowContext, setSortContext,
  //     setValidationContext, setChangeContext, setDataContext, setViewContext,
  //     setContextMenuContext, setUiContext
</script>

<div class="px-4 py-2 flex-grow flex flex-col">
  <DataController {data} />
  <Toolbar />
  <GridContainer />
  <ContextMenu />
</div>
```

**Target: < 60 lines.** The `data` prop flows into `DataController` which initializes `dataContext` with the server-loaded assets.

### Pattern 3: Renderless DataController.svelte

```svelte
<!-- DataController.svelte — renders nothing, owns data lifecycle -->
<script lang="ts">
  import type { PageProps } from './$types';
  import { getDataContext, getChangeContext, /* ... */ } from '$lib/context/gridContext.svelte.ts';
  import { createChangeController } from '$lib/grid/utils/gridChanges.svelte.ts';
  // ...

  let { data }: { data: PageData } = $props();

  const dataCtx = getDataContext();
  const changes = createChangeController();
  // ... URL effect, commitChanges, discardChanges, addNewRows ...
</script>
<!-- no template — renderless component -->
```

### Pattern 4: Component-Owned Controller

Instead of creating controllers centrally in `+page.svelte`, each component creates its own:

```svelte
<!-- FloatingEditor.svelte -->
<script lang="ts">
  import { getEditingContext } from '$lib/context/gridContext.svelte.ts';
  import { createEditController } from '$lib/grid/utils/gridEdit.svelte.ts';

  const editCtx = getEditingContext();
  const edit = createEditController(); // owns its own controller instance

  async function save() {
    // writes directly to editCtx — no pageActions callback
    const change = await edit.save(/* ... */);
    if (change) {
      // write to changeContext directly
      const changeCtx = getChangeContext();
      // ...
    }
    editCtx.isEditing = false;
  }
</script>
```

**Key insight:** `createSelectionController()`, `createEditController()`, etc. are factory functions that call `getGridContext()` internally. After the split, they must be updated to call the appropriate domain getter instead. This is the main mechanical work.

### Pattern 5: Direct Context Writes (No pageActions)

**Old pattern (to be eliminated):**
```typescript
// FloatingEditor calls back to page
ctx.pageActions?.onSaveEdit(ctx.inputValue);
```

**New pattern:**
```typescript
// FloatingEditor writes context directly
const editCtx = getEditingContext();
editCtx.isEditing = false;
// save logic lives here, not in +page.svelte
```

### Anti-Patterns to Avoid

- **Circular context reads:** A context setter calling a getter from the same context before it's initialized — the getter throws `"context_getter_called_outside_component"` at runtime
- **Inline controller state objects:** `shortcutState` in GridOverlays must remain a stable object reference (not inline literal) for `{@attach}` — already correct, keep as is
- **Controller duplication:** Each controller factory (`createSelectionController()`) uses `getGridContext()` — after the split, they need updating to call the right domain getter. If two components both call `createSelectionController()`, they share the same context state (correct behavior)
- **Prop threading:** Avoid passing contexts as props — that defeats the purpose. Use `get*Context()` inside the component

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive maps | Plain `Map` | `SvelteMap` | Plain Map not deeply reactive in Svelte 5; already used for `columnWidths`/`rowHeights` |
| Context provision | Custom store/singleton | `createContext` from `svelte` | Already installed, typed, tree-scoped |
| URL reactivity | `page.url.searchParams` effects | `SvelteURL` from `svelte/reactivity` | `page.url` uses `$state.raw()` — not reactive to `replaceState`. Already used. |
| Reactive sets | Plain `Set` in `$state` | `SvelteSet` if granular reactivity needed | `dirtyCells` is currently `Set<string>` in `$state` — works for bulk replace; upgrade only if fine-grained tracking needed |

---

## Bug Fixes — Exact Changes Required

### Bug 1: Drag Selection (onmouseenter → onmouseover)

**File:** `frontend/src/lib/components/grid/GridContainer.svelte`
**Line:** 99 (the `onmouseenter` on the inner content div)
**Change:** `onmouseenter` → `onmouseover`

```svelte
<!-- BEFORE (line 99) -->
onmouseenter={(e) => {

<!-- AFTER -->
onmouseover={(e) => {
```

**Why:** `mouseenter` does not bubble — event delegation with `closest()` requires a bubbling event. `mouseover` bubbles through all ancestors. The existing `extendSelection` guard (`if (!ctx.isEditing)`) already prevents spurious calls during editing.

**Confidence:** HIGH — confirmed by DOM spec + code trace in debug doc.

### Bug 2: Context Menu preventDefault

**File:** `frontend/src/lib/components/grid/GridContainer.svelte`
**Lines:** 130-139 (oncontextmenu handler)

Currently `e.preventDefault()` is only called inside `contextMenu.open()`, which is only reached when `closest('[data-row][data-col]')` succeeds. Right-clicking non-cell areas (toolbar, empty space, scrollbar) never calls `preventDefault` → native browser menu appears.

**Fix:** Call `e.preventDefault()` at the top of the oncontextmenu handler before the `closest()` lookup:

```svelte
<!-- BEFORE -->
oncontextmenu={(e) => {
  const target = e.target as HTMLElement;
  const cell = target.closest('[data-row][data-col]') as HTMLElement | null;
  if (!cell) return;
  const visibleIndex = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  if (!isNaN(visibleIndex) && !isNaN(col)) {
    onContextMenu(e, visibleIndex, col);
  }
}}

<!-- AFTER (Phase 4 — no prop, reads context directly) -->
oncontextmenu={(e) => {
  e.preventDefault();
  const target = e.target as HTMLElement;
  const cell = target.closest('[data-row][data-col]') as HTMLElement | null;
  if (!cell) return;
  const visibleIndex = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  if (isNaN(visibleIndex) || isNaN(col)) return;
  // open contextMenu directly via context (no prop callback needed)
  const actualRow = ctx.virtualScroll.getActualIndex(visibleIndex);
  const key = ctx.keys[col];
  const value = String(ctx.assets[actualRow]?.[key] ?? '');
  ctx.selectionStart = { row: actualRow, col };
  ctx.selectionEnd = { row: actualRow, col };
  ctx.contextMenu?.open(e, actualRow, col, value, key);
  ctx.headerMenu?.close();
}}
```

Note: After Phase 4, `onContextMenu` prop is eliminated — the handler reads `contextMenuContext` and `dataContext` directly. The `e.preventDefault()` at the top also suppresses the native menu for right-clicks on non-cell areas (toolbar, empty space), which is the correct UX.

**Confidence:** HIGH — root cause confirmed in debug doc.

### Bug 3: FloatingEditor Font Size

**File:** `frontend/src/lib/grid/components/floating-editor/FloatingEditor.svelte`
**Line:** 148 (textarea class list)

```svelte
<!-- BEFORE -->
class="w-full h-full resize-none bg-white dark:bg-slate-700 text-neutral-900 dark:text-neutral-100 border-2 border-blue-500 rounded px-1.5 py-1.5 focus:outline-none"

<!-- AFTER -->
class="w-full h-full resize-none bg-white dark:bg-slate-700 text-neutral-900 dark:text-neutral-100 text-xs border-2 border-blue-500 rounded px-1.5 py-1.5 focus:outline-none"
```

**Confidence:** HIGH — root cause confirmed in debug doc. Grid cells use `text-xs` (12px); textarea inherits ~16px without it.

---

## Controller Migration Map

Each controller factory currently calls `getGridContext()` internally and reads/writes the monolithic ctx. After the split, each factory needs updating to call the correct domain getter(s).

| Controller File | Reads From Context | Writes To Context | Moves Into Component |
|-----------------|-------------------|-------------------|---------------------|
| `gridEdit.svelte.ts` | `isEditing`, `editKey`, `editRow`, `editCol`, `editOriginalValue`, `editOriginalColumnWidth`, `inputValue` | same | `FloatingEditor.svelte` |
| `gridSelection.svelte.ts` | `selectionStart`, `selectionEnd`, `isSelecting`, `isHiddenAfterCopy`, `dirtyCells` | same | `GridContainer.svelte` + `GridOverlays.svelte` |
| `gridClipboard.svelte.ts` | `copyStart`, `copyEnd`, `isCopyVisible`, `isHiddenAfterCopy` | same | `GridOverlays.svelte` (clipboard shortcuts) |
| `gridChanges.svelte.ts` | `hasUnsavedChanges`, `hasInvalidChanges` | same | `DataController.svelte` |
| `gridColumns.svelte.ts` | `columnWidths`, `resizingColumn`, `keys` | same | `GridContainer.svelte` |
| `gridRows.svelte.ts` | `rowHeights` | same | `GridContainer.svelte` |
| `gridHistory.svelte.ts` | (no direct ctx fields — internal state) | — | `DataController.svelte` |
| `gridValidation.svelte.ts` | `validationConstraints`, `hasInvalidChanges` | same | `DataController.svelte` |
| `rowGeneration.svelte.ts` | (internal state — newRows) | — | `DataController.svelte` |
| `virtualScrollManager.svelte.ts` | (internal — instance state) | — | `viewContext` (instance stored in context) |

**Important:** Factories like `createSelectionController()` are called in multiple components (GridContainer, GridOverlays both call it). This is correct — they both get back an object that reads/writes the same shared `selectionContext`. The context is the single source of truth.

---

## Common Pitfalls

### Pitfall 1: Context Getter Called Before Setter

**What goes wrong:** If any child component mounts and calls `getEditingContext()` before `+page.svelte` calls `setEditingContext(...)`, Svelte throws at runtime.
**Why it happens:** `setGridContext` is currently called synchronously on line 103 of `+page.svelte`. The same discipline must apply to all ~10 new setters.
**How to avoid:** All `set*Context(...)` calls must be at the top of `+page.svelte`'s `<script>` block, before any `$effect`, before any child component template renders.
**Warning signs:** Runtime error "context_getter_called_outside_component" or silent undefined.

### Pitfall 2: Controller Factories Still Importing Monolithic getGridContext

**What goes wrong:** After splitting contexts, controller factories (`gridEdit.svelte.ts`, etc.) still call `getGridContext()` which no longer exists — TypeScript errors everywhere.
**Why it happens:** The factories were written against the monolithic context.
**How to avoid:** Update each factory file to call the appropriate domain getter (`getEditingContext()`, etc.). Do this as part of each wave, not as a separate step.
**Warning signs:** `svelte-check` errors referencing removed fields.

### Pitfall 3: pageActions References Scattered Across Components

**What goes wrong:** `ctx.pageActions?.onSaveEdit(...)` appears in FloatingEditor (lines 68, 73, 95, 100, 108, 111, 134, 157, 167), GridOverlays callbacks, and ContextMenu. Removing `pageActions` without replacing each call site causes runtime errors.
**Why it happens:** The `pageActions` pattern threaded callbacks from +page.svelte to leaf components across 3 component levels.
**How to avoid:** Audit every `pageActions` reference before removing the field. Replace each with direct controller calls + context writes.
**Warning signs:** TypeScript error `Property 'pageActions' does not exist`.

Complete list of `pageActions` call sites:
- `FloatingEditor.svelte`: `onSaveEdit` (×4), `onCancelEdit` (×2)
- `GridOverlays.svelte`: `onCopy`, `onPaste`, `onUndo`, `onRedo`, `onEscape`, `onEditAction` (in callbacks object)
- `contextMenu.svelte.ts`: `onDeleteNewRow`
- `GridContainer.svelte`: `onSaveEdit` (line 93), `onEditAction` (line 128), `user` check (line 117)

### Pitfall 4: virtualScroll Instance Must Stay in Context

**What goes wrong:** `virtualScroll` is a single shared instance used by both GridContainer (scroll, ensureVisible, getOffsetY) and GridOverlays (visibleRange, rowHeight). If moved out of context, components can't share the same instance.
**How to avoid:** Keep `virtualScroll: createVirtualScroll()` inside `viewContext`. Both components read it via `getViewContext().virtualScroll`.

### Pitfall 5: SvelteMap Lost If Context Split Incorrectly

**What goes wrong:** `columnWidths` and `rowHeights` are `SvelteMap` instances. If they are reassigned (rather than mutated in-place), reactivity breaks.
**How to avoid:** Initialize once in `set*Context($state({ columnWidths: new SvelteMap(), ... }))` and only mutate (`.set()`, `.delete()`). Never replace with a new Map instance.

### Pitfall 6: GridContainer Props That Must Be Eliminated

Currently GridContainer receives 4 props: `assets`, `onHeaderClick`, `onContextMenu`, `onCloseContextMenu`. After Phase 4:
- `assets` — still passes as prop (GridContainer needs it for virtual scroll render loop; it comes from DataController via the component tree)
- `onHeaderClick` — eliminated; GridContainer reads `uiContext.headerMenu` directly and calls `headerMenu.toggle()`
- `onContextMenu` — eliminated; GridContainer handles inline (see Bug 2 fix above)
- `onCloseContextMenu` — eliminated; `contextMenu.close()` called directly via `getContextMenuContext()`

---

## Migration Order (Recommended)

**Bottom-up, bugs first:**

1. **Wave 0 (Bug fixes):** 3 surgical fixes — onmouseover, e.preventDefault(), text-xs — before any context split. Validates the testing baseline.

2. **Wave 1 (Split contexts file):** Rewrite `gridContext.svelte.ts` to export ~10 typed context pairs. Keep the old `[getGridContext, setGridContext]` export temporarily (or update all call sites in the same wave). `svelte-check` gates this wave.

3. **Wave 2 (Leaf components):** Update `FloatingEditor`, `ContextMenu`, `gridShortcuts` to call domain-specific getters. Eliminate `pageActions` references from these components. Each component can own its controller.

4. **Wave 3 (GridOverlays + GridContainer):** Update both to use domain getters. Remove `onHeaderClick`, `onContextMenu`, `onCloseContextMenu` props. Wire GridContainer's event handlers directly to context.

5. **Wave 4 (DataController + Toolbar):** Create `DataController.svelte`. Migrate URL-effect, commitChanges, discardChanges, addNewRows, handleRealtimeUpdate, sort, view-switch, filterSelect into DataController. Toolbar switches to reading contexts directly.

6. **Wave 5 (+page.svelte rewrite):** Once all controllers are in their owning components and DataController exists, rewrite +page.svelte from 1,199 lines to < 60. Only sets contexts + renders children.

---

## State of the Art

| Old Pattern | New Pattern | When Changed | Impact |
|------------|-------------|--------------|--------|
| Single monolithic `GridContext` (80+ fields) | ~10 typed domain contexts | Phase 4 | Smaller re-render blast radius per component |
| `pageActions` callback bag | Direct context writes | Phase 4 | Components independently deletable |
| Controllers created in `+page.svelte` | Controllers created inside owning component | Phase 4 | Delete component = delete its logic |
| Prop threading for contextmenu/headerMenu | Context lookup inside handler | Phase 4 | No inter-component prop wiring |
| `onmouseenter` event delegation | `onmouseover` event delegation | Bug fix (Phase 4) | Drag selection restored |

---

## Svelte 5 Context API — Confirmed Facts

All confirmed from project memory (Svelte 5.49.1 installed):

- `createContext<T>()` from `'svelte'` — available since Svelte 5.40
- Returns `[getter, setter]` tuple — `getter: () => T`, `setter: (value: T) => void`
- Fully type-safe — no magic strings
- Tree-scoped — each context is only accessible to descendants of the component that called the setter
- Multiple contexts can be set in the same component (+page.svelte sets all ~10)
- Multiple components in the same tree can call the same getter — they all receive the same instance
- `$state({...})` passed to setter makes the object deeply reactive
- Setter MUST be called synchronously (not in `$effect`, not after `await`) — enforced by Svelte runtime
- No factory functions, no defaults, no logic in the context file itself

---

## Open Questions

1. **editDropdown and autocomplete placement**
   - What we know: They are currently in monolithic `GridContext` as `editDropdown` and `autocomplete` fields
   - What's unclear: Do they belong in `editingContext` (they're edit-phase UI) or a separate `uiContext`?
   - Recommendation: Put them in `editingContext` — they are created when editing starts and consumed only by FloatingEditor. No other component reads them after Phase 4.

2. **DataController receiving `data` prop vs reading dataContext**
   - What we know: `data` from `+page.svelte` contains `initialAssets`, `user`, `locations`, `statuses`, etc. — server-loaded route data
   - What's unclear: Does `DataController` receive `data` as a prop or does `+page.svelte` pre-populate `dataContext` with it?
   - Recommendation: `+page.svelte` initializes `dataContext` with `data.assets` and `data.user` (it's the context initializer), then DataController reads `getDataContext()` and enriches it. This keeps +page.svelte the single context setter and DataController a pure consumer.

3. **Toolbar props after Phase 4**
   - What we know: Toolbar currently receives 8 props from +page.svelte (user, getCurrentUrlState, updateSearchUrl, onAddNewRow, onCommit, onAddRows, onDiscard, onViewChange, onNavigateError)
   - What's unclear: Can Toolbar become fully zero-prop like ContextMenu?
   - Recommendation: Yes — Toolbar reads `dataContext` for user, `changeContext` for hasUnsavedChanges, `viewContext` for activeView, and calls DataController's exported functions via... wait: DataController is a component, not a module — Toolbar can't import its functions. Solution: DataController writes action callbacks into `dataContext` (e.g., `dataCtx.commit`, `dataCtx.discard`) that Toolbar calls. Or Toolbar simply becomes a sibling of DataController and both read/write the same contexts.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct read — `gridContext.svelte.ts` (83 lines, complete field inventory)
- Codebase direct read — `+page.svelte` (1,199 lines, complete controller/effect audit)
- Codebase direct read — `GridContainer.svelte`, `GridOverlays.svelte`, `FloatingEditor.svelte`
- Codebase direct read — `.planning/debug/` (3 diagnosed bug docs — root causes confirmed)
- Project memory — Svelte 5 `createContext` API confirmed (5.49.1 installed, available since 5.40)
- `.planning/STATE.md` — historical decisions from Phases 1-3

### Secondary (MEDIUM confidence)
- `.planning/CONTEXT.md` — user locked decisions (authoritative)
- `.planning/REQUIREMENTS.md` — F1.x through F4.x requirements
- `.planning/ROADMAP.md` — Phase 4 scope definition

---

## Metadata

**Confidence breakdown:**
- Bug fixes: HIGH — root causes code-traced and confirmed in debug docs, exact line numbers known
- Standard Stack: HIGH — Svelte 5.49.1 installed, `createContext` API in project memory, no external dependency changes needed
- Architecture patterns: HIGH — derived from locked user decisions + codebase audit; no ambiguity in the pattern
- Migration order: MEDIUM — order is logical but the exact wave boundaries may shift based on actual TypeScript errors encountered
- Open questions: LOW confidence on the specific answers, but questions are clearly scoped

**Research date:** 2026-02-26
**Valid until:** Until codebase changes — this research is codebase-specific, not ecosystem-dependent
