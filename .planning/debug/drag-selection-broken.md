---
status: diagnosed
trigger: "drag selection broken — click and drag across cells does not select them"
created: 2026-02-26T00:00:00Z
updated: 2026-02-26T00:00:00Z
---

## Current Focus

hypothesis: onmouseenter does not bubble, so delegating it to a parent container cannot detect child cell entry
test: examined GridContainer.svelte lines 99-109 vs DOM event bubbling spec
expecting: confirmed — onmouseenter on parent div never fires when mouse enters child cells
next_action: fix by replacing onmouseenter with onmouseover on the container wrapper

## Symptoms

expected: Click and drag across cells highlights dragged cells as you move
actual: Drag selection does not work; shift+arrow still works
errors: None
reproduction: UAT Test 8 — click a cell, hold mouse button, drag across other cells
started: After Plan 03-03 moved event handlers from individual GridRow cells to GridContainer

## Eliminated

- hypothesis: extendSelection() has a bug or doesn't check isSelecting correctly
  evidence: gridSelection.svelte.ts lines 69-74 — extendSelection guards on ctx.isSelecting, which handleMouseDown sets to true (line 47). Logic is correct.
  timestamp: 2026-02-26

- hypothesis: data-row/data-col attributes are missing from cells
  evidence: GridRow.svelte lines 19-20 — every cell div has data-row={actualIndex} and data-col={j}. Attributes are present.
  timestamp: 2026-02-26

- hypothesis: target.closest() fails to find the cell element
  evidence: The span inside each cell would correctly bubble up to the parent div with data attributes via closest(). Same pattern works for onmousedown (click selection works). Not the cause.
  timestamp: 2026-02-26

## Evidence

- timestamp: 2026-02-26
  checked: GridContainer.svelte lines 85-109
  found: onmousedown and onmouseenter are both attached to the same parent div (.w-max wrapper). onmousedown uses e.target.closest('[data-row][data-col]') — this works because mousedown bubbles. onmouseenter also uses e.target.closest('[data-row][data-col]') — but mouseenter does NOT bubble.
  implication: onmouseenter on the container fires ONCE when the pointer first crosses the container boundary. It does NOT re-fire as the pointer moves into child cells within the container. So e.target is the container div itself, not the cell being entered, and closest() finds nothing (or finds cells only on the initial boundary cross of the container, not per-cell).

- timestamp: 2026-02-26
  checked: DOM spec — mouseenter vs mouseover
  found: mouseenter/mouseleave do NOT bubble (they are non-bubbling counterparts of mouseover/mouseout). mouseover/mouseout DO bubble — they fire on the target element AND propagate up through ancestors. Event delegation with closest() requires a bubbling event.
  implication: Delegating onmouseenter to a parent is fundamentally broken for detecting which child element the mouse entered. Must use onmouseover instead.

- timestamp: 2026-02-26
  checked: gridSelection.svelte.ts lines 43-67 (handleMouseDown) and 69-74 (extendSelection)
  found: handleMouseDown sets ctx.isSelecting = true. extendSelection checks if (ctx.isSelecting) before updating selectionEnd. The guard and state transitions are correct.
  implication: The selection controller logic is sound. The problem is purely the event not firing at the right time.

- timestamp: 2026-02-26
  checked: Previously working behavior (pre-Plan-03-03)
  found: Event handlers were on individual GridRow cell divs — each cell had its own onmouseenter. Per-element onmouseenter works correctly because the event fires on the exact element the pointer enters.
  implication: Moving to event delegation broke drag because mouseenter is non-bubbling. The delegation pattern requires a bubbling event.

## Resolution

root_cause: onmouseenter does not bubble. In GridContainer.svelte, the drag selection handler uses onmouseenter delegated to a parent wrapper div. Because mouseenter is a non-bubbling event, it fires only once when the mouse crosses the parent div boundary — not each time the mouse enters a child cell. Consequently extendSelection() is never called during a drag across cells. click selection (onmousedown) works because mousedown is a bubbling event, so target.closest() correctly finds the cell on every click.

fix: Replace onmouseenter with onmouseover in GridContainer.svelte (line 99). onmouseover bubbles, so when the pointer moves into any child cell div, the event propagates up to the container handler, e.target is the cell (or span inside it), and target.closest('[data-row][data-col]') correctly resolves the cell. The existing extendSelection guard (checks isSelecting) already prevents spurious calls.

verification: not yet applied (find_root_cause_only mode)

files_changed: []
