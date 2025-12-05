<script lang="ts">
  // --- COMPONENTS ---
  import ContextMenu from '$lib/utils/ui/contextMenu/contextMenu.svelte';
  import HeaderMenu from '$lib/utils/ui/headerMenu/headerMenu.svelte';
  // --- UTILS IMPORTS ---
  import { createInteractionHandler } from '$lib/utils/interaction/interactionHandler';
  // --- STATE CLASSES ---
  import { ContextMenuState } from '$lib/utils/ui/contextMenu/contextMenu.svelte.js';
  import { HistoryManager } from '$lib/utils/interaction/historyManager.svelte';
  import { HeaderMenuState } from '$lib/utils/ui/headerMenu/headerMenu.svelte.js';
  import { SelectionManager } from '$lib/utils/interaction/selectionManager.svelte';
  import { ClipboardManager } from '$lib/utils/interaction/clipboardManager.svelte';
  import { SearchManager } from '$lib/utils/data/searchManager.svelte';
  import { SortManager } from '$lib/utils/data/sortManager.svelte';
  import { VirtualScrollManager } from '$lib/utils/core/virtualScrollManager.svelte';
  import { ColumnWidthManager } from '$lib/utils/core/columnManager.svelte';
  import { RowHeightManager } from '$lib/utils/core/rowManager.svelte';
  import { EditManager } from '$lib/utils/interaction/editManager.svelte';
  import FilterPanel from '$lib/utils/ui/filterPanel/filterPanel.svelte';
  import { FilterPanelState } from '$lib/utils/ui/filterPanel/filterPanel.svelte.js';
  import { RealtimeManager } from '$lib/utils/interaction/realtimeManager.svelte';
  // Initialize State Classes
  const contextMenu = new ContextMenuState();
  const history = new HistoryManager();
  const headerMenu = new HeaderMenuState();
  const selection = new SelectionManager();
  const clipboard = new ClipboardManager();
  const search = new SearchManager();
  const sort = new SortManager();
  const virtualScroll = new VirtualScrollManager();
  const columnManager = new ColumnWidthManager();
  const rowManager = new RowHeightManager();
  const editManager = new EditManager();
  const filterPanel = new FilterPanelState();
  
  let { data } = $props();

  // --- Data State ---
  let baseAssets: Record<string, any>[] = $state(data.assets);
  let assets: Record<string, any>[] = $state(data.assets);
  let locations: Record<string, any>[] = $state(data.locations || []);

  let keys = $derived(assets.length > 0 ? Object.keys(assets[0]) : []);
  const updateAssetInList = (list: Record<string, any>[], payload: { id: number; key: string; value: any }) => {
    const index = list.findIndex(a => a.id === payload.id);
    if (index !== -1) {
      list[index][payload.key] = payload.value;
    }
  };
  const handleRealtimeUpdate = (payload: { id: number; key: string; value: any }) => {
    updateAssetInList(assets, payload);
    updateAssetInList(baseAssets, payload);
  };
  const realtime = new RealtimeManager(handleRealtimeUpdate);

  let scrollContainer: HTMLDivElement | null = $state(null);
  let textareaRef: HTMLTextAreaElement | null = $state(null);
  const visibleData = $derived(virtualScroll.getVisibleItems(assets));
  
  const selectionOverlay = $derived(
    selection.computeVisualOverlay(
      selection.start, selection.end, virtualScroll.visibleRange, keys, columnManager, virtualScroll.rowHeight
    )
  );
  const copyOverlay = $derived(
    selection.isCopyVisible ? selection.computeVisualOverlay(
      selection.copyStart, selection.copyEnd, virtualScroll.visibleRange, keys, columnManager, virtualScroll.rowHeight
    ) : null
  );
  const mountInteraction = createInteractionHandler(
    { selection, columnManager, contextMenu, headerMenu },
    {
      onCopy: async () => { await handleCopy(); },
      onPaste: handlePaste,
      onUndo: () => history.undo(assets),
      onRedo: () => history.redo(assets),
      onEscape: () => {
        if (editManager.isEditing) {
          editManager.cancel(columnManager, rowManager);
          return;
      
        }
        selection.resetAll();
        clipboard.clear();
        if (contextMenu.visible) contextMenu.close();
        headerMenu.close();
      },
      onEdit: handleEditAction,
      onScrollIntoView: (row, col) => {
        virtualScroll.ensureVisible(row, col, scrollContainer, keys, columnManager, rowManager);
      },
      getGridSize: () => ({ rows: assets.length, cols: keys.length })
    }
  );
  async function handleSearch() {
    const result = await search.search(baseAssets);
    assets = result;
    selection.reset();
    sort.invalidateCache();
    sort.reset();
  }

  async function applySort(key: string, dir: 'asc' | 'desc') {
    selection.reset();
    sort.update(key, dir);
    assets = await sort.applyAsync(assets);
    headerMenu.close();
  }

  async function handleCopy() {
    await clipboard.copy(selection, assets, keys);
    if (contextMenu.visible) contextMenu.close();
    selection.reset();
  }

  function handleContextMenu(e: MouseEvent, visibleIndex: number, col: number) {
    const actualRow = virtualScroll.getActualIndex(visibleIndex);
    const key = keys[col];
    const value = String(assets[actualRow][key] ?? '');
    selection.selectCell(actualRow, col);
    contextMenu.open(e, actualRow, col, value, key);
  }

  function getActionTarget() {
    if (contextMenu.visible) {
      return { row: contextMenu.row, col: contextMenu.col };
    }
    return selection.getAnchor();
  }

  async function handlePaste() {
    const target = getActionTarget();
    if (!target) return;
    const pasteSize = await clipboard.paste(target, assets, keys, history);
    if (contextMenu.visible) contextMenu.close();
    if (pasteSize) {
      const startRow = target.row;
      const startCol = target.col;
      const endRow = Math.min(startRow + pasteSize.rows - 1, assets.length - 1);
      const endCol = Math.min(startCol + pasteSize.cols - 1, keys.length - 1);
      selection.reset();
      selection.start = { row: startRow, col: startCol };
      selection.end = { row: endRow, col: endCol };
    }
  }

  function handleFilterByValue() {
    if (!contextMenu.visible) return;
    const { key, value } = contextMenu;
    search.selectFilterItem(value, key, assets);
    contextMenu.close();
  }

  function handleEditAction() {
    const target = getActionTarget();
    if (!target) return;
    const { row, col } = target;
    const key = keys[col];
    const asset = assets[row];
    if (!asset || !key) return;
    const currentValue = String(asset[key] ?? '');
    editManager.startEdit(row, col, key, currentValue, columnManager, rowManager);
    contextMenu.close();
    selection.reset();
  }

  async function saveEdit() {
    const pos = editManager.getEditPosition();
    const saved = await editManager.save(
      assets,
      (id, key, oldValue, newValue) => history.record(id, key, oldValue, newValue),
      columnManager,
      rowManager
    );
    if (pos) selection.selectCell(pos.row, pos.col);
  }

  function cancelEdit() {
    const pos = editManager.getEditPosition();
    editManager.cancel(columnManager, rowManager);
    if (pos) selection.selectCell(pos.row, pos.col);
  }

  $effect(() => {
    if (editManager.isEditing && textareaRef) {
      editManager.updateRowHeight(textareaRef, rowManager, columnManager);
      textareaRef.focus();
      textareaRef.select();
    }
  });
  // --- Lifecycle ---
  $effect(() => {
    const cleanupInteraction = mountInteraction(window);
    
    // [NEW] Connect Realtime
    realtime.connect();

    let resizeObserver: ResizeObserver | null = null;
    if (scrollContainer) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          virtualScroll.updateContainerHeight(entry.contentRect.height);
        }
      });
      resizeObserver.observe(scrollContainer);
 
    }
    
    return () => {
        cleanupInteraction();
        // [NEW] Disconnect Realtime
        realtime.disconnect();
        if (resizeObserver) resizeObserver.disconnect();
    };
  });
  $effect(() => { 
    search.term;
    search.selectedFilters;
    handleSearch(); 
  });
  $effect(() => {
    if (filterPanel.isOpen) headerMenu.close();
  });
  $effect(() => {
    if (headerMenu.activeKey) filterPanel.close();
  });
  $effect(() => {
    assets;
    search.cleanupFilterCache();
    sort.invalidateCache();
  });
</script>

<div class="flex flex-col gap-2 mb-3">
  <div class="flex flex-row gap-4 items-center">
    <h2 class="text-lg font-bold whitespace-nowrap">
      Asset Master
      {#if realtime.isConnected}
        <span class="inline-block w-2 h-2 rounded-full bg-green-500 ml-2" title="Live"></span>
      {:else}
        <span class="inline-block w-2 h-2 rounded-full bg-red-500 ml-2" title="Disconnected"></span>
      {/if}
    </h2>
    <div class="flex gap-4 items-center">
      <input
        bind:value={search.inputValue}
  
        class="bg-white dark:bg-neutral-100 dark:text-neutral-700 placeholder-neutral-500! p-1 border border-neutral-300 dark:border-none focus:outline-none"
        placeholder="Search..."
        onkeydown={(e) => { if (e.key === 'Enter') search.executeSearch() }}
      />
      <button
        onclick={() => search.executeSearch()}
        class="cursor-pointer bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded text-neutral-100">Search</button
      >
    </div>
    
    <div class="flex flex-row w-full justify-between items-center">
   
      <div class="flex flex-row text-xs gap-2">
        <FilterPanel state={filterPanel} searchManager={search} />
      </div>
    </div>
  </div>
</div>

{#if assets.length > 0}
  <div 
    bind:this={scrollContainer}
    onscroll={(e) => virtualScroll.handleScroll(e)}
    class="rounded-lg border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-auto h-[calc(100dvh-8.9rem)] shadow-md relative select-none focus:outline-none"
    tabindex="-1"
  >
    <div class="w-max min-w-full bg-white dark:bg-slate-800 text-left relative" style="height: {virtualScroll.getTotalHeight(assets.length, rowManager) + 32}px;">
      
      <div class="sticky top-0 z-20 flex border-b 
border-neutral-200 dark:border-slate-600 bg-neutral-50 dark:bg-slate-700">
        {#each keys as key, i}
          <div 
            data-header-col={i}
            class="header-interactive relative group border-r border-neutral-200 dark:border-slate-600 last:border-r-0"
            style="width: {columnManager.getWidth(key)}px;
min-width: {columnManager.getWidth(key)}px;"
          >
            <button
              class="w-full h-full px-2 py-2 text-xs font-medium text-neutral-900 dark:text-neutral-100 uppercase hover:bg-neutral-100 dark:hover:bg-slate-600 text-left flex items-center justify-between focus:outline-none focus:bg-neutral-200 dark:focus:bg-slate-500 cursor-pointer"
              onclick={(e) => headerMenu.toggle(e, key)}
            >
              <span class="truncate">{key.replaceAll("_", 
" ")}</span>
              <span class="ml-1">
                {#if sort.key === key}
                  <span>{sort.direction === 'asc' ? '▲' : '▼'}</span>
                {:else}
                  <span class="invisible group-hover:visible text-neutral-400">▾</span>
    
                {/if}
              </span>
            </button>

            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div 
                class="absolute right-0 top-0 
bottom-0 w-1 cursor-col-resize hover:bg-blue-400 z-50"
                onmousedown={(e) => {
                    e.preventDefault();
e.stopPropagation();
                    document.body.style.cursor = 'col-resize';
                    columnManager.startResize(key, e.clientX);
                }}
                onclick={(e) => e.stopPropagation()} 
                ondblclick={(e) => {
                    e.stopPropagation();
columnManager.resetWidth(key);
                }}
            ></div>
          </div>
        {/each}
      </div>

      <div class="absolute top-8 w-full" style="transform: translateY({virtualScroll.getOffsetY(rowManager)}px);">
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

        {#if selectionOverlay}
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

        {#each visibleData.items as asset, i (asset.id || (visibleData.startIndex + i))}
          {@const actualIndex = visibleData.startIndex + i}
          {@const rowHeight = rowManager.getHeight(actualIndex)}
          
          <div class="flex border-b border-neutral-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700" style="height: {rowHeight}px;">
             {#each keys as key, j} 
 
              {@const isEditingThisCell = editManager.isEditingCell(actualIndex, j)}
              
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                data-row={actualIndex}
                data-col={j} 
     
                onmousedown={(e) => {
                  if (isEditingThisCell) return;
if (editManager.isEditing) {
                    editManager.cancel(columnManager, rowManager);
setTimeout(() => { selection.handleMouseDown(actualIndex, j, e); }, 0);
                  } else {
                    selection.handleMouseDown(actualIndex, j, e);
}
                }}
                onmouseenter={() => !isEditingThisCell && selection.extendSelection(actualIndex, j)}
                oncontextmenu={(e) => !isEditingThisCell && handleContextMenu(e, i, j)}
                class="
                  h-full flex items-center text-xs
    
               text-neutral-700 dark:text-neutral-200 
                  border-r border-neutral-200 dark:border-slate-700 last:border-r-0
                  {isEditingThisCell ? '' : 'px-2 cursor-cell hover:bg-blue-100 dark:hover:bg-slate-600'}
                "
                style="width: {columnManager.getWidth(key)}px; min-width: {columnManager.getWidth(key)}px;"
>
                {#if isEditingThisCell}
                  <textarea
                    bind:this={textareaRef}
                    bind:value={editManager.inputValue}
                    oninput={() => editManager.updateRowHeight(textareaRef, rowManager, columnManager)}
 
                    onkeydown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
saveEdit();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
cancelEdit();
                      }
                    }}
                    onmousedown={(e) => { e.stopPropagation();
}}
                    onblur={(e) => {
                      const relatedTarget = e.relatedTarget as HTMLElement;
if (!relatedTarget || relatedTarget.closest('[data-row]')) {
                        setTimeout(() => { cancelEdit(); }, 0);
} else {
                        saveEdit();
}
                    }}
                    class="w-full h-full resize-none bg-white dark:bg-slate-700 text-neutral-900 dark:text-neutral-100 border-2 border-blue-500 rounded px-1.5 py-1.5 focus:outline-none"
                    style="overflow: hidden;"
></textarea>
                {:else}
                  <span class="truncate w-full">{asset[key]}</span>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
    
  </div>
    </div>
  </div>
  <p class="mt-2 ml-1 text-sm text-neutral-600 dark:text-neutral-300">Showing {assets.length} items.</p>
{:else if search.error}
  <p class="text-red-500">Error: {search.error}</p>
{:else}
  <p>Query successful, but no data was returned.</p>
{/if}

<HeaderMenu 
  state={headerMenu}
  sortManager={sort}
  searchManager={search}
  {assets}
  onSort={applySort}
/>

<ContextMenu 
  state={contextMenu}
  onEdit={handleEditAction}
  onCopy={handleCopy}
  onPaste={handlePaste}
  onFilterByValue={handleFilterByValue}
/>