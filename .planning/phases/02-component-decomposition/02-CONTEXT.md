# Phase 2: Component Decomposition - Context

**Gathered:** 2026-02-25 (updated with Spelunker architecture session)
**Status:** Ready for planning

<domain>
## Phase Boundary

Break the 1300-line InventoryGrid.svelte monolith into properly scoped, self-sufficient components. Each component owns its concern and reads from context directly. No new features — structural cleanup only. Introduces the two-layer cake viewport model, event delegation, translateY virtual scroll, and custom synthetic scrollbars.

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
- Renders the structural shell: `<Toolbar />`, `<GridContainer />`, `<ContextMenu />`, `<ToastContainer />`
- Page-level concerns (URL sync, search state, realtime connection) belong here, not in grid components
- Grid children are self-sufficient via context — minimal props from +page.svelte

### Two-layer cake viewport — GridContainer (Spelunker model)
GridContainer renders two stacked layers inside a single scroll chunk:

**Layer 1 — data-layer (dumb rendering):**
- Pure `{#each grid.visibleRows}` loop rendering cells as plain divs
- Cells have `data-row` and `data-col` attributes — zero event listeners
- No business logic, no conditionals for editors/menus

**Layer 2 — GridOverlay (interaction layer):**
- Absolutely positioned on top of the data layer
- Both layers shift together via the same `transform: translateY` on the virtual-chunk wrapper
- `pointer-events: none` by default — clicks pass through to data-layer
- Interactive children (FloatingEditor in Phase 3, contextmenu trigger) re-enable `pointer-events` explicitly
- **GridOverlay is a child of GridContainer, NOT a sibling in +page.svelte**
- Phase 2 overlay renders: selection borders, dirty cell highlights, multiplayer presence boxes
- FloatingEditor mount is Phase 3 — Phase 2 overlay does not include it

### Keyboard handling — moves to GridOverlay in Phase 2
- GridOverlay holds focus and handles all keyboard shortcuts
- Uses Svelte 5's `{@attach}` directive: `<div {@attach gridShortcuts()}>` (see research requirement below)
- **RESEARCH REQUIRED:** `{@attach}` directive was introduced after August 2025 cutoff. Researcher must fetch https://svelte.dev/docs/svelte/@attach and web search for usage patterns before planning keyboard handling.
- Existing `createInteractionHandler` factory is replaced by the `{@attach}` approach

### Event delegation — all mouse events (Spelunker model)
- A single `onclick`, `oncontextmenu`, and mouseover handler sits on the **data-layer wrapper div**
- Cell identity resolved via `event.target.dataset.row` / `event.target.dataset.col` attributes
- **All** mouse events are delegated: clicks, right-clicks, hover (multiplayer presence)
- Individual cells have zero event listeners — GridRow is purely display

### GridRow stays as a thin component
- GridRow.svelte remains as a child component of GridContainer's data-layer loop
- Renders cell divs with `data-row`, `data-col` attributes and display text
- Can receive display props (asset row data, keys) — passed where useful
- Zero event handlers on GridRow or its cells
- Thin enough to be nearly invisible in the architecture

### Virtual scroll — translateY model (rewritten from scratch)
- The current virtualScrollManager is rewritten for the new translateY architecture
- `transform: translateY({offsetY}px)` on the virtual-chunk wrapper positions visible rows
- The scroll container is a fixed-height viewport with a spacer element for scroll height
- **Custom synthetic scrollbars (horizontal + vertical)** — no native browser scrollbars
  - Full CSS styling control (not available with native scrollbars across browsers)
  - Phase 2 implements both scrollbar components as part of GridContainer
  - Horizontal scrollbar for wide grids; vertical scrollbar for tall datasets
- ResizeObserver for container height — Claude's discretion on exact implementation
- virtualScrollManager API designed for the translateY model from the ground up

### Self-sufficient children (each reads context directly)
- `GridOverlays.svelte` — reads selection/copy/dirty state from ctx; renders overlays; child of GridContainer
- `Toolbar.svelte` — reads `ctx.sortKey`, `ctx.activeView`, `ctx.hasUnsavedChanges` directly
- `ContextMenu` — reads `ctx.contextMenuTarget` signal, self-positions when set
- Search/URL state — page-level concern, stays in +page.svelte

### syncQueue — deferred to Phase 4
- The dual-track event queue (syncQueue.svelte.ts / Spelunker "Quake" model) is NOT introduced in Phase 2
- Phase 2 stays purely structural
- syncQueue lands as Plan 1 of Phase 4 (DB-side filtering) — introduced with its first consumer

### File structure — controllers vs components
- Files without a `.svelte` sibling are utilities
- Pure controllers (`.svelte.ts` only) move to `lib/grid/utils/`
- True component pairs (`.svelte` + `.svelte.ts`) move to `lib/grid/components/`

**Controllers to move to `lib/grid/utils/`:**
gridEdit, gridChanges, gridColumns, gridRows, gridSelection, gridHistory, gridClipboard, gridValidation, rowGeneration, virtualScrollManager

**Component pairs to move to `lib/grid/components/`:**
contextMenu, editDropdown, filterPanel, headerMenu, autocomplete

### Claude's Discretion
- Exact virtualScrollManager API surface (offsetY computation, scroll event integration)
- ResizeObserver implementation details
- Custom scrollbar component internals (drag behavior, track sizing)
- Import path conventions within lib/grid/
- Exact pointer-events CSS strategy for overlay interactive children

</decisions>

<specifics>
## Specific Ideas

- "The grid IS the app" — no portability concern, no need for a wrapper component
- Spelunker architecture: Strict Modular Decoupling + High Performance — 60fps with thousands of rows
- Two-layer cake is the key insight: dumb data grid (layer 1) + interaction overlay (layer 2) on a single translateY-shifted chunk. Both layers always in sync without CSS tricks.
- Event delegation eliminates ~450 event listeners (30 visible rows × 15 keys) down to 3-4 permanent listeners — significant for scroll performance
- Custom synthetic scrollbars have been a visual goal from the start — Phase 2 is where they land
- `{@attach}` directive is Svelte 5-native — use it for keyboard binding rather than imperative addEventListener in a factory function

</specifics>

<deferred>
## Deferred Ideas

- **FloatingEditor in GridOverlay** — Phase 3. Phase 2 overlay reserves the mount point structure but doesn't implement the editor.
- **syncQueue (Quake dual-track event engine)** — Phase 4 Plan 1. Introduced when DB filter fetch is the first consumer.
- **Cascading dropdown filters via $derived in GridHeaders** — Phase 4. Client-side derived options from visible data.
- **Optimistic UI + rollback via history.undo()** — Phase 5 (Undo/Redo Engine).
- **Go server queue / lock arbitration (Last Write Wins prevention)** — Phase 7 (WebSocket Delta Sync).
- **WebSocket WS_CELL_EDIT event type in syncQueue** — Phase 7.

</deferred>

---

*Phase: 02-component-decomposition*
*Context updated: 2026-02-25 (Spelunker architecture session)*
