# Architecture Realignment + Bug Fixes - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Scope

Fix the three diagnosed bugs in `.planning/debug/` AND realign the grid architecture to the correct Svelte 5 context pattern. The bugs stem from an incorrect architecture where `+page.svelte` acts as a god controller (1,199 lines) instead of a thin wrapper.

### Bugs to Fix
1. **Context menu in new-row mode** — `e.preventDefault()` only called inside `contextMenu.open()`, never reached when `closest()` fails
2. **Drag selection broken** — `onmouseenter` doesn't bubble; must use `onmouseover` for event delegation
3. **FloatingEditor font size** — textarea missing `text-xs` class

### Architecture to Realign
The current monolithic `GridContext` (80+ fields, single `[getter, setter]`) must be split into multiple small, focused contexts. `+page.svelte` must become a thin shell. Components must own their own behavior.

</domain>

<decisions>
## Implementation Decisions

### Context Pattern — Multiple Small Contexts
- **Split the monolithic `GridContext` into ~10 separate contexts**, one per controller domain
- Each context gets its own `createContext<T>()` call returning `[get*Context, set*Context]`
- Contexts are pure type + `createContext()` — no logic, no defaults, no factories
- All contexts defined in `gridContext.svelte.ts` (or renamed to `contexts.svelte.ts`)

**Approximate contexts:**
- `editingContext` — isEditing, editKey, editRow, editCol, inputValue, editOriginalValue
- `selectionContext` — selectionStart, selectionEnd, isSelecting, dirtyCells
- `clipboardContext` — copyStart, copyEnd, isCopyVisible, isHiddenAfterCopy
- `columnContext` — keys, columnWidths, resizingColumn
- `rowContext` — rowHeights
- `sortContext` — sortKey, sortDirection
- `validationContext` — validationConstraints, hasInvalidChanges
- `changeContext` — hasUnsavedChanges, dirtyCells
- `dataContext` — assets, baseAssets, filteredAssetsCount
- `viewContext` — activeView, virtualScroll, scrollToRow
- Additional UI contexts as needed (contextMenu, headerMenu, filterPanel, editDropdown, autocomplete)

### +page.svelte — Thin Wrapper
- `+page.svelte` receives route data via `$props()`
- Calls `set*Context($state({...}))` for each domain with initial values
- Renders children — that's it
- No business logic, no controllers, no effects, no callback props
- Target: well under 100 lines

**Example pattern:**
```ts
setEditingContext($state({
    isEditing: false,
    editBeforeValue: null,
    editAfterValue: null
}));
```

### Component Independence
- Each component is a self-contained plugin that can be deleted without breaking the app
- Delete FloatingEditor → grid works, you just can't edit
- Delete ContextMenu → grid works, right-click does nothing
- Delete GridOverlays → grid works, no selection highlighting
- Components don't know about each other — they only know about context

### Controllers Inside Components
- Controller logic (.svelte.ts files like gridSelection, gridEdit, gridClipboard) lives inside the component that owns that domain
- The component calls `get*Context()` and contains all the logic for reading/writing that state
- Delete the component → the controller logic goes with it
- `+page.svelte` does NOT create controllers centrally

### Event Handling — Components Own Their Events
- GridContainer handles cell-level events (contextmenu, dblclick, mousedown, mouseover) by reading/writing context directly
- No callback props threading back to parent (no `onContextMenu`, `onHeaderClick`, etc.)
- Props are only for data a component genuinely needs from its parent
- Context is for shared state that multiple siblings/descendants read

### Data Flow — Renderless DataController
- Create a renderless `DataController.svelte` as a child of `+page.svelte`
- DataController owns: URL-driven search, fetch/filter, commit, discard, addRows logic
- Reads/writes `dataContext`, observes URL changes
- The current ~100-line URL search effect, commitChanges, discardChanges, addNewRows all move here
- `+page.svelte` just sets initial data context and renders children

### The `pageActions` Pattern — Eliminated
- The current `ctx.pageActions = { onSaveEdit, onCancelEdit, onUndo, ... }` bag of callbacks is eliminated
- Each component handles its own actions by writing to context directly
- FloatingEditor saves by writing to `editingContext`
- GridContainer handles escape by writing to `selectionContext`

</decisions>

<specifics>
## Specific Ideas

- User provided explicit example code showing the pattern: contexts.svelte.ts with typed `[getter, setter]` pairs, +page.svelte calling `set*Context($state({...}))`, child components calling `get*Context()` and mutating directly
- "If a component NEEDS 100 props to function then we give it 100 props" — props are fine when necessary, but the goal is component independence through shared context
- "If we completely delete the edit component, the app would still function, but we just can't edit" — this is the litmus test for correct architecture

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within scope of architecture realignment and bug fixes.

</deferred>

---

*Architecture Realignment + Bug Fixes*
*Context gathered: 2026-02-26*
