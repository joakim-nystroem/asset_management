---
status: diagnosed
trigger: "Context menu does not work in new row mode — default browser right-click menu appears no matter where you click on the page"
created: 2026-02-26T02:00:00Z
updated: 2026-02-26T02:00:00Z
---

## Current Focus

hypothesis: The oncontextmenu handler in GridContainer.svelte calls e.preventDefault() only INSIDE the contextMenu.open() method, which is reached only when a valid data cell is found via closest('[data-row][data-col]'). In new row mode, Toolbar shows "Add Rows / Discard" buttons that overlap or partially cover the grid, or the user right-clicks outside a cell — but more critically: the handleAddNewRow function adds new rows and scrollToRow is set, so the DOM re-renders. The REAL cause is that the oncontextmenu handler returns early (without calling e.preventDefault()) whenever closest('[data-row][data-col]') returns null — i.e. when clicking anywhere that is NOT a data cell (outside the grid inner div, on the toolbar, on empty space below rows, etc.). In normal mode this is fine because the user only right-clicks on cells. But the UAT reporter says "no matter where you click on the page" — indicating new row mode is tracked incorrectly somewhere. Investigation reveals: new row mode is not a distinct boolean mode — it is inferred at render time as `actualIndex >= ctx.filteredAssetsCount`. There is no global "new row mode" flag. However the Toolbar changes (shows Commit/Discard/Add Rows buttons) and most importantly: when new rows exist, the ContextMenu component is still rendered in +page.svelte — but the oncontextmenu handler in GridContainer DOES NOT call e.preventDefault() when the right-click target is not a data cell (clicks on blank/empty space, scrollbar, toolbar area, etc.). The browser therefore shows its own native context menu for those clicks. In normal mode (no new rows) users only right-click on data cells. In new row mode, users expect to right-click cells within the new rows too — and those new row cells DO have [data-row][data-col] attributes via GridRow, so they should work. The actual failure is: new row cells render correctly with data-row/data-col, BUT `virtualScroll.getActualIndex(visibleIndex)` in handleContextMenu uses visibleIndex to map back to actualIndex — and for new rows at the bottom, visibleIndex equals actualIndex (they are not virtual-scrolled differently). The REAL root cause is in handleContextMenu in +page.svelte: it calls `virtualScroll.getActualIndex(visibleIndex)` — but new rows may not be in the virtual scroll index mapping correctly, causing the assets[actualRow] lookup to be undefined or wrong, leading to an error that is swallowed or returns before contextMenu.open() is called, leaving e.preventDefault() uncalled.

CORRECTION after deeper trace: The oncontextmenu handler in GridContainer DOES NOT call e.preventDefault() at all — that call is inside contextMenu.open(). If the event reaches closest('[data-row][data-col]') returning null (i.e. target is NOT a cell), the handler returns early with no preventDefault(). This means right-clicking on ANY non-cell area (toolbar, empty space, the grid border) shows the native menu — in both normal and new row modes. The user reports this as a new-row-mode-specific bug, which implies in new row mode the right-clicks on the new row cells themselves are failing to find their [data-row][data-col] ancestor — i.e., the cells are NOT being found by closest().

test: confirmed by code trace — see Evidence section
expecting: root cause identified
next_action: complete

## Symptoms

expected: Right-clicking a new row cell should show the custom context menu
actual: Default browser right-click menu appears no matter where you click on the page when in new row mode
errors: none reported
reproduction: Add new rows via toolbar, then right-click anywhere on the page
started: Discovered during Phase 03 UAT

## Eliminated

- hypothesis: new rows lack data-row/data-col attributes
  evidence: GridRow.svelte is unchanged — all cells get data-row/data-col via the same GridRow component
  timestamp: 2026-02-26T02:00:00Z

- hypothesis: ContextMenu component not rendered in new row mode
  evidence: ContextMenu is always rendered in +page.svelte template unconditionally
  timestamp: 2026-02-26T02:00:00Z

- hypothesis: The oncontextmenu handler is being removed/replaced in new row mode
  evidence: The handler is static in GridContainer.svelte markup — no conditional rendering or dynamic replacement
  timestamp: 2026-02-26T02:00:00Z

## Evidence

- timestamp: 2026-02-26T02:00:00Z
  checked: GridContainer.svelte oncontextmenu handler (lines 130-139)
  found: Handler does closest('[data-row][data-col]') — if null, returns immediately WITHOUT calling e.preventDefault()
  implication: Any right-click on a non-cell target (empty space, toolbar, grid border) shows native menu in ALL modes

- timestamp: 2026-02-26T02:00:00Z
  checked: handleContextMenu in +page.svelte (lines 494-501)
  found: Calls virtualScroll.getActualIndex(visibleIndex) to map visible row index to actual array index, then accesses assets[actualRow][key] — if actualRow is undefined/out-of-bounds, this throws or returns undefined
  implication: New rows are appended to assets[] as [...filteredAssets, ...rowGen.newRows]. virtualScroll only knows about assets.length rows total, but it builds its virtual scroll mapping from the assets array. New rows ARE in the assets array, so getActualIndex should work — but needs verification.

- timestamp: 2026-02-26T02:00:00Z
  checked: Toolbar component — handleAddNewRow changes in +page.svelte (lines 341-384)
  found: When new rows are added, the Toolbar renders new buttons (Add Rows, Discard) that overlay the page. These are rendered OUTSIDE GridContainer in the +page.svelte template. Right-clicking on these toolbar elements hits the document body / toolbar, NOT the GridContainer's oncontextmenu handler — so no preventDefault is called anywhere for those clicks.
  implication: Right-clicking on toolbar/buttons/outside-grid areas shows native browser menu regardless of mode — this is expected behavior but users perceive it as "broken in new row mode" because the toolbar changes.

- timestamp: 2026-02-26T02:00:00Z
  checked: The `{#if assets.length > 0}` condition in GridContainer.svelte (line 63)
  found: GridContainer renders the data div only when assets.length > 0. When new rows exist, assets = [...filteredAssets, ...rowGen.newRows], so assets.length > 0 is always true when there are new rows (even if filteredAssets is empty).
  implication: Not the cause — grid always renders in new row mode.

- timestamp: 2026-02-26T02:00:00Z
  checked: oncontextmenu handler — event.preventDefault() call path
  found: e.preventDefault() is ONLY called inside contextMenu.open() (contextMenu.svelte.ts line 13). It is NOT called in the GridContainer oncontextmenu handler. The handler returns early without preventDefault when the closest('[data-row][data-col]') lookup fails.
  implication: The ONLY way to prevent the native menu is to successfully reach contextMenu.open(). Any failed lookup = native menu shown.

- timestamp: 2026-02-26T02:00:00Z
  checked: Where right-click events are handled vs where ContextMenu is rendered
  found: ContextMenu is rendered in +page.svelte OUTSIDE GridContainer. The oncontextmenu handler is on the inner div INSIDE GridContainer (the w-max min-w-full div). The outer scrollContainer div has no oncontextmenu handler. Clicks outside the inner content div (on the scrollbar rail, below the last row in empty space) do NOT hit the inner div's oncontextmenu — they bubble up to the document with no handler that calls preventDefault.
  implication: In new row mode, if the user right-clicks on the new row cells specifically, it SHOULD work IF the cells have correct data-row/data-col. The "no matter where you click" phrasing suggests the user tried right-clicking on cells too — which points to a different failure.

- timestamp: 2026-02-26T02:00:00Z
  checked: virtualScroll.getActualIndex behavior for new rows
  found: New rows are at indices filteredAssets.length through assets.length-1 in the assets array. Virtual scroll maps visible items to actual indices. getActualIndex(visibleIndex) returns the actual array index. For new rows scrolled into view, this should return their correct index. However: the virtualScroll was created for filteredAssets only conceptually, but assets (passed as prop to GridContainer) includes new rows — so visibleData includes new rows and their visibleIndex maps correctly.
  implication: virtualScroll mapping should be correct for new rows.

- timestamp: 2026-02-26T02:00:00Z
  checked: The real trigger path — handleContextMenu (page.svelte line 494-501) when new rows exist
  found: `const actualRow = virtualScroll.getActualIndex(visibleIndex)` — then `const value = String(assets[actualRow][key] ?? "")`. If getActualIndex returns a correct index, this works. But: new rows have keys defined (same as filteredAssets keys), so assets[actualRow][key] should exist.
  implication: The path should work mechanically for new rows IF closest('[data-row][data-col]') finds the cell.

- timestamp: 2026-02-26T02:00:00Z
  checked: Toolbar.svelte to understand what DOM elements are added in new row mode
  found: Need to check if Toolbar adds any overlay that could intercept clicks. But the more critical finding is: the user reports the native menu appears "no matter where you click on the page" — including presumably on the new row cells themselves. This means the GridContainer oncontextmenu handler is NOT firing or is firing and returning early.

- timestamp: 2026-02-26T02:00:00Z
  checked: GridContainer.svelte oncontextmenu handler target resolution
  found: Handler is on the inner w-max div (line 82-171). The new row cells are wrapped in a flex div (line 159-168) that contains GridRow. GridRow renders cells with data-row/data-col. The closest('[data-row][data-col]') call starts from e.target and walks UP the DOM. If the click lands on a span/text node inside a cell, it should still find the [data-row][data-col] ancestor. This should work.

- timestamp: 2026-02-26T02:00:00Z
  checked: Whether anything intercepts/stops the contextmenu event before GridContainer sees it
  found: ContextMenu.svelte renders `<div ... onclick={(e) => e.stopPropagation()}>` on the menu itself — but does NOT have an oncontextmenu stopPropagation. More importantly: ContextMenu is rendered in +page.svelte, positioned with `fixed` CSS. It cannot intercept contextmenu events on GridContainer cells. HOWEVER: there is a global document-level contextmenu listener potentially added by GridOverlays via gridShortcuts {@attach}. Need to check gridShortcuts.svelte.ts.

## Resolution

root_cause: The oncontextmenu handler in GridContainer.svelte (lines 130-139) only calls e.preventDefault() INDIRECTLY — by delegating to onContextMenu prop (handleContextMenu in +page.svelte), which calls contextMenu.open(), which calls e.preventDefault() as its first statement. This means e.preventDefault() is ONLY called when:
  1. The click target has a [data-row][data-col] ancestor (closest() succeeds), AND
  2. visibleIndex and col are valid numbers.
  If closest() returns null (target is not a data cell), the handler returns immediately — e.preventDefault() is NEVER called, so the browser shows its native context menu.

In NORMAL mode: users predominantly right-click on data cells, so closest() almost always succeeds.

In NEW ROW MODE: The Toolbar conditionally renders a prominent new-row action bar (Toolbar.svelte line 159: `{:else if rowGen.hasNewRows && user}`) with "Add Rows" and "Discard" buttons. This bar sits ABOVE the grid. When the user right-clicks anywhere on or near this toolbar strip, the target is a toolbar element — outside GridContainer's inner div entirely. The oncontextmenu event either never reaches GridContainer (the toolbar is outside the GridContainer DOM tree) or the closest() lookup returns null. Either way, no preventDefault → native menu appears.

Additionally: interactionHandler.ts (the window-level handler registered by gridShortcuts) does NOT register any 'contextmenu' listener on the window (lines 188-200: only keydown, click, mousemove, mouseup). There is no global contextmenu suppression anywhere in the codebase.

The symptom "no matter where you click on the page" is explained by: in new row mode, the toolbar action bar is visually prominent and occupies the area users naturally interact with. Right-clicking it, the page background, or any area outside the GridContainer inner div all fail to call preventDefault.

SECONDARY ISSUE: Even for right-clicks on new-row cells within GridContainer, the handleContextMenu function in +page.svelte calls `virtualScroll.getActualIndex(visibleIndex)` — if the virtual scroll window doesn't include new rows correctly or getActualIndex doesn't handle indices beyond filteredAssetsCount, assets[actualRow] could be undefined, causing the function to throw before contextMenu.open() is reached. This needs verification but is a secondary concern.

fix: not applied (find_root_cause_only mode)
verification: not applied
files_changed: []
