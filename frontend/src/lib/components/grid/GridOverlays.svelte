<script lang="ts">
  import { selection } from "$lib/utils/interaction/selectionManager.svelte";
  import { columnManager } from "$lib/utils/core/columnManager.svelte";
  import { changeManager } from "$lib/utils/interaction/changeManager.svelte";
  import { rowGenerationManager } from "$lib/utils/interaction/rowGenerationManager.svelte";

  type Props = {
    keys: string[];
    assets: Record<string, any>[];
    filteredAssetsLength: number;
    otherUserSelections: Record<string, any>;
    hoveredUser: string | null;
    selectionOverlay: any;
    copyOverlay: any;
    dirtyCellOverlays: any[];
    virtualScroll: any;
    onHoverUser: (clientId: string | null) => void;
  };

  let {
    keys, assets, filteredAssetsLength, otherUserSelections, hoveredUser,
    selectionOverlay, copyOverlay, dirtyCellOverlays, virtualScroll,
    onHoverUser,
  }: Props = $props();
</script>

{#each Object.entries(otherUserSelections) as [clientId, position]}
  {@const otherUserOverlay = selection.computeVisualOverlay(
    position,
    position,
    virtualScroll.visibleRange,
    keys,
    columnManager,
    virtualScroll.rowHeight,
  )}
  {#if otherUserOverlay}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- Wrapper: pointer-events-none to allow selection of the cell underneath -->
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
      <!-- Badge: pointer-events-auto to allow interaction -->
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
        onmouseenter={() => onHoverUser(clientId)}
        onmouseleave={() => onHoverUser(null)}
      >
        <div
          class="{hoveredUser === clientId
            ? 'px-1'
            : ''} whitespace-nowrap"
        >
          {#if position.editing}
            {hoveredUser === clientId
              ? `${position.fullName} editing...`
              : '...'}
          {:else}
            {hoveredUser === clientId
              ? position.fullName
              : position.initials}
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

    border-bottom-style: {copyOverlay.showBottomBorder
      ? 'dashed'
      : 'none'};
    border-left-style: {copyOverlay.showLeftBorder ? 'dashed' : 'none'};
    border-right-style: {copyOverlay.showRightBorder
      ? 'dashed'
      : 'none'};
    border-width: 2px;"
  ></div>
{/if}

{#if selectionOverlay && selection.isSelectionVisible}
  <div
    class="absolute pointer-events-none z-10 border-blue-600 dark:border-blue-500 bg-blue-900/10"
    style="
        top: {selectionOverlay.top}px;
        left: {selectionOverlay.left}px;

        width: {selectionOverlay.width}px;
        height: {selectionOverlay.height}px;
        border-top-style: {selectionOverlay.showTopBorder
      ? 'solid'
      : 'none'};
        border-bottom-style: {selectionOverlay.showBottomBorder
      ? 'solid'
      : 'none'};
        border-left-style: {selectionOverlay.showLeftBorder
      ? 'solid'
      : 'none'};

        border-right-style: {selectionOverlay.showRightBorder
      ? 'solid'
      : 'none'};
        border-width: 2px;"
  ></div>
{/if}

{#each dirtyCellOverlays as overlay}
  {@const overlayRowIndex = virtualScroll.visibleRange.startIndex + Math.floor(overlay.top / virtualScroll.rowHeight)}
  {@const overlayColIndex = (() => {
    let accWidth = 0;
    for (let c = 0; c < keys.length; c++) {
      const colWidth = columnManager.getWidth(keys[c]);
      if (overlay.left < accWidth + colWidth) return c;
      accWidth += colWidth;
    }
    return 0;
  })()}
  {@const overlayKey = keys[overlayColIndex]}
  {@const overlayAsset = assets[overlayRowIndex]}
  {@const isNewRowOverlay = overlayRowIndex >= filteredAssetsLength}
  {@const isInvalid = isNewRowOverlay
    ? rowGenerationManager.isNewRowFieldInvalid(overlayRowIndex - filteredAssetsLength, overlayKey)
    : changeManager.isInvalid(overlayAsset?.id, overlayKey)}
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
