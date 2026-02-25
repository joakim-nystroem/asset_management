# Phase 2: Component Decomposition - Context

**Gathered:** 2026-02-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Break the 1300-line InventoryGrid.svelte monolith into properly scoped, self-sufficient components. Each component owns its concern and reads from context directly. No new features — structural cleanup only.

</domain>

<decisions>
## Implementation Decisions

### InventoryGrid.svelte gets deleted
- The grid IS the app. There is no need for a portable grid wrapper.
- InventoryGrid.svelte was always +page.svelte under a different name.
- Its responsibilities return to +page.svelte (context setup, structural orchestration) or move to self-sufficient child components.
- After Phase 2: `+page.svelte` sets up gridContext and renders grid children directly.

### +page.svelte becomes the context owner
- Calls `setGridContext(ctx)` — context setup lives here
- Renders the structural shell: `<Toolbar />`, `<GridContainer />`, `<GridOverlays />`, menus
- Page-level concerns (URL sync, search state, realtime connection) belong here, not in grid components
- Grid components receive nothing from +page.svelte except what the route load function provides (assets, keys, user)

### GridContainer — the viewport (new component)
- New `GridContainer.svelte`: virtual scroll + row rendering only
- Reads `assets`, `keys`, `virtualScroll` from context
- Renders `<GridRow />` for visible rows
- Emits raw interaction signals to context (right-click coordinates, hover, cell focus)
- Zero knowledge of menus, overlays, editors — those are siblings

### Self-sufficient children (each reads context directly)
- `GridOverlays.svelte` — reads `ctx.selectionStart/End`, `ctx.copyRegion` and renders its own overlays. InventoryGrid should not be computing overlay state.
- `Toolbar.svelte` — reads `ctx.sortKey`, `ctx.sortDirection`, `ctx.activeView` directly
- `ContextMenu` — reads `ctx.contextMenuTarget` signal, self-positions when set
- Keyboard handling (copy/paste, undo/redo) — moves out of InventoryGrid into a dedicated handler or onto GridContainer's root element
- Search/URL state — page-level concern, stays in or near +page.svelte

### File structure — controllers vs components
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

</decisions>

<specifics>
## Specific Ideas

- "The grid IS the app" — no portability concern, no need for a wrapper component
- InventoryGrid became a monolith because Phase 1 moved ALL of +page.svelte into it, including page-level concerns (URL sync, search, realtime) that never belonged in a grid component
- The real decomposition is about making children self-sufficient via context, not about creating new files to hold the same logic

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-component-decomposition*
*Context gathered: 2026-02-25*
