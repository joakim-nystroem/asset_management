# Phase 3: FloatingEditor & ContextMenu - Context

**Gathered:** 2026-02-25 (synthesized from Spelunker architecture doc + Phase 2 decisions)
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract the inline cell editor out of GridRow into an autonomous `<FloatingEditor>` component. Verify ContextMenu is fully self-contained via context. No new grid features — purely structural: GridRow becomes a display-only component, the editor becomes an autonomous overlay child.

</domain>

<decisions>
## Implementation Decisions

### FloatingEditor placement — inside GridOverlay (Layer 2)
- FloatingEditor lives **inside GridOverlay** (the interaction overlay, Layer 2 of the two-layer cake)
- GridOverlay is inside the `virtual-chunk` div that does `transform: translateY(offsetY)` — FloatingEditor automatically shifts with scroll
- Positioned absolutely at cell-relative coordinates (row × rowHeight gives Y offset; column offset gives X)
- No need to account for viewport scroll position — the translateY takes care of it
- Unmounts when no cell is in edit mode (`$derived` conditional render off `ctx.activeEdit`)
- Roadmap says "outside GridContainer" — this referred to the old architecture where GridContainer meant everything. In the new model, GridOverlay IS the correct layer.

### FloatingEditor edit lifecycle
- **Mounting**: FloatingEditor renders only when `ctx.activeEdit !== null` — the overlay conditionally includes it
- **Saving**: Dispatches save via a context callback (Fast Lane → syncQueue `LOCAL_COMMIT_EDIT` event)
- **Cancelling**: Escape key triggers cancel via context callback — clears `ctx.activeEdit` without committing
- **Local typing**: Stays in Fast Lane (synchronous, no queue) — drafts update local state only
- **Blur behavior**: Claude's discretion — whether blur triggers save or cancel depends on the cell type

### Sub-component routing inside FloatingEditor
- FloatingEditor reads `ctx.activeEdit.cellType` (or equivalent) to decide which editor to render
- Three modes: `textarea` (free-text), `EditDropdown` (enum/select), `Autocomplete` (foreign-key lookup)
- Sub-components are conditionally rendered inside FloatingEditor — not swapped via prop
- FloatingEditor owns the positioning wrapper; the active sub-component fills it

### GridRow cleanup
- Remove all inline textarea/editor markup from GridRow.svelte
- GridRow becomes pure display: renders cell `<div>` elements with `data-row`, `data-col`, display text
- Zero event listeners on GridRow or its cells — event delegation on the data-layer wrapper handles all clicks

### ContextMenu — escape hatch, already in +page.svelte
- ContextMenu is already in `+page.svelte` template, rendered as a `position: fixed` escape hatch (per Spelunker model and Phase 2)
- Phase 3 scope: verify it reads `ctx.contextMenuTarget` directly from context and self-positions when set
- If it currently receives props instead of reading context, refactor to be self-contained
- No new ContextMenu features — just ensure it's architecturally clean

### syncQueue — NOT introduced in Phase 3
- The dual-track event engine (syncQueue.svelte.ts) is still deferred to Phase 4
- Phase 3 commit path calls the API directly (existing pattern) — syncQueue wraps it in Phase 4
- FloatingEditor's save callback follows the existing commit mechanism

### Claude's Discretion
- Exact coordinates calculation for positioning FloatingEditor within GridOverlay
- Blur-triggers-save vs blur-triggers-cancel decision per cell type
- Animation/transition on FloatingEditor mount/unmount (or none)
- How `ctx.activeEdit` is structured (coords + cellType + initialValue, or similar)

</decisions>

<specifics>
## Specific Ideas

- Spelunker architecture: "The `<FloatingEditor>` input (mounted only when editing)" is explicitly listed as part of Layer 2 (interaction overlay) — this is the authoritative placement
- Fast Lane principle: Typing in FloatingEditor must never hit the network queue — local draft state only until explicit save
- "Escape Hatches (position: fixed, immune to overflow clipping): ContextMenu, ToastContainer" — ContextMenu's placement in +page.svelte is intentional and correct from the Spelunker model
- GridRow must become invisible in the architecture — "thin enough to be nearly invisible" per Phase 2 decisions

</specifics>

<deferred>
## Deferred Ideas

- **syncQueue wrapping FloatingEditor commits** — Phase 4. Phase 3 uses direct API call; Phase 4 migrates to queue.
- **Optimistic UI + rollback on failed commit** — Phase 5 (Undo/Redo Engine).
- **Multiplayer typing indicators in GridOverlay** — Phase 7 (WebSocket Delta Sync).

</deferred>

---

*Phase: 03-floating-editor-context-menu*
*Context gathered: 2026-02-25 (Spelunker architecture synthesis)*
