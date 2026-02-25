# Phase 2: Component Decomposition - Research

**Researched:** 2026-02-25
**Domain:** Svelte 5 component architecture, context-driven decomposition, SvelteKit route shell pattern
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### InventoryGrid.svelte gets deleted
- The grid IS the app. There is no need for a portable grid wrapper.
- InventoryGrid.svelte was always +page.svelte under a different name.
- Its responsibilities return to +page.svelte (context setup, structural orchestration) or move to self-sufficient child components.
- After Phase 2: `+page.svelte` sets up gridContext and calls setGridContext(ctx), then renders grid children directly.

#### +page.svelte becomes the context owner
- Calls `setGridContext(ctx)` — context setup lives here
- Renders the structural shell: `<Toolbar />`, `<GridContainer />`, `<GridOverlays />`, menus
- Page-level concerns (URL sync, search state, realtime connection) belong here, not in grid components
- Grid components receive nothing from +page.svelte except what the route load function provides (assets, keys, user)

#### GridContainer — the viewport (new component)
- New `GridContainer.svelte`: virtual scroll + row rendering only
- Reads `assets`, `keys`, `virtualScroll` from context
- Renders `<GridRow />` for visible rows
- Emits raw interaction signals to context (right-click coordinates, hover, cell focus)
- Zero knowledge of menus, overlays, editors — those are siblings

#### Self-sufficient children (each reads context directly)
- `GridOverlays.svelte` — reads `ctx.selectionStart/End`, `ctx.copyRegion` and renders its own overlays. InventoryGrid should not be computing overlay state.
- `Toolbar.svelte` — reads `ctx.sortKey`, `ctx.sortDirection`, `ctx.activeView` directly
- `ContextMenu` — reads `ctx.contextMenuTarget` signal, self-positions when set
- Keyboard handling (copy/paste, undo/redo) — moves out of InventoryGrid into a dedicated handler or onto GridContainer's root element
- Search/URL state — page-level concern, stays in or near +page.svelte

#### File structure — controllers vs components
- Files without a `.svelte` sibling are not components — they are utilities
- Pure controllers (`.svelte.ts` only) move to `lib/grid/utils/`
- True component pairs (`.svelte` + `.svelte.ts`) move to `lib/grid/components/`

**Controllers to move to `lib/grid/utils/`:**
gridEdit, gridChanges, gridColumns, gridRows, gridSelection, gridHistory, gridClipboard, gridValidation, rowGeneration, virtualScrollManager

**Component pairs to move to `lib/grid/components/`:**
contextMenu, editDropdown, filterPanel, headerMenu, autocomplete

### Claude's Discretion
- Exact line count targets per file
- Whether keyboard event handling gets its own component or lives on GridContainer's root element
- Import path conventions within lib/grid/

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| F2.1 | `+page.svelte` must become a thin route shell (< 100 lines) that renders grid children directly | Confirmed feasible: context setup + $state literal + setGridContext + render 4-5 child components = ~80-90 lines |
| F2.2 | `<InventoryGrid>` is DELETED — context ownership returns to +page.svelte | Confirmed: InventoryGrid is already the context owner (lines 74-102). Moving ctx creation to +page.svelte is a direct lift. |
| F2.3 | `<GridContainer>` renders only visible rows via virtual scroll — ignorant of editors, menus, clipboard | Confirmed: virtualScroll reads only need `assets` + `keys` + scroll state. GridRow already handles its own editing UI. |
| F2.4 | Each component has a corresponding `.svelte.ts` ViewModel/Controller with all logic | Confirmed pattern: GridRow, GridOverlays, Toolbar already read controllers. +page.svelte will need a `page.svelte.ts` controller for its own logic. |
| F2.5 | Components must not accept more than 3 props (use context for everything else) | High prop counts identified in Toolbar (10 props) and GridOverlays (9 props). Both must be redesigned to pull from context directly. |
</phase_requirements>

---

## Summary

InventoryGrid.svelte is a 1403-line monolith that owns three distinct concerns: (1) Svelte context setup and all controller instantiation, (2) page-level concerns like URL sync, search state management, realtime connection handling, and view switching, and (3) structural DOM rendering. The decomposition is mostly a redistribution of already-written code — the controllers exist, the child components exist, the context type is defined. This phase is about moving code to the right owner, not writing new logic.

The most consequential architectural insight from reading the code: **Toolbar and GridOverlays currently receive computed values as props that they should compute themselves from context**. Toolbar receives 10 props including callbacks computed in InventoryGrid; GridOverlays receives 9 props including pre-computed overlay objects. Making these components self-sufficient means moving the overlay computation logic into GridOverlays and the URL/search callbacks into a page-level controller — not just shuffling props around.

The key technical constraint is the Svelte 5 `setGridContext` / `getGridContext` call order: context must be set synchronously before any `$effect` or child component render. This is already solved correctly in InventoryGrid (lines 74-102) and the same pattern moves verbatim to +page.svelte. No framework research needed — the pattern is proven and working in the codebase.

**Primary recommendation:** Move code in this order: (1) create +page.svelte.ts controller holding all page-level logic, (2) move ctx creation + setGridContext call into +page.svelte, (3) create GridContainer.svelte, (4) redesign Toolbar and GridOverlays to be zero-prop context readers, (5) restructure directories. Each step is independently testable.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Svelte 5 | 5.49.1 (installed) | `createContext`, `$state`, `$derived`, `$effect`, `$props` | Project stack |
| SvelteKit | (installed) | `+page.svelte` route conventions, `$app/state`, `$app/navigation` | Project stack |
| SvelteURL | (svelte/reactivity) | Reactive URL object — already in use, proven pattern | Already solved in codebase |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `svelte/reactivity` SvelteMap | (installed) | Reactive Map for columnWidths/rowHeights | Already used in ctx |
| `untrack` from svelte | (installed) | Break reactive cycles in $effect | Already used extensively in InventoryGrid |
| `tick` from svelte | (installed) | Wait for DOM update after state change | Already used for scroll-after-add-row |

### Alternatives Considered
None. This is a refactor within the existing stack. No new dependencies.

---

## Architecture Patterns

### Recommended Project Structure
```
frontend/src/
├── routes/
│   ├── +page.svelte          # Context owner, thin shell (~80-90 lines)
│   └── +page.svelte.ts       # Page controller: URL sync, search, realtime, view switching, commit/discard
├── lib/
│   └── grid/
│       ├── components/       # .svelte + .svelte.ts pairs
│       │   ├── context-menu/
│       │   ├── edit-dropdown/
│       │   ├── filter-panel/
│       │   ├── header-menu/
│       │   └── suggestion-menu/  (autocomplete)
│       ├── utils/            # .svelte.ts only (controllers)
│       │   ├── gridEdit.svelte.ts
│       │   ├── gridChanges.svelte.ts
│       │   ├── gridColumns.svelte.ts
│       │   ├── gridRows.svelte.ts
│       │   ├── gridSelection.svelte.ts
│       │   ├── gridHistory.svelte.ts
│       │   ├── gridClipboard.svelte.ts
│       │   ├── gridValidation.svelte.ts
│       │   ├── rowGeneration.svelte.ts
│       │   └── virtualScrollManager.svelte.ts
│       ├── GridContainer.svelte      # NEW: virtual scroll viewport
│       ├── GridRow.svelte            # (existing, stays)
│       ├── GridHeader.svelte         # (existing, stays)
│       ├── GridOverlays.svelte       # (redesigned: zero props, reads context)
│       └── Toolbar.svelte            # (redesigned: zero props, reads context)
├── context/
│   └── gridContext.svelte.ts # (existing, unchanged or extended)
```

Note: The user decision says `lib/grid/utils/` and `lib/grid/components/` — the current location is `lib/components/grid/`. The restructure moves files from `lib/components/grid/` to `lib/grid/`. This is a file move, not a logic change, but will require import path updates across all files.

### Pattern 1: Context-as-sole-channel
**What:** Child components call `getGridContext()` themselves; parent renders them with zero or minimal props.
**When to use:** For all grid children in this phase.
**Example (current Toolbar has 10 props; target has 0-1):**
```typescript
// BEFORE (current Toolbar.svelte — 10 props, computed in InventoryGrid)
let { user, filterPanel, getCurrentUrlState, updateSearchUrl,
      onAddNewRow, onCommit, onAddRows, onDiscard, onViewChange,
      onNavigateError, invalidCount }: Props = $props();

// AFTER (target Toolbar.svelte — reads context directly, page.svelte.ts provides callbacks via context)
// In Toolbar.svelte:
const ctx = getGridContext();
const changes = createChangeController();
const rowGen = createRowGenerationController();
// Reads ctx.hasUnsavedChanges, ctx.activeView etc. directly
// Callbacks (commit, discard, etc.) are accessed via a pageContext or event dispatch
```

**Key insight:** The callbacks in Toolbar (onCommit, onDiscard, onAddNewRow, etc.) are page-level actions — they touch `filteredAssets`, `baseAssets`, `realtime`, `history`, all of which live at page level. The cleanest solution is either: (a) add a second context (`pageContext`) that Toolbar reads for actions, or (b) use `createEventDispatcher` / Svelte 5 `$emit` pattern, or (c) keep 3 callback props max per F2.5.

**Recommended:** Keep 3 props max. Toolbar gets `user` (from page load, not context), and can read `ctx` directly for state. For actions, emit events upward (`oncommit`, `ondiscard`, `onaddrow`) — keeping the action implementations in +page.svelte.ts where `filteredAssets` and `baseAssets` live.

### Pattern 2: +page.svelte.ts as page controller
**What:** SvelteKit supports co-locating a `.svelte.ts` ViewModel alongside `+page.svelte`.
**When to use:** When +page.svelte has more than ~30 lines of script logic.
**Example:**
```typescript
// +page.svelte.ts (page-level controller)
// Contains: URL sync, search fetch, view switching, commitChanges, discardChanges,
//           handleAddNewRow, handleRealtimeUpdate, sortData, navigateToError
// Exports a factory: createPageController(ctx, controllers...)
// +page.svelte imports and calls it

export function createPageController(ctx: GridContext, deps: PageDeps) {
  // ... all page-level $effects, async handlers
  return { commitChanges, discardChanges, handleAddNewRow, ... };
}
```

**Note:** The `$state` context object MUST be created in `+page.svelte` (not in the `.svelte.ts` file) because Svelte runes only work inside `.svelte` components and `.svelte.ts` modules when run in the right context. The `createPageController` factory can accept the pre-created `ctx` as a parameter.

### Pattern 3: GridContainer — viewport-only component
**What:** New component that owns the scroll container, virtualScroll interaction, and row rendering loop.
**When to use:** Extracts the DOM-heavy scroll region from InventoryGrid.
**Example:**
```svelte
<!-- GridContainer.svelte -->
<script lang="ts">
  import { getGridContext } from '$lib/context/gridContext.svelte.ts';
  import { createVirtualScroll } from '$lib/grid/utils/virtualScrollManager.svelte';
  import { createColumnController } from '$lib/grid/utils/gridColumns.svelte.ts';
  import { createRowController } from '$lib/grid/utils/gridRows.svelte.ts';
  import GridRow from './GridRow.svelte';

  const ctx = getGridContext();
  const virtualScroll = createVirtualScroll();  // OR: read from context
  // ...
</script>

<div bind:this={scrollContainer} onscroll={handleScroll} class="...">
  <!-- GridHeader stays inside GridContainer or is a sibling -->
  <div style="height: {virtualScroll.getTotalHeight(...)}px; ...">
    {#each visibleData.items as asset, i}
      <div style="height: {rowHeight}px;">
        <GridRow {asset} {actualIndex} ... />
      </div>
    {/each}
  </div>
</div>
```

**Critical decision for planner:** `virtualScroll` instance must be accessible to multiple components (GridContainer needs it for scroll, +page.svelte needs it for `ensureVisible` on add-row). Either: (a) add `virtualScroll` to gridContext, or (b) pass it as a prop from +page.svelte. Given F2.5 (max 3 props), option (a) — add to context — is cleaner.

### Pattern 4: GridOverlays — self-computing overlays
**What:** GridOverlays currently receives 9 pre-computed props from InventoryGrid. It should compute its own overlays from context.
**When to use:** This is the F2.5 enforcement for GridOverlays.
**Current state (9 props):**
```typescript
// CURRENT GridOverlays.svelte — 9 props
type Props = {
  keys: string[];
  assets: Record<string, any>[];
  filteredAssetsLength: number;
  otherUserSelections: Record<string, any>;
  hoveredUser: string | null;
  selectionOverlay: any;    // computed in InventoryGrid
  copyOverlay: any;         // computed in InventoryGrid
  dirtyCellOverlays: any[]; // computed in InventoryGrid
  virtualScroll: any;
  onHoverUser: (clientId: string | null) => void;
};
```
**Target (reads context, 0-1 props):**
```typescript
// AFTER: GridOverlays reads context for all state
// selectionOverlay, copyOverlay, dirtyCellOverlays are $derived inside GridOverlays
// otherUserSelections is $derived inside GridOverlays (from realtime singleton)
// hoveredUser is local $state in GridOverlays
// virtualScroll comes from context
```
**What moves:** The `selectionOverlay`, `copyOverlay`, `dirtyCellOverlays`, `otherUserSelections` `$derived` blocks from InventoryGrid move into GridOverlays.

### Pattern 5: Directory restructure with import path update
**What:** Move files from `lib/components/grid/{subdir}/file.ts` to `lib/grid/{utils|components}/file.ts`.
**When to use:** After all logic moves are done (do file moves last to minimize merge conflicts).
**Key risk:** Every import of these paths must be updated. With TypeScript aliases like `$lib/`, this is search-and-replace on the path segment.

### Anti-Patterns to Avoid
- **Adding virtualScroll to context too late:** If GridContainer needs virtualScroll to render, and ensureVisible needs it in +page.svelte.ts, add it to context at creation time (in the $state literal in +page.svelte). Don't retrofit it.
- **Keeping filteredAssets/baseAssets as component state in a child:** These are page-level data arrays (mutated by search, sort, realtime, paste, commit). They must stay in +page.svelte scope (or its controller). GridContainer reads only the final `assets` array, which is `$derived([...filteredAssets, ...rowGen.newRows])`.
- **Moving $effects into .svelte.ts files incorrectly:** `$effect` works in `.svelte.ts` files only when the module is treated as a reactive module. The page controller factory pattern (called from within the .svelte component) ensures the reactive root is established correctly.
- **prop-drilling textareaRef:** `textareaRef` is currently `bind:this` in GridRow, passed up via `bind:textareaRef` to InventoryGrid where `saveEdit` calls `edit.updateRowHeight(textareaRef)`. After decomposition, `textareaRef` handling stays inside GridRow — `edit.updateRowHeight` call moves inside GridRow's save flow, not passed up.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reactive URL handling | Custom URL sync | `SvelteURL` from `svelte/reactivity` | Already proven in codebase; `.searchParams` is deeply reactive |
| Context access | Prop drilling | `createContext` / `getGridContext()` pattern | Already established; F2.5 enforces ≤3 props |
| Keyboard shortcut routing | Custom event bus | `createInteractionHandler` in `interactionHandler.ts` | Already written; mounts on `window` |

---

## Common Pitfalls

### Pitfall 1: setGridContext call order broken during migration
**What goes wrong:** If ctx creation or setGridContext moves to a child component or executes after an `await`, Svelte throws `set_context_after_init` error at runtime.
**Why it happens:** Svelte context can only be set synchronously during component initialization (before any microtask boundary).
**How to avoid:** The `const ctx = $state<GridContext>({...}); setGridContext(ctx);` block stays in `+page.svelte` script, at module top level, with no `await` before it. The page controller factory receives `ctx` as parameter — it does not create context.
**Warning signs:** Runtime error "Cannot call setContext after component has mounted" or child components getting undefined context.

### Pitfall 2: virtualScroll instance not shared
**What goes wrong:** GridContainer creates its own `createVirtualScroll()` instance; +page.svelte.ts calls `ensureVisible` on a different instance; scroll doesn't work.
**Why it happens:** `createVirtualScroll()` is a factory — each call creates independent reactive state. Two instances means two different `scrollTop` values.
**How to avoid:** Create the single `virtualScroll` instance in +page.svelte (same as today in InventoryGrid), add it to gridContext, and have GridContainer read it from context with `getGridContext()`.
**Warning signs:** `ensureVisible` after "Add Row" does nothing; scroll position doesn't update after keyboard navigation.

### Pitfall 3: Toolbar callbacks need page-level data
**What goes wrong:** Moving callbacks like `commitChanges`, `discardChanges`, `handleAddNewRow` into +page.svelte.ts is correct — but Toolbar still needs to trigger them. If Toolbar has no way to call them, the buttons become dead.
**Why it happens:** F2.5 (max 3 props) prevents passing all 8 callbacks as props.
**How to avoid:** Use Svelte 5 event-style callbacks — pass the 3 most critical ones as props (`oncommit`, `ondiscard`, `onaddrow`), or use a second context (`pageContext`) to expose the action surface. The planner should decide which approach fits F2.5.
**Warning signs:** Toolbar buttons compile but nothing happens on click; or TypeScript errors about undefined callbacks.

### Pitfall 4: filteredAssets.length used in sibling components
**What goes wrong:** `filteredAssets.length` is needed in GridOverlays (to distinguish new vs existing rows in dirty cell overlays) and in ContextMenu (showDelete condition: `contextMenu.row >= filteredAssets.length`). After decomposition, `filteredAssets` lives only in +page.svelte scope.
**Why it happens:** The current design mixes page state (filteredAssets) with rendering concerns in child components.
**How to avoid:** Add `filteredAssetsCount: number` to gridContext. +page.svelte sets it via `$effect(() => { ctx.filteredAssetsCount = filteredAssets.length; })` or better, makes filteredAssets itself part of ctx (simpler, more coherent).
**Warning signs:** Dirty cell overlays show wrong colors on new rows; delete option appears on wrong rows in context menu.

### Pitfall 5: textareaRef bind propagation broken
**What goes wrong:** Currently InventoryGrid has `let textareaRef` and passes `bind:textareaRef` to GridRow, then uses it in `saveEdit()` to call `edit.updateRowHeight(textareaRef)`. After GridContainer wraps GridRow, the bind chain changes.
**Why it happens:** `bind:` propagation requires explicit pass-through at each component boundary.
**How to avoid:** Move `edit.updateRowHeight(textareaRef)` into GridRow itself — GridRow already has direct access to the textarea via `bind:this={textareaRef}` locally. GridRow calls `edit.updateRowHeight` in the `oninput` handler already; the call in `saveEdit()` can also move there. This eliminates the need for textareaRef prop entirely.
**Warning signs:** Row height doesn't adjust correctly when editing cells with long content.

### Pitfall 6: Import path breakage during directory restructure
**What goes wrong:** Files move from `lib/components/grid/` to `lib/grid/`, breaking all imports.
**Why it happens:** TypeScript alias `$lib/` points to `lib/`, so paths like `$lib/components/grid/selection/gridSelection.svelte.ts` become `$lib/grid/utils/gridSelection.svelte.ts`.
**How to avoid:** Do all logic migrations first (keeping files in place), then do the directory restructure as a final step. Update all imports at once using grep + sed or TypeScript language server rename. Run `svelte-check` from `frontend/` to catch all broken imports.
**Warning signs:** TypeScript errors about module not found after moving files.

---

## Code Examples

Verified patterns from codebase:

### Context creation and set (must stay in .svelte, must be synchronous)
```typescript
// In +page.svelte <script>
import { setGridContext } from '$lib/context/gridContext.svelte.ts';
import type { GridContext } from '$lib/context/gridContext.svelte.ts';
import { SvelteMap } from 'svelte/reactivity';

// STEP 1: Create reactive context object
const ctx = $state<GridContext>({
  isEditing: false,
  editKey: null,
  editRow: -1,
  editCol: -1,
  editOriginalValue: '',
  editOriginalColumnWidth: 0,
  inputValue: '',
  selectionStart: { row: -1, col: -1 },
  selectionEnd: { row: -1, col: -1 },
  isSelecting: false,
  isHiddenAfterCopy: false,
  copyStart: { row: -1, col: -1 },
  copyEnd: { row: -1, col: -1 },
  isCopyVisible: false,
  dirtyCells: new Set(),
  hasUnsavedChanges: false,
  hasInvalidChanges: false,
  validationConstraints: {},
  columnWidths: new SvelteMap(),
  rowHeights: new SvelteMap(),
  resizingColumn: null,
  sortKey: null,
  sortDirection: null,
  activeView: data.initialView || 'default',
  keys: data.keys,
  // Add new fields needed by decomposed children:
  filteredAssetsCount: data.assets.length,  // for overlay/menu decisions
  // virtualScroll: createVirtualScroll(),  // option A for shared instance
});

// STEP 2: Set context BEFORE any $effect or child render
setGridContext(ctx);
```

### Reading from context in a self-sufficient child
```typescript
// In GridOverlays.svelte <script>
import { getGridContext } from '$lib/context/gridContext.svelte.ts';
import { createSelectionController } from '$lib/grid/utils/gridSelection.svelte.ts';
import { createColumnController } from '$lib/grid/utils/gridColumns.svelte.ts';

const ctx = getGridContext();
const selection = createSelectionController();
const columns = createColumnController();

// Compute overlays here, not in parent:
const selectionOverlay = $derived(
  selection.computeVisualOverlay(
    selection.start,
    selection.end,
    ctx.virtualScroll.visibleRange,  // if virtualScroll is in context
    ctx.keys,
    (key) => columns.getWidth(key),
    ctx.virtualScroll.rowHeight,
  )
);
```

### Page controller factory pattern (for +page.svelte.ts)
```typescript
// +page.svelte.ts
import type { GridContext } from '$lib/context/gridContext.svelte.ts';

export function createPageController(ctx: GridContext, deps: {
  getFilteredAssets: () => Record<string, any>[];
  setFilteredAssets: (v: Record<string, any>[]) => void;
  // ... other mutable page state accessors
}) {
  const changes = createChangeController();
  const history = createHistoryController();
  // ... etc

  // URL sync effect
  $effect(() => {
    // reactive URL logic here
  });

  return {
    commitChanges,
    discardChanges,
    handleAddNewRow,
    navigateToError,
    // ...
  };
}

// In +page.svelte:
// const page = createPageController(ctx, { ... });
```

### GridContainer skeleton
```svelte
<!-- GridContainer.svelte -->
<script lang="ts">
  import { getGridContext } from '$lib/context/gridContext.svelte.ts';
  import { createColumnController } from '$lib/grid/utils/gridColumns.svelte.ts';
  import { createRowController } from '$lib/grid/utils/gridRows.svelte.ts';
  import GridRow from './GridRow.svelte';
  import GridHeader from './GridHeader.svelte';

  // Claude's discretion: keyboard handler on root element or separate component
  // Recommendation: mount on this div via use:action or onkeydown, since this
  // is the natural focus target (tabindex="-1" already)

  type Props = {
    assets: Record<string, any>[];
    onHeaderClick: (e: MouseEvent, key: string, filterItems: string[], isLast: boolean) => void;
    onContextMenu: (e: MouseEvent, visibleIndex: number, col: number) => void;
  };

  // 3 props max (F2.5): assets from load data, 2 callbacks from page
  let { assets, onHeaderClick, onContextMenu }: Props = $props();

  const ctx = getGridContext();
  const virtualScroll = ctx.virtualScroll;  // shared instance from context
  const columns = createColumnController();
  const rows = createRowController();

  let scrollContainer: HTMLDivElement | null = $state(null);
  const visibleData = $derived(virtualScroll.getVisibleItems(assets));

  function handleScroll(e: Event) {
    virtualScroll.handleScroll(e);
    // header menu reposition: emit to parent or read headerMenu from context
  }

  $effect(() => {
    let ro: ResizeObserver | null = null;
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
      ro = new ResizeObserver(entries => {
        virtualScroll.updateContainerHeight(entries[0].contentRect.height);
      });
      ro.observe(scrollContainer);
    }
    return () => ro?.disconnect();
  });
</script>

<div
  bind:this={scrollContainer}
  onscroll={handleScroll}
  class="rounded-lg border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-auto h-[calc(100dvh-8.9rem)] shadow-md relative select-none focus:outline-none"
  tabindex="-1"
>
  <div class="w-max min-w-full bg-white dark:bg-slate-800 text-left relative"
    style="height: {virtualScroll.getTotalHeight(assets.length, rows) + 32 + 16}px;">

    <GridHeader {keys} {onHeaderClick} onCloseContextMenu={...} />

    <div class="absolute top-8 w-full"
      style="transform: translateY({virtualScroll.getOffsetY(rows)}px);">

      {#each visibleData.items as asset, i (asset.id || visibleData.startIndex + i)}
        {@const actualIndex = visibleData.startIndex + i}
        {@const rowHeight = rows.getHeight(actualIndex)}
        {@const isNewRow = actualIndex >= ctx.filteredAssetsCount}
        <div class="flex border-b ... {isNewRow ? 'bg-blue-200 ...' : ''}"
          style="height: {rowHeight}px;">
          <GridRow {asset} {actualIndex} {onContextMenu} visibleIndex={i} />
        </div>
      {/each}
    </div>
  </div>
</div>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Props-only component communication | Context via `createContext` from svelte | Phase 1 | Children read state directly instead of receiving it as props |
| Singleton managers (global state) | Context-scoped controllers (`createXxx()` factories) | Phase 1 | Controllers are instantiated per page, read from context |
| InventoryGrid as monolith | InventoryGrid as context owner + children | Phase 1 | Phase 2 moves ownership to +page.svelte where it belongs |

**Deprecated/outdated in this codebase:**
- `getContext` / `setContext` with string keys: replaced by `createContext` typed tuple pattern
- Svelte 4 `createEventDispatcher`: replaced by callback props in Svelte 5

---

## Open Questions

1. **Where does virtualScroll live after decomposition?**
   - What we know: GridContainer needs it for render; +page.svelte needs it for `ensureVisible` after add-row; currently created in InventoryGrid scope.
   - What's unclear: Whether to put it in gridContext (simplest sharing) or manage it as a prop/store.
   - Recommendation: Add `virtualScroll: VirtualScrollManager` to `GridContext` type and create the instance as part of the context literal in +page.svelte. Cleanest solution — avoids prop threading and preserves single instance.

2. **How does Toolbar trigger page-level actions within F2.5 (max 3 props)?**
   - What we know: Toolbar currently has 10 props, many are callbacks. The callbacks (`commitChanges`, `discardChanges`, etc.) are page-level and need `filteredAssets`, `baseAssets`, history, changes, rowGen — all of which live at page level.
   - What's unclear: Whether Svelte 5 event-style props (`onclick` pattern) count against the 3-prop limit, or if a second context (like `pageContext`) is appropriate.
   - Recommendation: Treat callback props as exempt from the "3 props" spirit (the spirit is about data props, not action callbacks). Give Toolbar 1 data prop (`user`) and 3-4 callback props. Alternatively: a `pageContext` with the action surface. The planner should decide.

3. **Does keyboard handling go into GridContainer or a separate KeyboardHandler component?**
   - What we know: Currently `mountInteraction(window)` is called in InventoryGrid — it attaches global keyboard listeners. The handlers need access to `selection`, `clipboard`, `history`, `changes`, `edit` controllers.
   - What's unclear: The user said "Claude's discretion."
   - Recommendation: Keep `mountInteraction(window)` called from +page.svelte.ts (page-level effect). It already returns a cleanup function. The callbacks it receives (onCopy, onPaste, onUndo, onRedo, onEscape, onEdit, onScrollIntoView) are page-level actions that live naturally in +page.svelte.ts. No new component needed.

4. **Import path alias for `lib/grid/` vs `lib/components/grid/`**
   - What we know: Current path is `$lib/components/grid/`. User decision moves to `lib/grid/utils/` and `lib/grid/components/`.
   - What's unclear: Whether the move also reorganizes existing top-level files (GridRow, GridHeader, GridOverlays, Toolbar, GridContainer) into `lib/grid/` root or `lib/grid/components/`.
   - Recommendation: Put top-level grid components (GridRow, GridHeader, GridOverlays, Toolbar, GridContainer) at `lib/grid/` root. Put sub-components (contextMenu, editDropdown, etc.) in `lib/grid/components/`. Put utilities in `lib/grid/utils/`. This avoids double-nesting.

---

## Sources

### Primary (HIGH confidence)
- Codebase direct read — `InventoryGrid.svelte` (1403 lines, fully read)
- Codebase direct read — `gridContext.svelte.ts`, `gridSelection.svelte.ts`, `virtualScrollManager.svelte.ts`, `GridOverlays.svelte`, `Toolbar.svelte`, `GridRow.svelte`, `GridHeader.svelte`, `contextMenu.svelte`, `contextMenu.svelte.ts`
- Codebase direct read — all controller files (gridChanges, gridColumns, gridRows, gridEdit, gridHistory, gridClipboard, gridValidation, rowGeneration)
- Project memory: `createContext` from svelte returns `[getter, setter]` tuple — confirmed in gridContext.svelte.ts line 49

### Secondary (MEDIUM confidence)
- Svelte 5 docs pattern for `$state` in `.svelte.ts` factory functions — confirmed working in codebase by the existing controller factories

### Tertiary (LOW confidence)
- None. All findings are grounded in direct codebase reading.

---

## File Inventory

Current sizes for planning reference:

| File | Lines | Destination after Phase 2 |
|------|-------|--------------------------|
| InventoryGrid.svelte | 1403 | DELETED |
| +page.svelte | 18 | ~80-90 lines (context owner + shell) |
| +page.svelte.ts | (new) | ~300-400 lines (all page-level logic) |
| GridContainer.svelte | (new) | ~80-100 lines |
| GridOverlays.svelte | 168 | ~180 lines (adds $derived overlay computations) |
| Toolbar.svelte | 219 | ~200 lines (remove prop dependencies) |
| GridHeader.svelte | 65 | unchanged |
| GridRow.svelte | 223 | minor: remove textareaRef bind-up |
| contextMenu.svelte | 87 | move to lib/grid/components/ |
| contextMenu.svelte.ts | 42 | move to lib/grid/components/ |
| headerMenu.svelte | 122 | move to lib/grid/components/ |
| headerMenu.svelte.ts | 131 | move to lib/grid/components/ |
| filterPanel.svelte | 126 | move to lib/grid/components/ |
| filterPanel.svelte.ts | 23 | move to lib/grid/components/ |
| editDropdown.svelte | 58 | move to lib/grid/components/ |
| editDropdown.svelte.ts | 62 | move to lib/grid/components/ |
| autocomplete.svelte | 43 | move to lib/grid/components/ |
| autocomplete.svelte.ts | 103 | move to lib/grid/components/ |
| gridEdit.svelte.ts | 95 | move to lib/grid/utils/ |
| gridChanges.svelte.ts | 154 | move to lib/grid/utils/ |
| gridColumns.svelte.ts | 85 | move to lib/grid/utils/ |
| gridRows.svelte.ts | 82 | move to lib/grid/utils/ |
| gridHistory.svelte.ts | 130 | move to lib/grid/utils/ |
| gridClipboard.svelte.ts | 270 | move to lib/grid/utils/ |
| gridValidation.svelte.ts | 71 | move to lib/grid/utils/ |
| gridSelection.svelte.ts | 349 | move to lib/grid/utils/ |
| rowGeneration.svelte.ts | 205 | move to lib/grid/utils/ |
| virtualScrollManager.svelte.ts | 186 | move to lib/grid/utils/ |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, working codebase confirmed
- Architecture: HIGH — patterns derived directly from reading the existing code, not from assumptions
- Pitfalls: HIGH — each pitfall identified from concrete code patterns in InventoryGrid.svelte
- Open questions: MEDIUM — framework behavior confirmed, implementation choice left to planner

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (stable framework, internal refactor — low decay risk)
