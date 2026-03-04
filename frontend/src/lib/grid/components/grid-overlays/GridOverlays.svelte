<script lang="ts">
  import type { Snippet } from 'svelte';
  import {
    getEditingContext,
    getPendingContext,
    getSelectionContext,
    getClipboardContext,
    getViewContext,
    getUiContext,
    getColumnWidthContext,
  } from '$lib/context/gridContext.svelte.ts';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import { realtime } from '$lib/utils/interaction/realtimeManager.svelte';
  import { toastState } from '$lib/toast/toastState.svelte';
  import ContextMenu from '$lib/grid/components/context-menu/contextMenu.svelte';

  import { DEFAULT_WIDTH, MIN_COLUMN_WIDTH } from '$lib/grid/gridConfig';

  let { children }: { children: Snippet } = $props();

  const editingCtx = getEditingContext();
  const pendingCtx = getPendingContext();
  const selCtx = getSelectionContext();
  const clipCtx = getClipboardContext();
  const viewCtx = getViewContext();
  const uiCtx = getUiContext();

  const colWidthCtx = getColumnWidthContext();

  // --- Local UI state ---
  let hoveredUser: string | null = $state(null);

  // --- Resize drag state ---
  let resizeDrag = $state<{ key: string; startX: number; startWidth: number } | null>(null);

  // --- Context menu (local, passed as props) ---
  let ctxMenu = $state({ x: 0, y: 0, row: -1, col: -1, value: '', key: '' });

  function openContextMenu(e: MouseEvent, row: number, col: number, value: string, key: string) {
    const estimatedWidth = 150;
    const estimatedHeight = 200;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    ctxMenu.x = e.clientX + estimatedWidth > winW ? e.clientX - estimatedWidth : e.clientX;
    ctxMenu.y = e.clientY + estimatedHeight > winH ? Math.max(4, winH - estimatedHeight - 8) : e.clientY;
    ctxMenu.row = row;
    ctxMenu.col = col;
    ctxMenu.value = value;
    ctxMenu.key = key;
    uiCtx.contextMenu.visible = true;
  }


  // --- Derived data ---
  const assets = $derived(assetStore.filteredAssets);
  const keys = $derived(Object.keys(assets[0] ?? {}));

  // --- Column width helper ---
  function getWidth(key: string): number {
    return colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH;
  }

  // --- Asset ID → array index helper ---
  function assetIndex(id: number): number {
    return assets.findIndex((a: Record<string, any>) => a.id === id);
  }

  // --- Column pixel bounds helper ---
  function colBounds(col: number): { left: number; right: number } {
    let left = 0;
    for (let c = 0; c < col; c++) left += getWidth(keys[c]);
    return { left, right: left + getWidth(keys[col]) };
  }

  // --- Panel management helper ---
  function setOpenPanel(panel?: 'contextMenu' | 'headerMenu' | 'filterPanel') {
    if (panel !== 'contextMenu' && uiCtx.contextMenu.visible) uiCtx.contextMenu.visible = false;
    if (panel !== 'headerMenu' && uiCtx.headerMenu.visible) { uiCtx.headerMenu.activeKey = ''; uiCtx.headerMenu.visible = false; }
    if (panel !== 'filterPanel' && uiCtx.filterPanel.visible) uiCtx.filterPanel.visible = false;
  }

  // --- Selection helpers (inlined from selCtx) ---
  let isDragging = false;

  function selectCell(row: number, col: number) {
    selCtx.selectionStart = { row, col };
    selCtx.selectionEnd = { row, col };
    selCtx.isSelecting = true;
    selCtx.hideSelection = false;
  }

  function startSelection(row: number, col: number, e: MouseEvent) {
    if (e.shiftKey) {
      selCtx.selectionEnd = { row, col };
    } else {
      selCtx.selectionStart = { row, col };
      selCtx.selectionEnd = { row, col };
      isDragging = true;
      selCtx.isSelecting = true;
      selCtx.hideSelection = false;
    }
  }

  function extendSelection(row: number, col: number) {
    if (isDragging) {
      selCtx.selectionEnd = { row, col };
    }
  }

  function endSelection() {
    isDragging = false;
    // Normalize: start = top-left, end = bottom-right
    const s = selCtx.selectionStart;
    const e = selCtx.selectionEnd;
    const minRow = Math.min(s.row, e.row);
    const maxRow = Math.max(s.row, e.row);
    const minCol = Math.min(s.col, e.col);
    const maxCol = Math.max(s.col, e.col);
    selCtx.selectionStart = { row: minRow, col: minCol };
    selCtx.selectionEnd = { row: maxRow, col: maxCol };
  }

  function resetSelection() {
    selCtx.selectionStart = { row: -1, col: -1 };
    selCtx.selectionEnd = { row: -1, col: -1 };
    selCtx.isSelecting = false;
    isDragging = false;
    selCtx.hideSelection = false;
  }

  // --- Start cell editing helper ---
  function startCellEdit(row: number, col: number) {
    editingCtx.isEditing = true;
    editingCtx.editRow = row;
    editingCtx.editCol = col;
  }

  // --- Overlay computation ---
  function computeVisualOverlay(
    start: { row: number; col: number },
    end: { row: number; col: number },
  ) {
    const { startIndex, endIndex } = viewCtx.virtualScroll.visibleRange;
    const rowHeight = viewCtx.virtualScroll.rowHeight;

    const startRowIdx = assetIndex(start.row);
    const endRowIdx = assetIndex(end.row);
    if (startRowIdx === -1 || endRowIdx === -1) return null;

    const minRow = Math.min(startRowIdx, endRowIdx);
    const maxRow = Math.max(startRowIdx, endRowIdx);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    const clampedMinRow = Math.max(minRow, startIndex);
    const clampedMaxRow = Math.min(maxRow, endIndex - 1);
    if (clampedMinRow > clampedMaxRow) return null;

    let left = 0;
    for (let c = 0; c < minCol; c++) left += getWidth(keys[c]);
    let width = 0;
    for (let c = minCol; c <= maxCol; c++) width += getWidth(keys[c]);

    const top = clampedMinRow * rowHeight + 32; // absolute position in virtual space
    const height = (clampedMaxRow - clampedMinRow + 1) * rowHeight;

    return {
      top, left, width, height,
      showTopBorder: minRow >= startIndex,
      showBottomBorder: maxRow < endIndex,
      showLeftBorder: true,
      showRightBorder: true,
    };
  }

  // --- Clipboard visual helpers (data ops live in EditHandler) ---
  function clearClipboard() {
    clipCtx.copyStart = { row: -1, col: -1 };
    clipCtx.copyEnd = { row: -1, col: -1 };
  }

  // --- Keyboard handler ---
  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    if (isInput) return;

    if (e.key === 'Escape') {
      if (editingCtx.isEditing) {
        editingCtx.isEditing = false;
        return;
      }
      if (selCtx.selectionStart.row !== -1) {
        resetSelection();
      }
      clearClipboard();
      setOpenPanel();
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      if (selCtx.selectionStart.row === -1) return;
      const row = selCtx.selectionStart.row;
      const col = selCtx.selectionStart.col;
      const key = keys[col];
      if (!key || key === 'id') return;
      startCellEdit(row, col);
      return;
    }

    if (e.metaKey || e.ctrlKey) {
      const k = e.key.toLowerCase();

      if (k === 'c') {
        e.preventDefault();
        if (!selCtx.isSelecting) return;
        clipCtx.isCopying = true;
        return;
      }

      if (k === 'v') {
        e.preventDefault();
        if (!selCtx.isSelecting) return;
        editingCtx.isPasting = true;
        return;
      }

      // TODO: Ctrl+Z (undo), Ctrl+Y (redo) — will be owned by EditHandler
    }

    // Arrow key navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      if (selCtx.hideSelection) selCtx.hideSelection = false;
      const colCount = keys.length;
      const anchor = selCtx.selectionStart;
      if (anchor.row === -1) return;

      if (e.metaKey || e.ctrlKey) {
        let targetRow = selCtx.selectionEnd.row;
        let targetCol = selCtx.selectionEnd.col;
        switch (e.key) {
          case 'ArrowUp':    targetRow = assets[0]?.id ?? targetRow; break;
          case 'ArrowDown':  targetRow = assets[assets.length - 1]?.id ?? targetRow; break;
          case 'ArrowLeft':  targetCol = 0; break;
          case 'ArrowRight': targetCol = colCount - 1; break;
        }
        if (e.shiftKey) {
          selCtx.selectionEnd = { row: targetRow, col: targetCol };
        } else {
          selectCell(targetRow, targetCol);
        }
        const idx = assetIndex(targetRow);
        if (idx !== -1) viewCtx.scrollToRow = idx;
        viewCtx.scrollToCol = colBounds(targetCol);
        return;
      }

      if (e.shiftKey) {
        const next = getArrowTarget(e.key, selCtx.selectionEnd, colCount);
        if (next) {
          selCtx.selectionEnd = next;
          const idx = assetIndex(next.row);
          if (idx !== -1) viewCtx.scrollToRow = idx;
          viewCtx.scrollToCol = colBounds(next.col);
        }
      } else {
        const next = getArrowTarget(e.key, anchor, colCount);
        if (next) {
          selectCell(next.row, next.col);
          const idx = assetIndex(next.row);
          if (idx !== -1) viewCtx.scrollToRow = idx;
          viewCtx.scrollToCol = colBounds(next.col);
        }
      }
    }
  }

  function getArrowTarget(
    key: string,
    current: { row: number; col: number },
    colCount: number,
  ): { row: number; col: number } | null {
    const idx = assetIndex(current.row);
    if (idx === -1) return null;
    const { col } = current;
    switch (key) {
      case 'ArrowUp':    return idx > 0 ? { row: assets[idx - 1].id, col } : null;
      case 'ArrowDown':  return idx < assets.length - 1 ? { row: assets[idx + 1].id, col } : null;
      case 'ArrowLeft':  return col > 0 ? { row: current.row, col: col - 1 } : null;
      case 'ArrowRight': return col < colCount - 1 ? { row: current.row, col: col + 1 } : null;
      default:           return null;
    }
  }

  // --- Mouse handlers ---
  function handleMouseDown(e: MouseEvent) {
    // Resize handle check — MUST come before header-col check (handle is inside header col)
    const handle = (e.target as HTMLElement).closest('[data-resize-handle]') as HTMLElement | null;
    if (handle) {
      // Close any open panels before starting resize
      setOpenPanel();

      const key = handle.dataset.resizeHandle!;
      const startWidth = colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH;
      resizeDrag = { key, startX: e.clientX, startWidth };
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Header click — close other panels, let GridHeader handle menu toggle
    const headerCol = (e.target as HTMLElement).closest('[data-header-col]') as HTMLElement | null;
    if (headerCol) return;

    const cell = (e.target as HTMLElement).closest('[data-row][data-col]') as HTMLElement | null;
    if (!cell) return;
    setOpenPanel('contextMenu');
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (isNaN(row) || isNaN(col)) return;
    if (editingCtx.isEditing) {
      selectCell(row, col);
      return;
    }
    startSelection(row, col, e);
  }

  function handleMouseOver(e: MouseEvent) {
    if (resizeDrag) return; // Don't extend selection while resizing
    const cell = (e.target as HTMLElement).closest('[data-row][data-col]') as HTMLElement | null;
    if (!cell) return;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (isNaN(row) || isNaN(col)) return;
    if (!editingCtx.isEditing) {
      extendSelection(row, col);
    }
  }

  function handleDblClick(e: MouseEvent) {
    const cell = (e.target as HTMLElement).closest('[data-row][data-col]') as HTMLElement | null;
    if (!cell) return;
    const row = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (isNaN(row) || isNaN(col)) return;
    const key = keys[col];
    if (key === 'id') {
      toastState.addToast('ID column cannot be edited.', 'warning');
      return;
    }
    e.preventDefault();
    selectCell(row, col);
    startCellEdit(row, col);
  }

  function handleContextMenu(e: MouseEvent) {
    const cell = (e.target as HTMLElement).closest('[data-row][data-col]') as HTMLElement | null;
    if (!cell) return;
    const assetId = Number(cell.dataset.row);
    const col = Number(cell.dataset.col);
    if (isNaN(assetId) || isNaN(col)) return;
    e.preventDefault();
    const asset = assets.find((a: Record<string, any>) => a.id === assetId);
    const key = keys[col];
    const value = String(asset?.[key] ?? '');
    selectCell(assetId, col);
    setOpenPanel('contextMenu');
    openContextMenu(e, assetId, col, value, key);
  }

  // --- Window-level event listeners ---
  $effect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizeDrag) return;
      const delta = e.clientX - resizeDrag.startX;
      const newWidth = Math.max(MIN_COLUMN_WIDTH, resizeDrag.startWidth + delta);
      colWidthCtx.widths.set(resizeDrag.key, newWidth);
    }

    function onMouseUp() {
      endSelection();
      if (resizeDrag) {
        document.body.style.cursor = '';
        resizeDrag = null;
      }
    }

    function onWindowClick(e: MouseEvent) {
      // Step 1: Snapshot current state before closing
      const wasHeaderKey = uiCtx.headerMenu.visible ? uiCtx.headerMenu.activeKey : '';
      const wasFilterOpen = uiCtx.filterPanel.visible;

      // Step 2: Close all panels
      setOpenPanel();

      // Step 3: If click was on a panel trigger, open it (unless toggling off)
      const headerCol = (e.target as HTMLElement).closest('[data-header-col]') as HTMLElement | null;
      if (headerCol) {
        const key = keys[Number(headerCol.dataset.headerCol)];
        if (key !== wasHeaderKey) {
          uiCtx.headerMenu.activeKey = key;
          uiCtx.headerMenu.visible = true;
        }
        return;
      }

      const filterTrigger = (e.target as HTMLElement).closest('[data-filter-trigger]');
      if (filterTrigger) {
        if (!wasFilterOpen) {
          uiCtx.filterPanel.visible = true;
        }
      }
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('click', onWindowClick);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('click', onWindowClick);
    };
  });

  // --- Overlay derivations ---
  const selectionOverlay = $derived(
    computeVisualOverlay(selCtx.selectionStart, selCtx.selectionEnd)
  );

  // Dirty cell overlays — per-cell with merged borders between adjacent dirty cells
  const dirtyCellOverlays = $derived.by(() => {
    if (pendingCtx.edits.length === 0) return [];
    const { startIndex, endIndex } = viewCtx.virtualScroll.visibleRange;
    const rowHeight = viewCtx.virtualScroll.rowHeight;

    // Map dirty cell coords for adjacency checks: "rowIdx,colIdx" → edit
    const editMap = new Map<string, typeof pendingCtx.edits[0]>();
    for (const edit of pendingCtx.edits) {
      const rowIdx = assets.findIndex((a: Record<string, any>) => a.id === edit.row);
      if (rowIdx === -1) continue;
      const colIdx = keys.indexOf(edit.col);
      if (colIdx === -1) continue;
      editMap.set(`${rowIdx},${colIdx}`, edit);
    }

    const overlays: { top: number; left: number; width: number; height: number; isValid: boolean; value: string; borderTop: boolean; borderBottom: boolean; borderLeft: boolean; borderRight: boolean }[] = [];

    for (const [coord, edit] of editMap) {
      const [rowIdx, colIdx] = coord.split(',').map(Number);
      if (rowIdx < startIndex || rowIdx >= endIndex) continue;

      let left = 0;
      for (let c = 0; c < colIdx; c++) left += getWidth(keys[c]);
      const w = getWidth(keys[colIdx]);
      const top = rowIdx * rowHeight + 32;

      // Hide border on edges adjacent to a dirty neighbor with same validity
      const sameAbove = editMap.get(`${rowIdx - 1},${colIdx}`)?.isValid === edit.isValid && editMap.has(`${rowIdx - 1},${colIdx}`);
      const sameBelow = editMap.get(`${rowIdx + 1},${colIdx}`)?.isValid === edit.isValid && editMap.has(`${rowIdx + 1},${colIdx}`);
      const sameLeft = editMap.get(`${rowIdx},${colIdx - 1}`)?.isValid === edit.isValid && editMap.has(`${rowIdx},${colIdx - 1}`);
      const sameRight = editMap.get(`${rowIdx},${colIdx + 1}`)?.isValid === edit.isValid && editMap.has(`${rowIdx},${colIdx + 1}`);

      overlays.push({
        top, left, width: w, height: rowHeight,
        isValid: edit.isValid, value: edit.value,
        borderTop: !sameAbove, borderBottom: !sameBelow,
        borderLeft: !sameLeft, borderRight: !sameRight,
      });
    }
    return overlays;
  });

  const copyOverlay = $derived(
    clipCtx.copyStart.row !== -1
      ? computeVisualOverlay(clipCtx.copyStart, clipCtx.copyEnd)
      : null
  );

  const otherUserSelections = $derived(
    Object.entries(realtime.connectedUsers).reduce(
      (acc, [clientId, position]) => {
        let rowIndex = -1;
        if (position.assetId !== undefined) {
          rowIndex = assets.findIndex((a: Record<string, any>) => a.id === position.assetId);
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

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_mouse_events_have_key_events -->
<div
  class="w-max min-w-full bg-white dark:bg-slate-800 text-left relative"
  style="height: {viewCtx.virtualScroll.getTotalHeight(assets.length) + 32 + 16}px;"
  tabindex="-1"
  onkeydown={handleKeyDown}
  onmousedown={handleMouseDown}
  onmouseover={handleMouseOver}
  ondblclick={handleDblClick}
  oncontextmenu={handleContextMenu}
>
  <!-- Other user cursors -->
  {#each Object.entries(otherUserSelections) as [clientId, position]}
    {@const otherOverlay = computeVisualOverlay(position, position)}
    {#if otherOverlay}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute pointer-events-none z-50"
        style="
            top: {otherOverlay.top}px;
            left: {otherOverlay.left}px;
            width: {otherOverlay.width}px;
            height: {otherOverlay.height}px;
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

  <!-- Copy overlay -->
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

  <!-- Dirty cell overlays — show pending value on top of the real cell -->
  {#each dirtyCellOverlays as cell}
    <div
      class="absolute pointer-events-none z-[5] flex items-center px-2 text-xs truncate
        {cell.isValid ? 'bg-green-50 dark:bg-slate-800' : 'bg-yellow-50 dark:bg-slate-800'}
        text-neutral-700 dark:text-neutral-200
        {cell.borderTop ? (cell.isValid ? 'border-t-2 border-t-green-400 dark:border-t-green-600' : 'border-t-2 border-t-yellow-500 dark:border-t-yellow-600') : 'border-t border-t-neutral-200 dark:border-t-slate-700'}
        {cell.borderBottom ? (cell.isValid ? 'border-b-2 border-b-green-400 dark:border-b-green-600' : 'border-b-2 border-b-yellow-500 dark:border-b-yellow-600') : 'border-b border-b-neutral-200 dark:border-b-slate-700'}
        {cell.borderLeft ? (cell.isValid ? 'border-l-2 border-l-green-400 dark:border-l-green-600' : 'border-l-2 border-l-yellow-500 dark:border-l-yellow-600') : 'border-l border-l-neutral-200 dark:border-l-slate-700'}
        {cell.borderRight ? (cell.isValid ? 'border-r-2 border-r-green-400 dark:border-r-green-600' : 'border-r-2 border-r-yellow-500 dark:border-r-yellow-600') : 'border-r border-r-neutral-200 dark:border-r-slate-700'}"
      style="top: {cell.top}px; left: {cell.left}px; width: {cell.width}px; height: {cell.height}px;"
    >
      <span class="truncate w-full">{cell.value}</span>
    </div>
  {/each}

  <!-- Selection overlay -->
  {#if selectionOverlay && selCtx.selectionStart.row !== -1 && !selCtx.hideSelection}
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

  <!-- Children: GridHeader, GridRows, EditHandler -->
  {@render children()}

  {#if uiCtx.contextMenu.visible}
    <ContextMenu
      visible={true}
      x={ctxMenu.x}
      y={ctxMenu.y}
      row={ctxMenu.row}
      col={ctxMenu.col}
      value={ctxMenu.value}
      cellKey={ctxMenu.key}
      onclose={() => uiCtx.contextMenu.visible = false}
    />
  {/if}
</div>
