<script lang="ts">
  import { getColumnWidthContext, getUiContext } from '$lib/context/gridContext.svelte.ts';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import { DEFAULT_WIDTH, DEFAULT_ROW_HEIGHT } from '$lib/grid/gridConfig';
  import GridRow from '$lib/grid/components/grid-row/GridRow.svelte';
  import GridHeader from '$lib/grid/components/grid-header/GridHeader.svelte';
  import GridOverlays from '$lib/grid/components/grid-overlays/GridOverlays.svelte';
  import EditHandler from '$lib/grid/components/edit-handler/EditHandler.svelte';
  import ContextMenu from '$lib/grid/components/context-menu/contextMenu.svelte';
  import VirtualScrollManager from '$lib/grid/components/virtual-scroll/VirtualScrollManager.svelte';

  const uiCtx = getUiContext();
  const colWidthCtx = getColumnWidthContext();

  const keys = $derived(Object.keys(assetStore.displayedAssets[0] ?? {}));

  // Scroll state — bound to VirtualScrollManager
  let scrollTop = $state(0);
  let scrollLeft = $state(0);
  let visibleRange = $state({ startIndex: 0, endIndex: 0 });

  // Total content width from column widths
  const contentWidth = $derived(
    keys.reduce((sum, key) => sum + (colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH), 0)
  );

  // Close menus on scroll — they're fixed-position and detach from their parent cell
  let prevScrollTop = 0;
  let prevScrollLeft = 0;
  $effect(() => {
    const top = scrollTop;
    const left = scrollLeft;
    if (top === prevScrollTop && left === prevScrollLeft) return;
    prevScrollTop = top;
    prevScrollLeft = left;
    if (uiCtx.contextMenu.visible) uiCtx.contextMenu.visible = false;
    // if (uiCtx.headerMenu.visible) { uiCtx.headerMenu.visible = false; uiCtx.headerMenu.activeKey = ''; }
  });

  // Visible items slice
  const visibleItems = $derived(
    assetStore.displayedAssets.slice(visibleRange.startIndex, visibleRange.endIndex)
  );

</script>

{#if assetStore.displayedAssets.length > 0}
  <div
    class="rounded-lg border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md relative select-none focus:outline-none overflow-hidden"
    tabindex="-1"
  >
    <!-- Header: scrolls horizontally, stays pinned vertically -->
    <div class="relative z-10">
      <div style="transform: translateX({-scrollLeft}px);">
        <GridHeader {keys} />
      </div>
    </div>

    <!-- Scrollable grid body -->
    <VirtualScrollManager
      bind:scrollTop
      bind:scrollLeft
      bind:visibleRange
      rowCount={assetStore.displayedAssets.length}
      {contentWidth}
      height="calc(100dvh - 8.9rem - 32px)"
    >
      <div class="relative h-full">
        <div style="transform: translateX({-scrollLeft}px);">
          <GridOverlays {scrollTop} {visibleRange} />

          <div
            class="absolute top-0 w-full"
            style="top: {visibleRange.startIndex * DEFAULT_ROW_HEIGHT - scrollTop}px;"
          >
            {#each visibleItems as asset, i (asset.id || visibleRange.startIndex + i)}
              <GridRow {asset} {keys} />
            {/each}
          </div>

          <EditHandler {scrollTop} />
        </div>
      </div>
    </VirtualScrollManager>

    {#if uiCtx.contextMenu.visible}
      <ContextMenu />
    {/if}
  </div>
  <p class="mt-2 ml-1 text-sm text-neutral-600 dark:text-neutral-300">
    Showing {assetStore.displayedAssets.length} items.
  </p>
{:else}
  <div
    class="flex items-center justify-center rounded-lg border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden h-[calc(100dvh-8.9rem)] shadow-md relative select-none focus:outline-none"
  >
    <p class="text-lg text-neutral-400">Query successful, but no data was returned.</p>
  </div>
{/if}
