# Phase 1: Context Foundation - Research

**Researched:** 2026-02-25
**Domain:** Svelte 5 createContext, module singleton migration, co-located controller pattern
**Confidence:** HIGH

## Summary

The codebase currently uses a module-level singleton pattern throughout: every manager (`columnManager`, `rowManager`, `editManager`, `selectionManager`, `changeManager`, `historyManager`, `clipboardManager`, `validationManager`, `realtime`) is instantiated once at module load time and exported as a named constant. Grid components (`GridRow`, `GridOverlays`, `GridHeader`, `Toolbar`) import these singletons directly. The `+page.svelte` file is ~500+ lines and functions as both orchestrator and template. No `gridContext.svelte.ts` or `InventoryGrid.svelte` exists yet.

Svelte 5.40+ ships `createContext()` which returns a `[getter, setter]` tuple backed by a unique `Symbol` key — exactly the API the architecture targets. The setter (`setContext`) must be called during component initialisation (synchronously in `<script>`). The getter (`getContext`) can be called from any descendant component or `.svelte.ts` file during its own initialisation. The installed version is 5.49.1, so this API is confirmed available.

The migration strategy is: create `gridContext.svelte.ts` with the unified context definition, create `InventoryGrid.svelte` as the provider that calls the setter, remove all singleton imports from grid components replacing them with context getter calls, delete the old `utils/` tree once all consumers are updated. The `+page.svelte` becomes a thin shell that renders `<InventoryGrid />` with data props.

**Primary recommendation:** Define `gridContext.svelte.ts` as a module-level `[getGridContext, setGridContext]` pair; `InventoryGrid.svelte` calls `setGridContext({...})` in `<script>` to provide an object of mutable `$state` values; children call `getGridContext()` at their initialisation time to get the live reactive object.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**InventoryGrid shell:**
- Create `InventoryGrid.svelte` in Phase 1 (not deferred to Phase 2)
- Phase 1 moves the grid HTML template out of `+page.svelte` into `InventoryGrid.svelte`
- `+page.svelte` becomes a thin orchestrator that renders `<InventoryGrid />` and other top-level components
- `InventoryGrid.svelte` calls `setContext` to provide `gridContext` to all grid children
- Data (assets, user, metadata) stays in `+page.svelte` for now and is passed as props to `InventoryGrid` — full data ownership moves to `InventoryGrid` in Phase 2

**Manager pattern replaced entirely:**
- The old manager pattern (factory functions + module singleton exports) is deprecated and deleted
- New pattern: each feature = `.svelte.ts` controller co-located with its `.svelte` component
- Context holds **state signals** (e.g., `isEditing`, `activeCell`, `selection`), not manager instances
- Components activate/mount based on context signals
- Migration is **one-in, one-out**: each manager fully replaced before moving to the next

**Migration scope:**
- All 9 managers migrated in Phase 1: `columnManager`, `rowManager`, `editManager`, `selectionManager`, `changeManager`, `historyManager`, `clipboardManager`, `validationManager`, `realtimeManager`
- Migration order follows dependency graph (core → interaction → data/advanced)
- Singleton exports removed **globally** — admin, mobile, and audit pages lose their singleton imports too

**Singleton backward compatibility:**
- Admin/mobile/audit page breakage is **acceptable temporarily**
- Old `utils/` directory tree deleted entirely
- All new `.svelte.ts` controllers co-locate with their `.svelte` component

**Context granularity:**
- **One unified `gridContext`** — not multiple domain contexts
- Context holds **cross-component signals only**: `isEditing`, `activeCell`, `selection`, `hasUnsavedChanges`, `columnWidths`, `rowHeights`, `activeView`, etc.
- Transient component-internal state stays **local** as `$state`
- **No props for cross-component communication** — all sibling/cousin relationships through context
- **Children write directly to context state** — context exposes mutable `$state` that children mutate directly

### Claude's Discretion
- Exact `gridContext` interface shape (property names, grouping within the object)
- Migration order within the dependency graph (implementer decides the sequence)
- Whether any pure utility functions (e.g., date formatting, field constraint lists) get a `$lib/utils/` home or also co-locate

### Deferred Ideas (OUT OF SCOPE)
- Full data ownership move into `InventoryGrid` (assets array, server load data) — Phase 2
- Admin/mobile/audit page refactoring to the new pattern — follow-on phase
- FloatingEditor as autonomous positioned component — Phase 3
- ContextMenu as fully self-contained dispatcher — Phase 3
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| F1.1 | All grid-scoped managers provided via Svelte 5 `createContext` ([getter, setter] tuple) | `createContext()` confirmed in Svelte 5.49.1; returns `[() => T, (context: T) => T]` |
| F1.2 | No module-level singleton imported inside grid components | All 4 grid components (`GridRow`, `GridOverlays`, `GridHeader`, `Toolbar`) currently import singletons directly — all need updating |
| F1.3 | `gridContext.svelte.ts` exports typed getter/setter pairs for all shared grid state | File does not exist yet; pattern is straightforward with createContext |
| F1.4 | Global app-wide metadata may use lightweight global context | `realtime` already uses `Symbol.for` global — layout-level `setContext` works for truly app-wide state |
| F1.5 | Heavy data colocated in InventoryGrid as local `$state` | N/A for Phase 1 — data stays in `+page.svelte` as props until Phase 2 |
| NF1 | Zero regressions — all existing CRUD must work | Admin/mobile have NO util imports; only `+layout.svelte` imports `realtime` from utils |
| NF2 | Each phase leaves app deployable | One-in-one-out migration order enforces this |
| NF3 | `svelte-check` must pass after phase | All context types must be fully typed; use `ReturnType<typeof createGridContext>` pattern |
</phase_requirements>

---

## Standard Stack

### Core API

| API | Version | Purpose | Source |
|-----|---------|---------|--------|
| `createContext` | Svelte 5.40+ (installed: 5.49.1) | Returns `[getter, setter]` tuple with unique Symbol key | Confirmed in `/node_modules/svelte/src/internal/client/context.js` |
| `$state` rune | Svelte 5.x | Reactive state inside `.svelte.ts` files | Project already uses this pattern |
| `$derived` rune | Svelte 5.x | Computed values from state | Project already uses this pattern |
| `SvelteMap` | `svelte/reactivity` | Granular Map reactivity | Already used in `columnManager`, `rowManager` |

### The createContext Contract (verified from source)

```typescript
// From node_modules/svelte/src/internal/client/context.js line 81-94
// Returns [() => T, (context: T) => T]
export function createContext() {
  const key = {};  // unique object reference as Symbol
  return [
    () => {
      if (!hasContext(key)) e.missing_context();
      return getContext(key);
    },
    (context) => setContext(key, context)
  ];
}
```

**Critical constraint:** `setContext` must be called synchronously during component initialisation — in `<script>` tag, not inside `$effect` or async callbacks. In Svelte 5's async mode, calling `setContext` after an `await` throws `set_context_after_init`.

**`getContext` call site:** The getter from `createContext` can be called during any descendant component's `<script>` initialisation, or in a `.svelte.ts` file that is called during component init (i.e., when that file's functions are invoked from `<script>`).

### Installation

No new packages needed. All required APIs are in the installed `svelte@5.49.1`.

---

## Architecture Patterns

### Recommended Project Structure (post-Phase 1)

```
src/
├── routes/
│   ├── +page.svelte              # Thin orchestrator: renders <InventoryGrid />, passes data props
│   └── +layout.svelte            # Keeps realtime; realtime migrated to layout context or stays as-is
├── lib/
│   ├── components/
│   │   └── grid/
│   │       ├── InventoryGrid.svelte          # Context provider, grid template
│   │       ├── GridHeader.svelte             # Reads context for columnManager state
│   │       ├── GridRow.svelte                # Reads context instead of singleton imports
│   │       ├── GridOverlays.svelte           # Reads context instead of singleton imports
│   │       └── Toolbar.svelte                # Reads context instead of singleton imports
│   └── context/
│       └── gridContext.svelte.ts             # [getGridContext, setGridContext] + GridContext type
```

### Pattern 1: gridContext.svelte.ts — Context Definition File

This file lives at `$lib/context/gridContext.svelte.ts` (or `$lib/components/grid/gridContext.svelte.ts` — implementer's discretion per Claude's Discretion). It creates the `[getter, setter]` pair and exports the type.

```typescript
// $lib/context/gridContext.svelte.ts
import { createContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';

export type GridCell = { row: number; col: number };

export type GridContext = {
  // --- Edit state ---
  isEditing: boolean;
  activeCell: GridCell | null;
  inputValue: string;

  // --- Selection state ---
  selectionStart: GridCell;
  selectionEnd: GridCell;
  isSelecting: boolean;
  isHiddenAfterCopy: boolean;
  copyStart: GridCell;
  copyEnd: GridCell;
  isCopyVisible: boolean;

  // --- Change tracking ---
  hasUnsavedChanges: boolean;
  hasInvalidChanges: boolean;

  // --- Column / row geometry ---
  columnWidths: SvelteMap<string, number>;
  resizingColumn: string | null;

  // --- View ---
  activeView: string;

  // --- Keys (column order) ---
  keys: string[];
};

export const [getGridContext, setGridContext] = createContext<GridContext>();
```

### Pattern 2: InventoryGrid.svelte — Context Provider

`InventoryGrid.svelte` calls `setGridContext(...)` synchronously in `<script>`. It receives data as props from `+page.svelte`.

```svelte
<!-- $lib/components/grid/InventoryGrid.svelte -->
<script lang="ts">
  import { setGridContext } from '$lib/context/gridContext.svelte.ts';
  import { SvelteMap } from 'svelte/reactivity';
  import type { GridContext } from '$lib/context/gridContext.svelte.ts';

  type Props = {
    assets: Record<string, any>[];
    keys: string[];
    user: SafeUser | null;
    // ...other data props from +page.svelte
  };
  let { assets, keys, user }: Props = $props();

  // Create mutable $state object — children mutate this directly
  const ctx = $state<GridContext>({
    isEditing: false,
    activeCell: null,
    inputValue: '',
    selectionStart: { row: -1, col: -1 },
    selectionEnd: { row: -1, col: -1 },
    isSelecting: false,
    isHiddenAfterCopy: false,
    copyStart: { row: -1, col: -1 },
    copyEnd: { row: -1, col: -1 },
    isCopyVisible: false,
    hasUnsavedChanges: false,
    hasInvalidChanges: false,
    columnWidths: new SvelteMap(),
    resizingColumn: null,
    activeView: 'default',
    keys: keys,
  });

  // Provide context to all descendants
  setGridContext(ctx);
</script>

<!-- grid template markup here -->
```

### Pattern 3: Consumer Component — Reading Context

Children call `getGridContext()` during their `<script>` initialisation. The returned object is the same live `$state` reference — mutations propagate reactively.

```svelte
<!-- $lib/components/grid/GridRow.svelte -->
<script lang="ts">
  import { getGridContext } from '$lib/context/gridContext.svelte.ts';

  // Called during component initialisation — safe
  const ctx = getGridContext();

  // Children write directly: ctx.isEditing = true
  // Children read: ctx.activeCell?.row
</script>
```

### Pattern 4: Co-located .svelte.ts Controller

Logic that previously lived in `utils/interaction/editManager.svelte.ts` moves to a co-located controller. The controller receives the context object and operates on it.

```typescript
// $lib/components/grid/floating-editor/floatingEditor.svelte.ts
import { getGridContext } from '$lib/context/gridContext.svelte.ts';

export function createFloatingEditorController() {
  const ctx = getGridContext();  // called during component init

  function startEdit(row: number, col: number, key: string, currentValue: string) {
    ctx.isEditing = true;
    ctx.activeCell = { row, col };
    ctx.inputValue = currentValue;
    // expand column width via ctx.columnWidths.set(key, expandedWidth)
  }

  function cancel() {
    ctx.isEditing = false;
    ctx.activeCell = null;
    ctx.inputValue = '';
  }

  return { startEdit, cancel };
}
```

### Pattern 5: +page.svelte as Thin Orchestrator

After migration, `+page.svelte` passes data and receives no state back from `InventoryGrid`. It only renders top-level components.

```svelte
<!-- routes/+page.svelte (post-Phase 1) -->
<script lang="ts">
  import type { PageProps } from './$types';
  import InventoryGrid from '$lib/components/grid/InventoryGrid.svelte';

  let { data }: PageProps = $props();
</script>

<InventoryGrid
  assets={data.assets}
  keys={data.keys}
  user={data.user}
/>
```

### Anti-Patterns to Avoid

- **Calling `setGridContext` inside `$effect`:** Context must be set synchronously in `<script>`, not reactively. Svelte will throw `set_context_after_init` in async mode.
- **Calling `getGridContext()` at module level (outside a component):** The getter checks `hasContext(key)` and throws `missing_context` if no parent has set it. Must be called during component initialisation.
- **Storing manager instances in context:** The decision is to store state signals (`isEditing: boolean`) directly in context, not manager objects. Controllers live in `.svelte.ts` files, not in context.
- **Passing context values as props between siblings:** All cross-component state goes through context. Props are only for data flowing from `+page.svelte` down to `InventoryGrid`.
- **Partial migration:** One-in-one-out is mandatory. A manager's singleton export is deleted only after all consumers are updated.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Type-safe context | Manual `Symbol` key + typed `getContext<T>` | `createContext<T>()` from `svelte` | Built-in since 5.40, already installed |
| Reactive Map | Plain `Map` with manual triggers | `SvelteMap` from `svelte/reactivity` | Already used in `columnManager`; granular per-key reactivity |
| Deep reactive objects | `$state({ nested: { obj: {} } })` with manual spread | Svelte 5 deep reactivity — `$state` is deeply reactive by default | Svelte 5 proxies nested objects automatically |

**Key insight:** Svelte 5's `$state()` on a plain object creates a deep reactive proxy. When `InventoryGrid` creates `const ctx = $state<GridContext>({...})` and passes it to `setGridContext(ctx)`, children that read `ctx.isEditing` will reactively update when any component writes `ctx.isEditing = true`. No manual subscription or event system needed.

---

## Common Pitfalls

### Pitfall 1: getGridContext() called outside component tree
**What goes wrong:** A `.svelte.ts` file calls `getGridContext()` at module load time, not during component initialisation. Throws `missing_context` because no component has called `setGridContext` yet.
**Why it happens:** The factory function pattern — `createEditManager()` is called at module level when the singleton is initialised.
**How to avoid:** `.svelte.ts` controller files must export a factory function (e.g., `createEditController()`), not a top-level instance. The factory is called from the component's `<script>`, which is the correct initialisation time.
**Warning signs:** `missing_context` error at runtime; TypeScript won't catch this.

### Pitfall 2: setGridContext called after an await in async components
**What goes wrong:** In Svelte 5's async mode, `setContext` after `await` throws `set_context_after_init`.
**Why it happens:** Component does async work before establishing context.
**How to avoid:** Always call `setGridContext(ctx)` at the top of `<script>`, before any `await` or `$effect`. The state object is created synchronously; it can be mutated asynchronously later.

### Pitfall 3: SvelteMap vs plain Map for columnWidths
**What goes wrong:** Using `columnWidths: new Map()` in the context object. When a child does `ctx.columnWidths.set(key, width)`, Svelte 5 deep proxy does NOT intercept `Map.prototype.set` — plain `Map` mutations are not reactive.
**Why it happens:** Svelte 5's deep reactivity works on plain object properties; it does not wrap native `Map` methods.
**How to avoid:** Use `columnWidths: new SvelteMap()`. This is exactly how the current `columnManager.svelte.ts` already handles it.

### Pitfall 4: realtime singleton in +layout.svelte
**What goes wrong:** `+layout.svelte` imports `realtime` directly from the old singleton path. When `utils/interaction/realtimeManager.svelte.ts` is deleted, this breaks the layout (header WS indicator, connection management).
**Why it happens:** `realtime` is uniquely managed — it uses `Symbol.for('APP_REALTIME_MANAGER')` to prevent duplicate instances and is initialised in the layout, not the grid page.
**How to avoid:** `realtime` is not a grid concern — it should NOT be in `gridContext`. Options: (a) keep it as a module singleton but with the symbol guard pattern, OR (b) provide it via a separate layout-level context. Either way, the layout's `realtime.connect()` call must continue working. This is the ONE manager that crosses the grid boundary — handle it separately.

### Pitfall 5: svelte-check fails due to missing context type
**What goes wrong:** `getGridContext()` returns `T` (the generic) but TypeScript infers `unknown` if the type parameter isn't specified at `createContext<GridContext>()` call time.
**Why it happens:** `createContext()` without a type parameter returns `[() => unknown, (context: unknown) => unknown]`.
**How to avoid:** Always specify the type: `createContext<GridContext>()`. Export the `GridContext` type from `gridContext.svelte.ts` so consumers can reference it.

### Pitfall 6: changeManager imports validationManager as singleton
**What goes wrong:** `changeManager.svelte.ts` imports `{ validationManager }` from `validationManager.svelte.ts` at the top of the file (line 1). When `validationManager`'s singleton export is deleted, `changeManager` breaks.
**Why it happens:** Cross-manager singleton dependency — changeManager delegates to validationManager for constraint checks.
**How to avoid:** `validationManager` must be migrated before `changeManager` in the dependency order. The new `changeManager` controller receives constraints either through the context object or as a parameter.

### Pitfall 7: rowGenerationManager imports validationManager as singleton
**What goes wrong:** Same as pitfall 6 — `rowGenerationManager.svelte.ts` also imports `validationManager` directly at line 8.
**How to avoid:** Same solution — migrate `validationManager` first.

---

## Code Examples

### Verified: createContext signature (from installed source)

```typescript
// Source: node_modules/svelte/src/internal/client/context.js line 72-94
// @since 5.40.0
// Returns [() => T, (context: T) => T]
export function createContext<T>(): [() => T, (context: T) => T]
```

The getter throws if no parent set the context. The setter returns the context value (pass-through).

### Verified: SvelteMap for reactive Map state

```typescript
// Source: svelte/reactivity (already imported in columnManager.svelte.ts)
import { SvelteMap } from 'svelte/reactivity';

const widths = new SvelteMap<string, number>();
// widths.set(key, value) — reactive
// widths.get(key) — reactive read
// {#each widths.entries() as [k, v]} — reactive iteration
```

### Verified: $state deep reactivity on plain objects

```typescript
// Svelte 5 proxies nested plain objects automatically
const ctx = $state({
  activeCell: { row: -1, col: -1 },  // nested object is reactive
  columnWidths: new SvelteMap(),       // SvelteMap for Map reactivity
});

// This triggers reactive updates in all readers:
ctx.activeCell.row = 5;
ctx.activeCell = { row: 5, col: 3 };  // both forms work
```

### Verified: .svelte.ts files can use runes at module level

```typescript
// gridContext.svelte.ts — .svelte.ts extension enables runes
// $state, $derived work at top level in .svelte.ts files
// createContext() must still be called at module level (not inside a function body
// that executes at component init) — it creates the key object, not the context value
```

---

## Manager Dependency Graph

This graph determines safe migration order (core → interaction → data/advanced):

```
validationManager      (no internal util deps — migrate FIRST)
columnManager          (no internal util deps — migrate FIRST)
rowManager             (no internal util deps — migrate FIRST)
viewManager            (no internal util deps — migrate FIRST)
sortManager            (no internal util deps — can migrate early)

editManager            (depends on columnManager + rowManager — migrate AFTER those)
selectionManager       (no util deps — migrate early, but used by clipboard)
historyManager         (no util deps — migrate early)

changeManager          (depends on validationManager — migrate AFTER validation)
rowGenerationManager   (depends on validationManager — migrate AFTER validation)
clipboardManager       (depends on selectionManager — migrate AFTER selection)

realtimeManager        (special: layout-level, NOT in gridContext — handle separately)
```

**Recommended order:**
1. `validationManager` (leaf — no deps)
2. `columnManager` (leaf — no deps)
3. `rowManager` (leaf — no deps)
4. `selectionManager` (leaf — no deps; clipboard depends on it)
5. `historyManager` (leaf — no deps)
6. `editManager` (depends on column + row)
7. `changeManager` (depends on validation)
8. `rowGenerationManager` (depends on validation)
9. `clipboardManager` (depends on selection)
10. `sortManager` + `viewManager` (grid-wide, can be in context or local to InventoryGrid)
11. `realtimeManager` (handled separately — layout concern)

---

## What Stays Out of gridContext

The following managers are either not grid-scoped or have special lifecycle needs:

| Manager | Where It Lives (Post-Phase 1) | Reason |
|---------|------------------------------|--------|
| `realtimeManager` | Layout-level singleton or layout context | Initialised in `+layout.svelte`, persists across navigation, has `Symbol.for` ghost-killer |
| `searchManager` | `+page.svelte` local `$state` or InventoryGrid prop | Data-layer concern, URL-driven, not shared across grid components |
| `sortManager` | `InventoryGrid.svelte` local state or context | Currently only used by GridHeader — may go in context if Toolbar needs it |
| `viewManager` | `InventoryGrid.svelte` local state | View selection is page-level, not inter-component |
| `virtualScrollManager` | `InventoryGrid.svelte` local state | Created with `createVirtualScroll()` — already factory pattern, not singleton |

**Note:** `sortManager` is imported by both `GridHeader.svelte` and `Toolbar.svelte` directly from singletons — it likely needs to be in context to avoid prop drilling.

---

## Current Singleton Imports in Grid Components

Exact files and line numbers that need updating:

**GridRow.svelte** (imports 4 singletons):
- `editManager` from `utils/interaction/editManager.svelte`
- `selection` from `utils/interaction/selectionManager.svelte`
- `columnManager` from `utils/core/columnManager.svelte`
- `rowManager` from `utils/core/rowManager.svelte`
- `toastState` from `utils/ui/toast/toastState.svelte` (UI singleton — can stay as singleton)

**GridOverlays.svelte** (imports 3 singletons):
- `selection` from `utils/interaction/selectionManager.svelte`
- `columnManager` from `utils/core/columnManager.svelte`
- `changeManager` from `utils/interaction/changeManager.svelte`
- `rowGenerationManager` from `utils/interaction/rowGenerationManager.svelte`

**GridHeader.svelte** (imports 2 singletons):
- `columnManager` from `utils/core/columnManager.svelte`
- `sortManager` from `utils/data/sortManager.svelte`

**Toolbar.svelte** (imports 3 singletons):
- `searchManager` from `utils/data/searchManager.svelte`
- `changeManager` from `utils/interaction/changeManager.svelte`
- `rowGenerationManager` from `utils/interaction/rowGenerationManager.svelte`
- `viewManager` from `utils/core/viewManager.svelte`

**+layout.svelte** (imports 1 singleton outside grid):
- `realtime` from `utils/interaction/realtimeManager.svelte` — handled separately

**+page.svelte** (imports all singletons — becomes orchestrator):
- All 13 singleton/factory imports move into InventoryGrid or co-located controllers

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `setContext(key, value)` with string keys | `createContext<T>()` returning `[getter, setter]` | Svelte 5.40 | Type-safe, no magic strings, getter throws if not provided |
| Svelte 4 `<slot />` | `{@render children()}` snippet pattern | Svelte 5.0 | Context providers use render instead of slots |
| Module-level singletons | `createContext` + component-scoped instances | This phase | Fixes SSR leakage, enables multiple instances, proper cleanup |

**Deprecated/outdated:**
- Module-level `export const manager = createManager()`: Works in client-only apps but leaks state between SSR requests. This project appears client-only (no SSR grid), but the pattern is still an architectural smell.
- String/Symbol keys with `setContext/getContext` directly: Still works but `createContext()` is the type-safe successor. Use `createContext()`.

---

## Open Questions

1. **realtimeManager migration path**
   - What we know: `+layout.svelte` imports `realtime` and calls `realtime.connect(sessionId)` in `$effect`. The `realtime` object uses `Symbol.for('APP_REALTIME_MANAGER')` as a ghost-killer to prevent duplicate instances.
   - What's unclear: Should `realtime` become a layout-level context (provided by `+layout.svelte` via a separate `[getRealtimeContext, setRealtimeContext]`) or remain as a guarded module singleton?
   - Recommendation: Keep `realtime` as a guarded module singleton for Phase 1 — it already has the `Symbol.for` guard and the layout is NOT being refactored this phase. Delete/refactor only in the layout follow-on phase.

2. **sortManager and viewManager scope**
   - What we know: `sortManager` is used by `GridHeader` AND needs to affect the data passed down from `+page.svelte`. `viewManager` drives what columns are shown.
   - What's unclear: Should these be in `gridContext` (so all components see them) or local to `InventoryGrid` with callbacks up to `+page.svelte`?
   - Recommendation: Put `sortManager` state (`sortKey`, `sortDirection`) in `gridContext` since both header and data derivation need it. `viewManager` state (`activeView`) also goes in context.

3. **toastState singleton**
   - What we know: `GridRow.svelte` imports `toastState` from `utils/ui/toast/toastState.svelte`. The toast container renders in `+layout.svelte`.
   - What's unclear: The CONTEXT.md says the old `utils/` tree is deleted entirely — but `ToastContainer` is currently in `utils/ui/toast/`.
   - Recommendation: `toastState` is a pure UI singleton with no grid coupling. Keep it as a module singleton, but move the file to `$lib/components/toast/` to avoid deletion during `utils/` cleanup.

---

## Sources

### Primary (HIGH confidence)
- Svelte 5.49.1 source at `/node_modules/svelte/src/internal/client/context.js` — `createContext`, `setContext`, `getContext` implementation verified
- Svelte 5.49.1 source at `/node_modules/svelte/src/index-client.js` — confirmed `createContext` export
- All 9 manager files read directly from `/frontend/src/lib/utils/` — singleton patterns, cross-dependencies, and public APIs documented from source
- All 4 grid component files read directly — singleton import sites catalogued

### Secondary (MEDIUM confidence)
- Svelte 5 changelog / memory: `createContext` added in 5.40; version 5.49.1 installed confirms availability

### Tertiary (LOW confidence)
- None — all findings verified from installed source code

---

## Metadata

**Confidence breakdown:**
- createContext API: HIGH — read from installed source
- Singleton dependency graph: HIGH — read from all manager source files
- Migration order: HIGH — derived from actual import statements
- gridContext interface shape: MEDIUM — Claude's Discretion; interface suggestion is reasoned from what components currently read from singletons
- realtimeManager handling: MEDIUM — special case with globalThis guard; staying out of gridContext is safest

**Research date:** 2026-02-25
**Valid until:** 2026-03-25 (Svelte 5 stable branch; unlikely to change createContext API)
