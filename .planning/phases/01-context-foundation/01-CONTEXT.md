# Phase 1: Context Foundation - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace all module-level singletons in the grid path with Svelte 5 `createContext`-based architecture. Establish the structural backbone: a single `gridContext` holding reactive state signals, and a new `.svelte` + `.svelte.ts` co-located pattern replacing the old manager pattern. `+page.svelte` becomes an orchestrator. The grid template moves into `InventoryGrid.svelte`. `svelte-check` must pass at the end.

</domain>

<decisions>
## Implementation Decisions

### InventoryGrid shell
- Create `InventoryGrid.svelte` in Phase 1 (not deferred to Phase 2)
- Phase 1 moves the grid HTML template out of `+page.svelte` into `InventoryGrid.svelte` — necessary because Svelte 5 has no `<slot />` (uses `{@render children()}` pattern, but we go further)
- `+page.svelte` becomes a thin orchestrator that renders `<InventoryGrid />` and other top-level components
- `InventoryGrid.svelte` calls `setContext` to provide `gridContext` to all grid children
- Data (assets, user, metadata) stays in `+page.svelte` for now and is passed as props to `InventoryGrid` — full data ownership moves to `InventoryGrid` in Phase 2

### Manager pattern replaced entirely
- The old manager pattern (factory functions + module singleton exports) is **deprecated and deleted**
- New pattern: each feature = `.svelte.ts` controller co-located with its `.svelte` component
- Context holds **state signals** (e.g., `isEditing`, `activeCell`, `selection`), not manager instances
- Components activate/mount based on context signals (e.g., `isEditing = true` → `FloatingEditor` renders)
- Migration is **one-in, one-out**: each manager is fully replaced (old file deleted, all consumers updated) before moving to the next — no partial migrations

### Migration scope
- All 9 managers migrated in Phase 1: `columnManager`, `rowManager`, `editManager`, `selectionManager`, `changeManager`, `historyManager`, `clipboardManager`, `validationManager`, `realtimeManager`
- Migration order follows dependency graph (core → interaction → data/advanced) to avoid cross-wire issues
- Singleton exports removed **globally** — admin, mobile, and audit pages lose their singleton imports too

### Singleton backward compatibility
- Admin/mobile/audit page breakage is **acceptable temporarily** — those pages will be fixed in a dedicated follow-on phase
- All pages will eventually use the same `.svelte` + `.svelte.ts` + context pattern — no exceptions
- Old `utils/` directory tree (`core/`, `interaction/`, `data/`, `ui/`) is **deleted entirely** — nothing stays there
- All new `.svelte.ts` controllers **co-locate with their `.svelte` component** (e.g., `FloatingEditor.svelte` + `floatingEditor.svelte.ts` in `components/grid/floating-editor/`)

### Context granularity
- **One unified `gridContext`** — not multiple domain contexts
- Context holds **cross-component signals only**: `isEditing`, `activeCell` (row + col coords), `selection` (range), `hasUnsavedChanges`, `columnWidths`, `rowHeights`, `activeView`, etc.
- Transient component-internal state (e.g., which dropdown item is highlighted, textarea scroll offset) stays **local to the component** as `$state`
- **No props for cross-component communication** — all sibling/cousin relationships go through context (GridContainer ↔ FloatingEditor, GridRow ↔ GridOverlays, InventoryGrid ↔ ContextMenu, InventoryGrid ↔ toolbar)
- **Children write directly to context state** — context exposes mutable `$state` that children can mutate directly (no callback functions needed in context)

### Claude's Discretion
- Exact `gridContext` interface shape (property names, grouping within the object)
- Migration order within the dependency graph (implementer decides the sequence)
- Whether any pure utility functions (e.g., date formatting, field constraint lists) get a `$lib/utils/` home or also co-locate

</decisions>

<specifics>
## Specific Ideas

- "Clicking edit updates the global context to `isEditing` and spawns the edit component" — the FloatingEditor mounts reactively when `isEditing` is set in context, not by being told to mount
- Each `.svelte` + `.svelte.ts` pair should be self-contained: the `.svelte.ts` reads/writes context and the `.svelte` renders based on that state
- `+page.svelte` as orchestrator = renders `<InventoryGrid />`, `<ToastContainer />`, etc. at the top level — it does NOT contain grid markup

</specifics>

<deferred>
## Deferred Ideas

- Full data ownership move into `InventoryGrid` (assets array, server load data) — scoped to Phase 2
- Admin/mobile/audit page refactoring to the new pattern — follow-on phase after Phase 1
- FloatingEditor as autonomous positioned component — scoped to Phase 3
- ContextMenu as fully self-contained dispatcher — scoped to Phase 3

</deferred>

---

*Phase: 01-context-foundation*
*Context gathered: 2026-02-25*
