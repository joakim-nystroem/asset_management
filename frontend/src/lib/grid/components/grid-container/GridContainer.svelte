<script lang="ts">
  import { getViewContext } from '$lib/context/gridContext.svelte.ts';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import GridRow from '$lib/grid/components/grid-row/GridRow.svelte';
  import GridHeader from '$lib/grid/components/grid-header/GridHeader.svelte';
  import GridOverlays from '$lib/grid/components/grid-overlays/GridOverlays.svelte';
  import EditHandler from '$lib/grid/components/edit-handler/EditHandler.svelte';
  const viewCtx = getViewContext();
  const virtualScroll = viewCtx.virtualScroll;

  const assets = $derived(assetStore.filteredAssets);
  const keys = $derived(Object.keys(assets[0] ?? {}));

  let scrollContainer: HTMLDivElement | null = $state(null);
  const visibleData = $derived(virtualScroll.getVisibleItems(assets));

  function handleScroll(e: Event) {
    virtualScroll.handleScroll(e);
  }

  // Observe viewCtx.scrollToRow — ensureVisible (only scroll if out of viewport)
  $effect(() => {
    const row = viewCtx.scrollToRow;
    if (row !== null && scrollContainer) {
      const headerHeight = 32;
      const rowTop = row * virtualScroll.rowHeight + headerHeight;
      const rowBottom = rowTop + virtualScroll.rowHeight;
      const viewTop = scrollContainer.scrollTop + headerHeight;
      const viewBottom = scrollContainer.scrollTop + scrollContainer.clientHeight;

      if (rowTop < viewTop) {
        scrollContainer.scrollTop = rowTop - headerHeight;
      } else if (rowBottom > viewBottom) {
        scrollContainer.scrollTop = rowBottom - scrollContainer.clientHeight + 40;
      }

      viewCtx.scrollToRow = null;
    }
  });

  // Observe viewCtx.scrollToCol — horizontal ensureVisible
  $effect(() => {
    const col = viewCtx.scrollToCol;
    if (col !== null && scrollContainer) {
      const viewLeft = scrollContainer.scrollLeft;
      const viewRight = scrollContainer.scrollLeft + scrollContainer.clientWidth;

      if (col.left < viewLeft) {
        scrollContainer.scrollLeft = col.left;
      } else if (col.right > viewRight) {
        scrollContainer.scrollLeft = col.right - scrollContainer.clientWidth;
      }

      viewCtx.scrollToCol = null;
    }
  });

  // ResizeObserver for container height
  $effect(() => {
    let ro: ResizeObserver | null = null;
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
      ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          virtualScroll.updateContainerHeight(entry.contentRect.height);
        }
      });
      ro.observe(scrollContainer);
    }
    return () => { if (ro) ro.disconnect(); };
  });
</script>

{#if assets.length > 0}
  <div
    bind:this={scrollContainer}
    onscroll={handleScroll}
    class="rounded-lg border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-auto h-[calc(100dvh-8.9rem)] shadow-md relative select-none focus:outline-none"
    tabindex="-1"
  >
    <GridOverlays>
      <GridHeader {keys} />

      <div
        class="absolute top-8 w-full"
        style="transform: translateY({virtualScroll.getOffsetY()}px);"
      >
        {#each visibleData.items as asset, i (asset.id || visibleData.startIndex + i)}
          <div
            class="flex border-b border-neutral-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700"
            style="height: {virtualScroll.rowHeight}px;"
          >
            <GridRow {asset} {keys} />
          </div>
        {/each}
      </div>

      <EditHandler />
    </GridOverlays>
  </div>
  <p class="mt-2 ml-1 text-sm text-neutral-600 dark:text-neutral-300">
    Showing {assets.length} items.
  </p>
{:else}
  <div
    class="flex items-center justify-center rounded-lg border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-auto h-[calc(100dvh-8.9rem)] shadow-md relative select-none focus:outline-none"
  >
    <p class="text-lg text-neutral-400">Query successful, but no data was returned.</p>
  </div>
{/if}
