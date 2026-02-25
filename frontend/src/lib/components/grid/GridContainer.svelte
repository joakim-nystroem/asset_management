<script lang="ts">
  import { getGridContext } from '$lib/context/gridContext.svelte.ts';
  import { createColumnController } from '$lib/components/grid/columns/gridColumns.svelte.ts';
  import { createRowController } from '$lib/components/grid/rows/gridRows.svelte.ts';
  import GridRow from '$lib/components/grid/GridRow.svelte';
  import GridHeader from '$lib/components/grid/GridHeader.svelte';
  import GridOverlays from '$lib/components/grid/GridOverlays.svelte';
  import HeaderMenu from '$lib/components/grid/header-menu/headerMenu.svelte';
  import { searchManager } from '$lib/data/searchManager.svelte';
  // NO import of ContextMenu, editDropdown, autocomplete, FloatingEditor

  // F2.5: 3 data props (assets, onHeaderClick, onContextMenu) + event callbacks exempt from the rule
  type Props = {
    assets: Record<string, any>[];
    onHeaderClick: (e: MouseEvent, key: string, filterItems: string[], isLast: boolean) => void;
    onContextMenu: (e: MouseEvent, visibleIndex: number, col: number) => void;
    onCloseContextMenu: () => void;
  };
  let { assets, onHeaderClick, onContextMenu, onCloseContextMenu }: Props = $props();

  const ctx = getGridContext();
  const virtualScroll = ctx.virtualScroll;  // shared instance from context
  const columns = createColumnController();
  const rows = createRowController();

  let scrollContainer: HTMLDivElement | null = $state(null);
  const visibleData = $derived(virtualScroll.getVisibleItems(assets));

  function handleScroll(e: Event) {
    virtualScroll.handleScroll(e);
    if (ctx.headerMenu?.activeKey) ctx.headerMenu.reposition();
  }

  // Observe ctx.scrollToRow — call ensureVisible then reset
  $effect(() => {
    const row = ctx.scrollToRow;
    if (row !== null && scrollContainer) {
      virtualScroll.ensureVisible(row, 0, scrollContainer, ctx.keys, columns, rows);
      ctx.scrollToRow = null;
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
    {#if ctx.headerMenu}
      <HeaderMenu
        state={ctx.headerMenu}
        sortState={{ key: ctx.sortKey ?? '', direction: ctx.sortDirection ?? 'asc' }}
        {searchManager}
        {assets}
        baseAssets={ctx.baseAssets}
        onSort={(key, dir) => ctx.applySort?.(key, dir)}
        onFilterSelect={(item, key) => ctx.handleFilterSelect?.(item, key)}
      />
    {/if}

    <div
      class="w-max min-w-full bg-white dark:bg-slate-800 text-left relative"
      style="height: {virtualScroll.getTotalHeight(assets.length, rows) + 32 + 16}px;"
      onclick={(e) => {
        const target = e.target as HTMLElement;
        const row = Number(target.dataset.row);
        const col = Number(target.dataset.col);
        if (!isNaN(row) && !isNaN(col)) {
          // selection handled by selectionController reading ctx
        }
      }}
      oncontextmenu={(e) => {
        const target = e.target as HTMLElement;
        const visibleIndex = Number(target.dataset.row);
        const col = Number(target.dataset.col);
        if (!isNaN(visibleIndex) && !isNaN(col)) {
          onContextMenu(e, visibleIndex, col);
        }
      }}
    >
      <GridHeader
        keys={ctx.keys}
        {onHeaderClick}
        {onCloseContextMenu}
      />

      <div
        class="absolute top-8 w-full"
        style="transform: translateY({virtualScroll.getOffsetY(rows)}px);"
      >
        <!-- GridOverlays is a CHILD of GridContainer, not a sibling in +page.svelte -->
        <GridOverlays />

        {#each visibleData.items as asset, i (asset.id || visibleData.startIndex + i)}
          {@const actualIndex = visibleData.startIndex + i}
          {@const rowHeight = rows.getHeight(actualIndex)}
          {@const isNewRow = actualIndex >= ctx.filteredAssetsCount}

          <div
            class="flex border-b border-neutral-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 {isNewRow ? 'bg-blue-200 dark:bg-blue-500/20' : ''}"
            style="height: {rowHeight}px;"
          >
            <GridRow
              {asset}
              keys={ctx.keys}
              {actualIndex}
              user={ctx.pageActions?.user ?? null}
              editDropdown={ctx.editDropdown!}
              autocomplete={ctx.autocomplete!}
              {assets}
              onSaveEdit={() => ctx.pageActions?.onSaveEdit('')}
              onCancelEdit={() => ctx.pageActions?.onCancelEdit()}
              onEditAction={() => ctx.pageActions?.onEditAction('', actualIndex, 0)}
              onContextMenu={(e, visibleIdx, col) => onContextMenu(e, visibleIdx, col)}
              visibleIndex={i}
            />
          </div>
        {/each}
      </div>
    </div>
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
