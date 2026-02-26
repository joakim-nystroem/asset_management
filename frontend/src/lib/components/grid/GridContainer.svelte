<script lang="ts">
  import {
    getColumnContext,
    getDataContext,
    getEditingContext,
    getViewContext,
    getUiContext,
    getSortContext,
  } from '$lib/context/gridContext.svelte.ts';
  import { createColumnController } from '$lib/grid/utils/gridColumns.svelte.ts';
  import { createRowController } from '$lib/grid/utils/gridRows.svelte.ts';
  import { createSelectionController } from '$lib/grid/utils/gridSelection.svelte.ts';
  import { createEditController } from '$lib/grid/utils/gridEdit.svelte.ts';
  import GridRow from '$lib/components/grid/GridRow.svelte';
  import GridHeader from '$lib/components/grid/GridHeader.svelte';
  import GridOverlays from '$lib/components/grid/GridOverlays.svelte';
  import HeaderMenu from '$lib/grid/components/header-menu/headerMenu.svelte';
  import { searchManager } from '$lib/data/searchManager.svelte';
  import { toastState } from '$lib/components/toast/toastState.svelte';
  // NO import of ContextMenu, editDropdown, autocomplete, FloatingEditor

  // F2.5: assets only — callback props eliminated (use domain contexts directly)
  type Props = {
    assets: Record<string, any>[];
  };
  let { assets }: Props = $props();

  const colCtx = getColumnContext();
  const dataCtx = getDataContext();
  const editCtx = getEditingContext();
  const viewCtx = getViewContext();
  const uiCtx = getUiContext();
  const sortCtx = getSortContext();

  const selection = createSelectionController();
  const virtualScroll = viewCtx.virtualScroll;  // shared instance from context
  const columns = createColumnController();
  const rows = createRowController();
  const edit = createEditController();

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

  function handleContextMenu(e: MouseEvent, visibleIndex: number, col: number) {
    e.preventDefault();
    const actualRow = virtualScroll.getActualIndex(visibleIndex);
    const key = colCtx.keys[col];
    const value = String(dataCtx.assets[actualRow]?.[key] ?? '');
    selection.selectCell(actualRow, col);
    uiCtx.contextMenu?.open(e, actualRow, col, value, key);
    uiCtx.headerMenu?.close();
  }

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

    <div
      class="w-max min-w-full bg-white dark:bg-slate-800 text-left relative"
      style="height: {virtualScroll.getTotalHeight(assets.length, rows) + 32 + 16}px;"
      onmousedown={(e) => {
        const target = e.target as HTMLElement;
        const cell = target.closest('[data-row][data-col]') as HTMLElement | null;
        if (!cell) return;
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        if (isNaN(row) || isNaN(col)) return;
        if (editCtx.isEditing) {
          edit.save(dataCtx.assets);
          selection.selectCell(row, col);
          return;
        }
        selection.handleMouseDown(row, col, e);
      }}
      onmouseover={(e) => {
        const target = e.target as HTMLElement;
        const cell = target.closest('[data-row][data-col]') as HTMLElement | null;
        if (!cell) return;
        const row = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        if (isNaN(row) || isNaN(col)) return;
        if (!editCtx.isEditing) {
          selection.extendSelection(row, col);
        }
      }}
      ondblclick={(e) => {
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
      }}
      oncontextmenu={(e) => {
        const target = e.target as HTMLElement;
        const cell = target.closest('[data-row][data-col]') as HTMLElement | null;
        if (!cell) return;
        const visibleIndex = Number(cell.dataset.row);
        const col = Number(cell.dataset.col);
        if (!isNaN(visibleIndex) && !isNaN(col)) {
          handleContextMenu(e, visibleIndex, col);
        }
      }}
    >
      <GridHeader
        keys={colCtx.keys}
        onHeaderClick={handleHeaderClick}
        onCloseContextMenu={() => uiCtx.contextMenu?.close()}
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
