<script lang="ts">
  import { pendingStore, selectionStore, clipboardStore } from '$lib/data/cellStore.svelte';
  import { presenceStore } from '$lib/data/presenceStore.svelte';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import { scrollStore } from '$lib/data/scrollStore.svelte';
  import { DEFAULT_ROW_HEIGHT } from '$lib/grid/gridConfig';
  import {
    computeVisualOverlay,
    computeLocalPendingOverlays,
    computeRemotePendingOverlays,
    computeRowLockOverlays,
  } from './gridOverlays.svelte.ts';

  // --- Local UI state ---
  let hoveredUser: number | null = $state(null);

  // --- Derived data ---
  const assets = $derived(assetStore.displayedAssets);

  // --- Overlay derivations ---
  const selectionOverlay = $derived(
    computeVisualOverlay(selectionStore.selectionStart, selectionStore.selectionEnd, scrollStore.visibleRange, scrollStore.scrollTop)
  );

  const localPendingOverlays = $derived.by(() =>
    computeLocalPendingOverlays(pendingStore.edits, scrollStore.visibleRange, scrollStore.scrollTop)
  );

  const copyOverlay = $derived(
    clipboardStore.copyStart.row !== -1
      ? computeVisualOverlay(clipboardStore.copyStart, clipboardStore.copyEnd, scrollStore.visibleRange, scrollStore.scrollTop)
      : null
  );

  const pasteOverlay = $derived(
    selectionStore.pasteRange
      ? computeVisualOverlay(selectionStore.pasteRange.start, selectionStore.pasteRange.end, scrollStore.visibleRange, scrollStore.scrollTop)
      : null
  );

  const otherUserSelections = $derived(presenceStore.users);

  const remotePendingOverlays = $derived.by(() =>
    computeRemotePendingOverlays(presenceStore.pendingCells, scrollStore.visibleRange, scrollStore.scrollTop)
  );

  const rowLockOverlays = $derived.by(() =>
    computeRowLockOverlays(presenceStore.rowLocks, scrollStore.visibleRange, scrollStore.scrollTop)
  );
</script>

<div
  class="absolute top-0 left-0 w-max min-w-full pointer-events-none"
  style="height: {assets.length * DEFAULT_ROW_HEIGHT + 16}px;"
>
  <!-- Other user cursors -->
  {#each otherUserSelections as user (user.id)}
    {@const otherOverlay = computeVisualOverlay(user, user, scrollStore.visibleRange, scrollStore.scrollTop)}
    {@const initials = ((user.firstname?.[0] || '') + (user.lastname?.[0] || '')).toUpperCase()}
    {@const fullName = `${user.firstname || ''} ${user.lastname || ''}`.trim()}
    {#if otherOverlay}
      <div
        class="absolute pointer-events-none z-[40]"
        style="
            top: {otherOverlay.top}px;
            left: {otherOverlay.left}px;
            width: {otherOverlay.width}px;
            height: {otherOverlay.height}px;
            border: {user.isLocked ? '2px' : '1px'} solid {user.color};
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
            background-color: {user.color};
            min-width: 16px;
            max-width: {hoveredUser === user.id ? '200px' : '16px'};
            transition: max-width 0.2s ease-in-out, background-color 0.2s ease-in-out;
          "
          onmouseenter={() => hoveredUser = user.id}
          onmouseleave={() => hoveredUser = null}
        >
          <div class="{hoveredUser === user.id ? 'px-1' : ''} whitespace-nowrap">
            {#if user.isLocked}
              {hoveredUser === user.id ? `${fullName} editing...` : '...'}
            {:else}
              {hoveredUser === user.id ? fullName : initials}
            {/if}
          </div>
        </div>
      </div>
    {/if}
  {/each}

  <!-- Other users' pending cells (colored shading + lock icon) -->
  {#each remotePendingOverlays as cell}
    <div
      class="absolute pointer-events-none z-[41] flex items-center"
      style="
        top: {cell.top}px;
        left: {cell.left}px;
        width: {cell.width}px;
        height: {cell.height}px;
        background-color: {cell.color}30;
        border: 2px solid {cell.color}80;
        box-sizing: border-box;
      "
    >
      <svg class="w-3 h-3 ml-auto mr-1 opacity-90" fill="none" stroke="{cell.color}" viewBox="0 0 24 24" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    </div>
  {/each}

  <!-- Row lock overlays -->
  {#each rowLockOverlays as row}
    <div
      class="absolute pointer-events-none z-[41] flex items-center"
      style="
        top: {row.top}px;
        left: 0;
        width: {row.width}px;
        height: {row.height}px;
        background-color: {row.color}20;
        border: 2px solid {row.color}60;
        box-sizing: border-box;
      "
    >
      <svg class="absolute opacity-80 w-3 h-3" style="left: {row.firstCellWidth - 16}px; top: 50%; transform: translateY(-50%);" fill="none" stroke="{row.color}" viewBox="0 0 24 24" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
      </svg>
    </div>
  {/each}

  <!-- Copy overlay -->
  {#if copyOverlay}
    <div
      class="absolute pointer-events-none z-[10] border-cell-copy-border"
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

  <!-- Paste range overlay -->
  {#if pasteOverlay}
    <div
      class="absolute pointer-events-none z-[30] border-cell-paste-border"
      style="
      top: {pasteOverlay.top}px;
      left: {pasteOverlay.left}px;
      width: {pasteOverlay.width}px;
      height: {pasteOverlay.height}px;
      border-top-style: {pasteOverlay.showTopBorder ? 'dashed' : 'none'};
      border-bottom-style: {pasteOverlay.showBottomBorder ? 'dashed' : 'none'};
      border-left-style: {pasteOverlay.showLeftBorder ? 'dashed' : 'none'};
      border-right-style: {pasteOverlay.showRightBorder ? 'dashed' : 'none'};
      border-width: 2px;"
    ></div>
  {/if}

  <!-- Local pending cell overlays -->
  {#each localPendingOverlays as cell}
    <div
      class="absolute pointer-events-none z-[20] bg-bg-card"
      style="top: {cell.top}px; left: {cell.left}px; width: {cell.width}px; height: {cell.height}px;"
    ></div>
    <div
      class="absolute pointer-events-none flex items-center px-1.5 text-xs truncate text-text-secondary z-[21]
        {cell.isValid ? 'bg-cell-valid/20' : 'bg-cell-invalid/20'}
        {cell.borderTop ? (cell.isValid ? 'border-t-2 border-t-cell-valid-border' : 'border-t-2 border-t-cell-invalid-border') : 'border-t border-t-neutral-200 dark:border-t-slate-700'}
        {cell.borderBottom ? (cell.isValid ? 'border-b-2 border-b-cell-valid-border' : 'border-b-2 border-b-cell-invalid-border') : 'border-b border-b-neutral-200 dark:border-b-slate-700'}
        {cell.borderLeft ? (cell.isValid ? 'border-l-2 border-l-cell-valid-border' : 'border-l-2 border-l-cell-invalid-border') : 'border-l border-l-neutral-200 dark:border-l-slate-700'}
        {cell.borderRight ? (cell.isValid ? 'border-r-2 border-r-cell-valid-border' : 'border-r-2 border-r-cell-invalid-border') : 'border-r border-r-neutral-200 dark:border-r-slate-700'}"
      style="top: {cell.top}px; left: {cell.left}px; width: {cell.width}px; height: {cell.height}px;"
    >
      <span class="truncate w-full">{cell.value}</span>
    </div>

  {/each}

  <!-- Selection overlay -->
  {#if selectionOverlay && selectionStore.selectionStart.row !== -1 && !selectionStore.hideSelection}
    <div
      class="absolute pointer-events-none z-[31] border-blue-600 dark:border-blue-500 bg-blue-900/10"
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
