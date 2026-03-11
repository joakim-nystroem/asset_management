<script lang="ts">
  import {
    getPendingContext,
    getSelectionContext,
    getClipboardContext,
    getColumnWidthContext,
    getPresenceContext,
  } from '$lib/context/gridContext.svelte.ts';
  import { assetStore } from '$lib/data/assetStore.svelte';

  import { DEFAULT_WIDTH, DEFAULT_ROW_HEIGHT } from '$lib/grid/gridConfig';

  let { scrollTop, visibleRange }: {
    scrollTop: number;
    visibleRange: { startIndex: number; endIndex: number };
  } = $props();

  const pendingCtx = getPendingContext();
  const selCtx = getSelectionContext();
  const clipCtx = getClipboardContext();
  const colWidthCtx = getColumnWidthContext();
  const presenceCtx = getPresenceContext();

  // --- Local UI state ---
  let hoveredUser: number | null = $state(null);

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

  // --- Overlay computation ---
  function computeVisualOverlay(
    start: { row: number; col: string },
    end: { row: number; col: string },
  ) {
    const { startIndex, endIndex } = visibleRange;
    const rowHeight = DEFAULT_ROW_HEIGHT;

    const startRowIdx = assetIndex(start.row);
    const endRowIdx = assetIndex(end.row);
    if (startRowIdx === -1 || endRowIdx === -1) return null;

    const startColIdx = keys.indexOf(start.col);
    const endColIdx = keys.indexOf(end.col);
    if (startColIdx === -1 || endColIdx === -1) return null;

    const minRow = Math.min(startRowIdx, endRowIdx);
    const maxRow = Math.max(startRowIdx, endRowIdx);
    const minCol = Math.min(startColIdx, endColIdx);
    const maxCol = Math.max(startColIdx, endColIdx);

    const clampedMinRow = Math.max(minRow, startIndex);
    const clampedMaxRow = Math.min(maxRow, endIndex - 1);
    if (clampedMinRow > clampedMaxRow) return null;

    let left = 0;
    for (let c = 0; c < minCol; c++) left += getWidth(keys[c]);
    let width = 0;
    for (let c = minCol; c <= maxCol; c++) width += getWidth(keys[c]);

    const top = clampedMinRow * rowHeight - scrollTop;
    const height = (clampedMaxRow - clampedMinRow + 1) * rowHeight;

    return {
      top, left, width, height,
      showTopBorder: minRow >= startIndex,
      showBottomBorder: maxRow < endIndex,
      showLeftBorder: true,
      showRightBorder: true,
    };
  }

  // --- Overlay derivations ---
  const selectionOverlay = $derived(
    computeVisualOverlay(selCtx.selectionStart, selCtx.selectionEnd)
  );

  const dirtyCellOverlays = $derived.by(() => {
    if (pendingCtx.edits.length === 0) return [];
    const { startIndex, endIndex } = visibleRange;
    const rowHeight = DEFAULT_ROW_HEIGHT;

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
      const top = rowIdx * rowHeight - scrollTop;

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

  const otherUserSelections = $derived.by(() => {
    const result: Record<number, any> = {};
    for (const user of presenceCtx.users) {
      const rowIndex = assets.findIndex((a: Record<string, any>) => a.id === user.row);
      if (rowIndex === -1) continue;
      result[user.id] = {
        ...user,
        row: rowIndex,
        initials: (
          (user.firstname?.[0] || '') + (user.lastname?.[0] || '')
        ).toUpperCase(),
        fullName: `${user.firstname?.[0]?.toUpperCase() || ''}${user.firstname?.slice(1) || ''} ${user.lastname?.[0]?.toUpperCase() || ''}${user.lastname?.slice(1) || ''}`.trim(),
      };
    }
    return result;
  });
</script>

<div
  class="absolute top-0 left-0 w-max min-w-full pointer-events-none"
  style="height: {assets.length * DEFAULT_ROW_HEIGHT + 16}px;"
>
  <!-- Other user cursors -->
  {#each Object.entries(otherUserSelections) as [userId, position]}
    {@const otherOverlay = computeVisualOverlay(position, position)}
    {#if otherOverlay}
      <div
        class="absolute pointer-events-none z-[15]"
        style="
            top: {otherOverlay.top}px;
            left: {otherOverlay.left}px;
            width: {otherOverlay.width}px;
            height: {otherOverlay.height}px;
            border: {position.isLocked ? '2px' : '1px'} solid {position.color};
            box-sizing: border-box;
          "
      >
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="absolute flex items-center justify-center text-white text-[10px] rounded-full font-bold shadow-sm overflow-hidden pointer-events-auto cursor-default"
          style="
            top: -8px;
            right: -8px;
            height: 16px;
            background-color: {position.color};
            min-width: 16px;
            max-width: {hoveredUser === position.id ? '200px' : '16px'};
            transition: max-width 0.2s ease-in-out, background-color 0.2s ease-in-out;
          "
          onmouseenter={() => hoveredUser = position.id}
          onmouseleave={() => hoveredUser = null}
        >
          <div class="{hoveredUser === position.id ? 'px-1' : ''} whitespace-nowrap">
            {#if position.isLocked}
              {hoveredUser === position.id ? `${position.fullName} editing...` : '...'}
            {:else}
              {hoveredUser === position.id ? position.fullName : position.initials}
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/each}

  <!-- Copy overlay -->
  {#if copyOverlay}
    <div
      class="absolute pointer-events-none z-10 border-blue-600 dark:border-blue-500"
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

  <!-- Dirty cell overlays -->
  {#each dirtyCellOverlays as cell}
    <div
      class="absolute pointer-events-none z-[89] bg-white dark:bg-slate-800"
      style="top: {cell.top}px; left: {cell.left}px; width: {cell.width}px; height: {cell.height}px;"
    ></div>
    <div
      class="absolute pointer-events-none flex items-center px-1.5 text-xs truncate text-neutral-700 dark:text-neutral-200 z-[90]
        {cell.isValid ? 'bg-green-400/20 dark:bg-green-400/10' : 'bg-yellow-400/20 dark:bg-yellow-400/10'}
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
</div>
