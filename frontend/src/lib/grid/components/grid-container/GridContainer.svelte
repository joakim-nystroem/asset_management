<script lang="ts">
  import { getViewContext, getUiContext, getColumnWidthContext } from '$lib/context/gridContext.svelte.ts';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import { DEFAULT_WIDTH } from '$lib/grid/gridConfig';
  import GridRow from '$lib/grid/components/grid-row/GridRow.svelte';
  import GridHeader from '$lib/grid/components/grid-header/GridHeader.svelte';
  import GridOverlays from '$lib/grid/components/grid-overlays/GridOverlays.svelte';
  import EditHandler from '$lib/grid/components/edit-handler/EditHandler.svelte';
  import ContextMenu from '$lib/grid/components/context-menu/contextMenu.svelte';
  import CustomScrollbar from '$lib/grid/components/custom-scrollbar/CustomScrollbar.svelte';
  import { createScrollbarState, type ScrollbarSize } from '$lib/grid/components/custom-scrollbar/customScrollbar.svelte.ts';

  const viewCtx = getViewContext();
  const uiCtx = getUiContext();
  const colWidthCtx = getColumnWidthContext();
  const virtualScroll = viewCtx.virtualScroll;
  const scrollbar = createScrollbarState();
  const scrollbarSize: ScrollbarSize = 'thin';

  const assets = $derived(assetStore.filteredAssets);
  const keys = $derived(Object.keys(assets[0] ?? {}));
  const visibleData = $derived(virtualScroll.getVisibleItems(assets));

  // Total content width from column widths
  const contentWidth = $derived(
    keys.reduce((sum, key) => sum + (colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH), 0)
  );

  // Total content height: rows + horizontal scrollbar track height
  const contentHeight = $derived(virtualScroll.getTotalHeight(assets.length) + scrollbar.TRACK_SIZES[scrollbarSize]);

  // Keep scrollbar content dimensions in sync
  $effect(() => {
    scrollbar.setDimensions(contentWidth, contentHeight, scrollbar.viewportWidth, scrollbar.viewportHeight);
  });

  // Sync viewport height to virtual scroll when scrollbar reports it
  $effect(() => {
    if (scrollbar.viewportHeight > 0) {
      virtualScroll.updateContainerHeight(scrollbar.viewportHeight);
    }
  });

  // Wire viewCtx.setScroll to scrollbar so EventListener can drive scrolling
  viewCtx.setScroll = (top: number, left: number) => {
    scrollbar.setScroll(top, left);
    handleScrollbarScroll(scrollbar.scrollTop, scrollbar.scrollLeft);
  };

  // Sync scrollbar scrollTop → virtual scroll + viewCtx
  function handleScrollbarScroll(scrollTop: number, scrollLeft: number) {
    virtualScroll.updateScrollTop(scrollTop);
    viewCtx.scrollTop = scrollTop;
    viewCtx.scrollLeft = scrollLeft;
    if (uiCtx.contextMenu.visible) uiCtx.contextMenu.visible = false;
  }

  // Observe viewCtx.scrollToRow — ensureVisible (only scroll if out of viewport)
  $effect(() => {
    const row = viewCtx.scrollToRow;
    if (row !== null) {
      const rowTop = row * virtualScroll.rowHeight;
      const rowBottom = rowTop + virtualScroll.rowHeight;
      const viewTop = scrollbar.scrollTop;
      const viewBottom = scrollbar.scrollTop + scrollbar.viewportHeight;

      if (rowTop < viewTop) {
        scrollbar.scrollTop = rowTop;
      } else if (rowBottom > viewBottom) {
        scrollbar.scrollTop = rowBottom - scrollbar.viewportHeight + 40;
      }

      virtualScroll.updateScrollTop(scrollbar.scrollTop);
      viewCtx.scrollToRow = null;
    }
  });

  // Observe viewCtx.scrollToCol — horizontal ensureVisible
  $effect(() => {
    const col = viewCtx.scrollToCol;
    if (col !== null) {
      const viewLeft = scrollbar.scrollLeft;
      const viewRight = scrollbar.scrollLeft + scrollbar.viewportWidth;

      if (col.left < viewLeft) {
        scrollbar.scrollLeft = col.left;
      } else if (col.right > viewRight) {
        scrollbar.scrollLeft = col.right - scrollbar.viewportWidth;
      }

      viewCtx.scrollToCol = null;
    }
  });
</script>

{#if assets.length > 0}
  <div
    class="rounded-lg border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md relative select-none focus:outline-none"
    tabindex="-1"
  >
    <!-- Header: scrolls horizontally, stays pinned vertically -->
    <div class="overflow-hidden">
      <div style="transform: translateX({-scrollbar.scrollLeft}px);">
        <GridHeader {keys} />
      </div>
    </div>

    <!-- Scrollable grid body -->
    <CustomScrollbar
      scroll={scrollbar}
      height="calc(100dvh - 8.9rem - 32px)"
      size={scrollbarSize}
      vertical
      horizontal
      onscroll={handleScrollbarScroll}
    >
      <div class="relative h-full">
        <div style="transform: translateX({-scrollbar.scrollLeft}px);">
          <GridOverlays />

          <div
            class="absolute top-0 w-full"
            style="transform: translateY({visibleData.startIndex * virtualScroll.rowHeight - scrollbar.scrollTop}px);"
          >
            {#each visibleData.items as asset, i (asset.id || visibleData.startIndex + i)}
              <GridRow {asset} {keys} />
            {/each}
          </div>

          <EditHandler />
        </div>
      </div>
    </CustomScrollbar>

    {#if uiCtx.contextMenu.visible}
      <ContextMenu />
    {/if}
  </div>
  <p class="mt-2 ml-1 text-sm text-neutral-600 dark:text-neutral-300">
    Showing {assets.length} items.
  </p>
{:else}
  <div
    class="flex items-center justify-center rounded-lg border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden h-[calc(100dvh-8.9rem)] shadow-md relative select-none focus:outline-none"
  >
    <p class="text-lg text-neutral-400">Query successful, but no data was returned.</p>
  </div>
{/if}
