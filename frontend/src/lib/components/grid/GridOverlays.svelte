<script lang="ts">
  import type { Snippet } from 'svelte';
  import {
    getEditingContext,
    getSelectionContext,
    getClipboardContext,
    getColumnContext,
    getDataContext,
    getViewContext,
    getUiContext,
    getChangeControllerContext,
    getHistoryControllerContext,
    getRowGenControllerContext,
  } from '$lib/context/gridContext.svelte.ts';
  import { createSelectionController } from '$lib/grid/utils/gridSelection.svelte.ts';
  import { createColumnController } from '$lib/grid/utils/gridColumns.svelte.ts';
  import { createClipboardController } from '$lib/grid/utils/gridClipboard.svelte.ts';
  import { createEditController } from '$lib/grid/utils/gridEdit.svelte.ts';
  import { realtime } from '$lib/utils/interaction/realtimeManager.svelte';
  import { toastState } from '$lib/components/toast/toastState.svelte';
  import FloatingEditor from '$lib/grid/components/floating-editor/FloatingEditor.svelte';

  let { children, style = '' }: { children: Snippet; style?: string } = $props();

  const editCtx = getEditingContext();
  const selCtx = getSelectionContext();
  const clipCtx = getClipboardContext();
  const colCtx = getColumnContext();
  const dataCtx = getDataContext();
  const viewCtx = getViewContext();
  const uiCtx = getUiContext();

  const selection = createSelectionController();
  const columns = createColumnController();
  const changes = getChangeControllerContext();
  const rowGen = getRowGenControllerContext();
  const history = getHistoryControllerContext();
  const edit = createEditController();
  // Keep clipboard controller for paste only — copy is inlined below
  const clipboard = createClipboardController();

  // GridOverlays accepts no data props. F2.5: 0 data props.
  let hoveredUser: string | null = $state(null);

  // --- Inlined copy logic (moved from gridClipboard.copy) ---
  type CopiedItem = { relRow: number; relCol: number; value: string };
  let clipboardInternal = $state<CopiedItem[]>([]);
  let lastCopiedText = $state('');

  function getSelectionBounds() {
    if (selCtx.selectionStart.row === -1 || selCtx.selectionEnd.row === -1) return null;
    return {
      minRow: Math.min(selCtx.selectionStart.row, selCtx.selectionEnd.row),
      maxRow: Math.max(selCtx.selectionStart.row, selCtx.selectionEnd.row),
      minCol: Math.min(selCtx.selectionStart.col, selCtx.selectionEnd.col),
      maxCol: Math.max(selCtx.selectionStart.col, selCtx.selectionEnd.col),
    };
  }

  async function copyToSystemClipboard(text: string): Promise<void> {
    try { await navigator.clipboard.writeText(text); }
    catch (err) { console.error('Failed to copy to clipboard:', err); }
  }

  async function handleCopy() {
    // 1. Snapshot visual overlay
    if (selCtx.selectionStart.row !== -1) {
      clipCtx.copyStart = { ...selCtx.selectionStart };
      clipCtx.copyEnd = { ...selCtx.selectionEnd };
      clipCtx.isCopyVisible = true;
      selCtx.isHiddenAfterCopy = true;
    }
    // 2. Get selection bounds
    const bounds = getSelectionBounds();
    if (!bounds) return;
    // 3. Capture data into internal buffer + system clipboard
    const newClipboard: CopiedItem[] = [];
    const externalRows: string[] = [];
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      const rowStrings: string[] = [];
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        const key = colCtx.keys[c];
        const value = String(dataCtx.assets[r]?.[key] ?? '');
        newClipboard.push({ relRow: r - bounds.minRow, relCol: c - bounds.minCol, value });
        rowStrings.push(value);
      }
      externalRows.push(rowStrings.join('\t'));
    }
    clipboardInternal = newClipboard;
    const textBlock = externalRows.join('\n');
    lastCopiedText = textBlock;
    setTimeout(async () => { await copyToSystemClipboard(textBlock); }, 0);
    if (uiCtx.contextMenu?.visible) uiCtx.contextMenu.close();
  }

  function clearClipboard() {
    clipboardInternal = [];
    lastCopiedText = '';
  }

  // --- Inline keyboard handler (replaces gridShortcuts / interactionHandler) ---
  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;
    if (isInput) return;

    // Escape — clear everything
    if (e.key === 'Escape') {
      if (editCtx.isEditing) {
        edit.cancel();
        return;
      }
      if (selection.hasSelection) {
        selection.resetAll();
      }
      clearClipboard();
      clipboard.clear();
      if (uiCtx.contextMenu?.visible) uiCtx.contextMenu.close();
      if (uiCtx.headerMenu?.activeKey) uiCtx.headerMenu.close();
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      const target2 = selection.anchor;
      if (!target2) return;
      const key = colCtx.keys[target2.col];
      const asset = dataCtx.assets[target2.row];
      if (!asset || !key || key === 'id') return;
      const currentValue = String(asset[key] ?? '');
      edit.startEdit(target2.row, target2.col, key, currentValue);
      return;
    }

    // Ctrl/Cmd shortcuts
    if (e.metaKey || e.ctrlKey) {
      const k = e.key.toLowerCase();

      if (k === 'z') {
        e.preventDefault();
        const batch = history.undo(dataCtx.assets);
        if (batch) {
          for (const action of batch) {
            changes.update({
              id: action.id,
              key: action.key,
              newValue: action.oldValue,
              oldValue: action.newValue,
            });
          }
          const firstAction = batch[0];
          const row = dataCtx.assets.findIndex(a => a.id === firstAction.id);
          const col = colCtx.keys.indexOf(firstAction.key);
          if (row !== -1) {
            viewCtx.scrollToRow = row;
            selection.moveTo(row, col !== -1 ? col : 0);
          }
        }
        return;
      }

      if (k === 'y') {
        e.preventDefault();
        const batch = history.redo(dataCtx.assets);
        if (batch) {
          for (const action of batch) {
            changes.update(action);
          }
          const firstAction = batch[0];
          const row = dataCtx.assets.findIndex(a => a.id === firstAction.id);
          const col = colCtx.keys.indexOf(firstAction.key);
          if (row !== -1) {
            viewCtx.scrollToRow = row;
            selection.moveTo(row, col !== -1 ? col : 0);
          }
        }
        return;
      }

      if (k === 'c') {
        e.preventDefault();
        handleCopy();
        return;
      }

      if (k === 'v') {
        e.preventDefault();
        (async () => {
          const anchor = selection.anchor;
          if (!anchor) return;
          const result = await clipboard.paste(anchor, dataCtx.assets, colCtx.keys);
          if (result && result.changes.length > 0) {
            for (const change of result.changes) {
              changes.update(change);
            }
            history.recordBatch(result.changes);
          }
          if (uiCtx.contextMenu?.visible) uiCtx.contextMenu.close();
        })();
        return;
      }
    }

    // Arrow key navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const rows = dataCtx.assets.length;
      const cols = colCtx.keys.length;
      const primary = selection.primaryRange;
      if (!primary) return;

      // Ctrl + Arrow (jump/extend to edge)
      if (e.metaKey || e.ctrlKey) {
        let targetRow = primary.end.row;
        let targetCol = primary.end.col;
        switch (e.key) {
          case 'ArrowUp':    targetRow = 0; break;
          case 'ArrowDown':  targetRow = rows - 1; break;
          case 'ArrowLeft':  targetCol = 0; break;
          case 'ArrowRight': targetCol = cols - 1; break;
        }
        if (e.shiftKey) {
          selection.end = { row: targetRow, col: targetCol };
        } else {
          selection.moveTo(targetRow, targetCol);
        }
        viewCtx.scrollToRow = targetRow;
        return;
      }

      // Shift + Arrow: extend selection
      if (e.shiftKey) {
        const next = getKeyboardNavigation(e, primary.end, rows, cols);
        if (next) {
          selection.end = next;
          viewCtx.scrollToRow = next.row;
        }
      } else {
        // Arrow only: move selection
        const next = getKeyboardNavigation(e, primary.start, rows, cols);
        if (next) {
          selection.moveTo(next.row, next.col);
          viewCtx.scrollToRow = next.row;
        }
      }
    }
  }

  function getKeyboardNavigation(
    e: KeyboardEvent,
    current: { row: number; col: number },
    rowCount: number,
    colCount: number
  ): { row: number; col: number } | null {
    const { row, col } = current;
    switch (e.key) {
      case 'ArrowUp':    return row > 0 ? { row: row - 1, col } : null;
      case 'ArrowDown':  return row < rowCount - 1 ? { row: row + 1, col } : null;
      case 'ArrowLeft':  return col > 0 ? { row, col: col - 1 } : null;
      case 'ArrowRight': return col < colCount - 1 ? { row, col: col + 1 } : null;
      default:           return null;
    }
  }

  // --- Mouse handlers (moved from GridContainer) ---
  function handleMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const cell = target.closest('[data-row][data-col]') as HTMLElement | null;
    if (!cell) return;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (isNaN(row) || isNaN(col)) return;
    if (editCtx.isEditing) {
      // Do NOT call edit.save() here — let FloatingEditor's handleBlur own the save.
      selection.selectCell(row, col);
      return;
    }
    selection.handleMouseDown(row, col, e);
  }

  function handleMouseOver(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const cell = target.closest('[data-row][data-col]') as HTMLElement | null;
    if (!cell) return;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (isNaN(row) || isNaN(col)) return;
    if (!editCtx.isEditing) {
      selection.extendSelection(row, col);
    }
  }

  function handleDblClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const cell = target.closest('[data-row][data-col]') as HTMLElement | null;
    if (!cell) return;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (isNaN(row) || isNaN(col)) return;
    if (!dataCtx.user) {
      toastState.addToast('Log in to edit.', 'warning');
      return;
    }
    const key = colCtx.keys[col];
    if (key === 'id') {
      toastState.addToast('ID column cannot be edited.', 'warning');
      return;
    }
    e.preventDefault();
    selection.selectCell(row, col);
    const currentValue = String(dataCtx.assets[row]?.[key] ?? '');
    edit.startEdit(row, col, key, currentValue);
  }

  function handleContextMenu(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const cell = target.closest('[data-row][data-col]') as HTMLElement | null;
    if (!cell) return;
    const visibleIndex = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (isNaN(visibleIndex) || isNaN(col)) return;
    e.preventDefault();
    const actualRow = viewCtx.virtualScroll.getActualIndex(visibleIndex);
    const key = colCtx.keys[col];
    const value = String(dataCtx.assets[actualRow]?.[key] ?? '');
    selection.selectCell(actualRow, col);
    uiCtx.contextMenu?.open(e, actualRow, col, value, key);
    uiCtx.headerMenu?.close();
  }

  // Window-level event listeners
  $effect(() => {
    function onMouseUp() {
      if (columns.resizingColumn) {
        columns.endResize();
        document.body.style.cursor = '';
      }
      selection.endSelection();
    }
    function onMouseMove(e: MouseEvent) {
      if (columns.resizingColumn) {
        e.preventDefault();
        columns.updateResize(e.clientX);
      }
    }
    function onWindowClick(e: MouseEvent) {
      if (uiCtx.contextMenu?.visible) uiCtx.contextMenu.close();
      uiCtx.headerMenu?.handleOutsideClick(e);
    }
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('click', onWindowClick);
    return () => {
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('click', onWindowClick);
    };
  });

  // --- Overlay derivations ---

  const selectionOverlay = $derived(
    selection.computeVisualOverlay(
      selection.start,
      selection.end,
      viewCtx.virtualScroll.visibleRange,
      colCtx.keys,
      (key) => columns.getWidth(key),
      viewCtx.virtualScroll.rowHeight,
    )
  );

  const copyOverlay = $derived(
    selection.isCopyVisible
      ? selection.computeVisualOverlay(
          selection.copyStart,
          selection.copyEnd,
          viewCtx.virtualScroll.visibleRange,
          colCtx.keys,
          (key) => columns.getWidth(key),
          viewCtx.virtualScroll.rowHeight,
        )
      : null
  );

  const dirtyCellOverlays = $derived(
    selection.computeDirtyCellOverlays(
      viewCtx.virtualScroll.visibleRange,
      colCtx.keys,
      (key) => columns.getWidth(key),
      viewCtx.virtualScroll.rowHeight,
      (row, col) => {
        const asset = dataCtx.assets[row];
        if (!asset) return false;
        const key = colCtx.keys[col];
        const isNewRow = row >= dataCtx.filteredAssetsCount;
        if (isNewRow) {
          const newRowIndex = row - dataCtx.filteredAssetsCount;
          return rowGen.isNewRowFieldInvalid(newRowIndex, key);
        }
        return changes.isInvalid(asset.id, key);
      },
    )
  );

  const otherUserSelections = $derived(
    Object.entries(realtime.connectedUsers).reduce(
      (acc, [clientId, position]) => {
        let rowIndex = -1;
        if (position.assetId !== undefined) {
          rowIndex = dataCtx.assets.findIndex((a: Record<string, any>) => a.id === position.assetId);
        } else {
          rowIndex = position.row;
        }
        if (rowIndex === -1) return acc;
        acc[clientId] = {
          ...position,
          row: rowIndex,
          initials: (
            (position.firstname?.[0] || '') + (position.lastname?.[0] || '')
          ).toUpperCase(),
          fullName: `${position.firstname?.[0]?.toUpperCase() || ''}${position.firstname?.slice(1) || ''} ${position.lastname?.[0]?.toUpperCase() || ''}${position.lastname?.slice(1) || ''}`.trim(),
          editing: Object.entries(realtime.lockedCells).some(
            ([, lock]) => lock.userId === clientId
          ),
        };
        return acc;
      },
      {} as Record<string, any>
    )
  );
</script>

<!--
  GridOverlays: parent wrapper that owns ALL user input (keyboard + mouse) and visual feedback.
  GridContainer passes GridHeader + GridRows as snippet children.
  Overlay layers are absolutely positioned; children render below them in the same relative container.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div
  class="w-max min-w-full bg-white dark:bg-slate-800 text-left relative"
  {style}
  tabindex="-1"
  onkeydown={handleKeyDown}
  onmousedown={handleMouseDown}
  onmouseover={handleMouseOver}
  ondblclick={handleDblClick}
  oncontextmenu={handleContextMenu}
>
  <!-- Overlay layers (absolutely positioned over content) -->

  {#each Object.entries(otherUserSelections) as [clientId, position]}
    {@const otherUserOverlay = selection.computeVisualOverlay(
      position,
      position,
      viewCtx.virtualScroll.visibleRange,
      colCtx.keys,
      (key) => columns.getWidth(key),
      viewCtx.virtualScroll.rowHeight,
    )}
    {#if otherUserOverlay}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute pointer-events-none z-50"
        style="
            top: {otherUserOverlay.top}px;
            left: {otherUserOverlay.left}px;
            width: {otherUserOverlay.width}px;
            height: {otherUserOverlay.height}px;
            border: {position.editing ? '2px' : '1px'} solid {position.color};
            box-sizing: border-box;
          "
      >
        <div
          class="absolute flex items-center justify-center text-white text-[10px] rounded-full font-bold shadow-sm overflow-hidden pointer-events-auto cursor-default"
          style="
            top: -8px;
            right: -8px;
            height: 16px;
            background-color: {position.color};
            min-width: 16px;
            max-width: {hoveredUser === clientId ? '200px' : '16px'};
            transition: max-width 0.2s ease-in-out, background-color 0.2s ease-in-out;
          "
          onmouseenter={() => hoveredUser = clientId}
          onmouseleave={() => hoveredUser = null}
        >
          <div class="{hoveredUser === clientId ? 'px-1' : ''} whitespace-nowrap">
            {#if position.editing}
              {hoveredUser === clientId ? `${position.fullName} editing...` : '...'}
            {:else}
              {hoveredUser === clientId ? position.fullName : position.initials}
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/each}

  {#if copyOverlay}
    <div
      class="absolute pointer-events-none z-20 border-blue-600 dark:border-blue-500"
      style="
      top: {copyOverlay.top}px;
      left: {copyOverlay.left}px;
      width: {copyOverlay.width}px;
      height: {copyOverlay.height}px;
      border-top-style: {copyOverlay.showTopBorder ? 'dashed' : 'none'};
      border-bottom-style: {copyOverlay.showBottomBorder ? 'dashed' : 'none'};
      border-left-style: {copyOverlay.showLeftBorder ? 'dashed' : 'none'};
      border-right-style: {copyOverlay.showRightBorder ? 'dashed' : 'none'};
      border-width: 2px;"
    ></div>
  {/if}

  {#if selectionOverlay && selCtx.selectionStart.row !== -1 && !selCtx.isHiddenAfterCopy}
    <div
      class="absolute pointer-events-none z-10 border-blue-600 dark:border-blue-500 bg-blue-900/10"
      style="
          top: {selectionOverlay.top}px;
          left: {selectionOverlay.left}px;
          width: {selectionOverlay.width}px;
          height: {selectionOverlay.height}px;
          border-top-style: {selectionOverlay.showTopBorder ? 'solid' : 'none'};
          border-bottom-style: {selectionOverlay.showBottomBorder ? 'solid' : 'none'};
          border-left-style: {selectionOverlay.showLeftBorder ? 'solid' : 'none'};
          border-right-style: {selectionOverlay.showRightBorder ? 'solid' : 'none'};
          border-width: 2px;"
    ></div>
  {/if}

  {#each dirtyCellOverlays as overlay}
    {@const overlayRowIndex = viewCtx.virtualScroll.visibleRange.startIndex + Math.floor(overlay.top / viewCtx.virtualScroll.rowHeight)}
    {@const overlayColIndex = (() => {
      let accWidth = 0;
      for (let c = 0; c < colCtx.keys.length; c++) {
        const colWidth = columns.getWidth(colCtx.keys[c]);
        if (overlay.left < accWidth + colWidth) return c;
        accWidth += colWidth;
      }
      return 0;
    })()}
    {@const overlayKey = colCtx.keys[overlayColIndex]}
    {@const overlayAsset = dataCtx.assets[overlayRowIndex]}
    {@const isNewRowOverlay = overlayRowIndex >= dataCtx.filteredAssetsCount}
    {@const isInvalid = isNewRowOverlay
      ? rowGen.isNewRowFieldInvalid(overlayRowIndex - dataCtx.filteredAssetsCount, overlayKey)
      : changes.isInvalid(overlayAsset?.id, overlayKey)}
    <div
      class="absolute pointer-events-none z-40 border-2
        {isInvalid
        ? 'bg-yellow-400/20 dark:bg-yellow-400/10 border-yellow-500 dark:border-yellow-600'
        : 'bg-green-400/20 dark:bg-green-400/10 border-green-400 dark:border-green-600'}"
      style="
        top: {overlay.top}px;
        left: {overlay.left}px;
        width: {overlay.width}px;
        height: {overlay.height}px;
      "
    ></div>
  {/each}

  {#if editCtx.isEditing}
    <FloatingEditor onSave={(change) => {
      const editRow = editCtx.editRow;
      const isNewRow = editRow >= dataCtx.filteredAssetsCount;
      if (isNewRow) {
        // New row: route to rowGen, not ChangeController
        const newRowIndex = editRow - dataCtx.filteredAssetsCount;
        rowGen.updateNewRowField(newRowIndex, change.key, change.newValue);
      } else {
        // Existing row: route to ChangeController + History (original behavior)
        history.record(change.id, change.key, change.oldValue, change.newValue);
        changes.update(change);
      }
    }} />
  {/if}

  <!-- Content layer: GridHeader + GridRows passed as snippet children from GridContainer -->
  {@render children()}
</div>
