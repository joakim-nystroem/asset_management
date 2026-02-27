<script lang="ts">
  import {
    getColumnContext,
    getDataContext,
    getViewContext,
    getUiContext,
    getSortContext,
  } from '$lib/context/gridContext.svelte.ts';
  import { createColumnController } from '$lib/grid/utils/gridColumns.svelte.ts';
  import { createRowController } from '$lib/grid/utils/gridRows.svelte.ts';
  import GridRow from '$lib/components/grid/GridRow.svelte';
  import GridHeader from '$lib/components/grid/GridHeader.svelte';
  import GridOverlays from '$lib/components/grid/GridOverlays.svelte';
  import HeaderMenu from '$lib/grid/components/header-menu/headerMenu.svelte';
  import { searchManager } from '$lib/data/searchManager.svelte';
  // NO import of ContextMenu, editDropdown, autocomplete, FloatingEditor

  // Zero props — reads assets from dataCtx directly

  const colCtx = getColumnContext();
  const dataCtx = getDataContext();
  const viewCtx = getViewContext();
  const uiCtx = getUiContext();
  const sortCtx = getSortContext();

  const columns = createColumnController();
  const virtualScroll = viewCtx.virtualScroll;  // shared instance from context
  const rows = createRowController();

  const assets = $derived(dataCtx.assets);

  let scrollContainer: HTMLDivElement | null = $state(null);
  const visibleData = $derived(virtualScroll.getVisibleItems(assets));

  function handleScroll(e: Event) {
    virtualScroll.handleScroll(e);
    if (uiCtx.headerMenu?.activeKey) uiCtx.headerMenu.reposition();
  }

  // Observe viewCtx.scrollToRow — call ensureVisible then reset
  $effect(() => {
    const row = viewCtx.scrollToRow;
    if (row !== null && scrollContainer) {
      virtualScroll.ensureVisible(row, 0, scrollContainer, colCtx.keys, columns, rows);
      viewCtx.scrollToRow = null;
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

  function handleHeaderClick(e: MouseEvent, key: string, _filterItems: string[], isLast: boolean) {
    uiCtx.contextMenu?.close();
    const filterItems = searchManager.getFilterItems(key, dataCtx.assets, dataCtx.baseAssets);
    uiCtx.headerMenu?.toggle(e, key, filterItems, isLast);
  }
</script>

{#if assets.length > 0}
  <div
    bind:this={scrollContainer}
    onscroll={handleScroll}
    class="rounded-lg border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-auto h-[calc(100dvh-8.9rem)] shadow-md relative select-none focus:outline-none"
    tabindex="-1"
  >
    {#if uiCtx.headerMenu}
      <HeaderMenu
        state={uiCtx.headerMenu}
        sortState={{ key: sortCtx.sortKey ?? '', direction: sortCtx.sortDirection ?? 'asc' }}
        {searchManager}
        {assets}
        baseAssets={dataCtx.baseAssets}
        onSort={(key, dir) => uiCtx.applySort?.(key, dir)}
        onFilterSelect={(item, key) => uiCtx.handleFilterSelect?.(item, key)}
      />
    {/if}

    <!--
      GridOverlays wraps GridHeader + rows as snippet children.
      It owns all keyboard/mouse handling and renders overlay layers.
      The height style must be on the GridOverlays root div (handled via style prop below).
    -->
    <GridOverlays style="height: {virtualScroll.getTotalHeight(assets.length, rows) + 32 + 16}px;">
      {#snippet children()}
        <GridHeader
          keys={colCtx.keys}
          onHeaderClick={handleHeaderClick}
          onCloseContextMenu={() => uiCtx.contextMenu?.close()}
        />

        <div
          class="absolute top-8 w-full"
          style="transform: translateY({virtualScroll.getOffsetY(rows)}px);"
        >
          {#each visibleData.items as asset, i (asset.id || visibleData.startIndex + i)}
            {@const actualIndex = visibleData.startIndex + i}
            {@const rowHeight = rows.getHeight(actualIndex)}
            {@const isNewRow = actualIndex >= dataCtx.filteredAssetsCount}

            <div
              class="flex border-b border-neutral-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 {isNewRow ? 'bg-blue-200 dark:bg-blue-500/20' : ''}"
              style="height: {rowHeight}px;"
            >
              <GridRow
                {asset}
                keys={colCtx.keys}
                {actualIndex}
              />
            </div>
          {/each}
        </div>
      {/snippet}
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
