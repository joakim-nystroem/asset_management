<script lang="ts">
  import { page } from '$app/state';
  import FilterPanel from "$lib/grid/components/filter-panel/filterPanel.svelte";
  import { assetStore } from '$lib/data/assetStore.svelte';
  import { queryStore } from '$lib/data/queryStore.svelte';
  import {
    getPendingContext,
    getNewRowContext,
    getUiContext,
    getSelectionContext,
    getClipboardContext,
    getHistoryContext,
    getColumnWidthContext,
    getScrollSignalContext,
    setOpenPanel,
  } from '$lib/context/gridContext.svelte.ts';
  import { DEFAULT_WIDTH } from '$lib/grid/gridConfig';
  import { enqueue } from '$lib/grid/eventQueue/eventQueue';
  import { toastState } from '$lib/toast/toastState.svelte';

  const pendingCtx = getPendingContext();
  const historyCtx = getHistoryContext();
  const newRowCtx = getNewRowContext();
  const uiCtx = getUiContext();
  const selCtx = getSelectionContext();
  const clipCtx = getClipboardContext();
  const colWidthCtx = getColumnWidthContext();
  const scrollSignalCtx = getScrollSignalContext();

  // Local search input — only pushed to queryStore on explicit action
  let searchInput = $state('');

  // Sync from queryStore on page load (URL → store → input)
  $effect(() => {
    searchInput = queryStore.q;
  });

  const VIEW_CONFIGS = [
    { name: 'default', label: 'Default' },
    { name: 'audit', label: 'Audit' },
    { name: 'ped', label: 'PED' },
    { name: 'galaxy', label: 'Galaxy' },
    { name: 'network', label: 'Network' },
  ];

  const currentViewLabel = $derived(
    VIEW_CONFIGS.find(v => v.name === queryStore.view)?.label ?? 'Default'
  );

  const hasInvalid = $derived(
    pendingCtx.edits.some((e) => !e.isValid) || (newRowCtx.hasNewRows && !newRowCtx.isValid)
  );

  const user = $derived(page.data.user);

  let viewDropdownOpen = $state(false);

  function handleSearch() {
    queryStore.q = searchInput;
  }

  function handleClearSearch() {
    searchInput = '';
    queryStore.q = '';
  }

  function handleViewChange(viewName: string) {
    viewDropdownOpen = false;
    // View change resets search and filters
    searchInput = '';
    queryStore.q = '';
    queryStore.filters = [];
    queryStore.view = viewName;
  }

  function addNewRow() {
    if (pendingCtx.edits.length > 0) {
      toastState.addToast('Commit or discard pending changes before adding new rows.', 'warning');
      return;
    }
    const keys = Object.keys(assetStore.filteredAssets[0] ?? {});
    const newRow: Record<string, any> = { id: `NEW-${newRowCtx.newRows.length + 1}` };
    for (const key of keys) {
      if (key !== 'id') newRow[key] = '';
    }
    newRowCtx.newRows = [...newRowCtx.newRows, newRow];
    newRowCtx.hasNewRows = true;
    scrollSignalCtx.scrollToRow = assetStore.filteredAssets.length + newRowCtx.newRows.length - 1;
  }

  function handleDiscard() {
    if (newRowCtx.hasNewRows) {
      scrollSignalCtx.scrollToRow = Math.max(0, assetStore.filteredAssets.length - 1);
    }
    enqueue(
      {
        type: 'DISCARD',
        payload: { user },
      },
      { pendingCtx, newRowCtx },
    );
    historyCtx.undoStack = [];
    historyCtx.redoStack = [];
    selCtx.pasteRange = null;
    selCtx.selectionStart = { row: -1, col: '' };
    selCtx.selectionEnd = { row: -1, col: '' };
    selCtx.hideSelection = false;
    clipCtx.copyStart = { row: -1, col: '' };
    clipCtx.copyEnd = { row: -1, col: '' };
  }

  function navigateToError() {
    const invalidEdit = pendingCtx.edits.find((e) => !e.isValid);
    if (!invalidEdit) return;

    const assets = assetStore.filteredAssets;
    const rowIndex = assets.findIndex((a: any) => a.id === invalidEdit.row);
    if (rowIndex < 0) return;

    scrollSignalCtx.scrollToRow = rowIndex;

    // Compute column bounds for horizontal scroll
    const keys = Object.keys(assets[0] ?? {});
    const colIdx = keys.indexOf(invalidEdit.col);
    if (colIdx >= 0) {
      let left = 0;
      for (let c = 0; c < colIdx; c++) left += colWidthCtx.widths.get(keys[c]) ?? DEFAULT_WIDTH + 5;
      scrollSignalCtx.scrollToCol = { left, right: left + (colWidthCtx.widths.get(invalidEdit.col) ?? DEFAULT_WIDTH + 5) };
    }
  }
</script>

<div class="flex flex-col gap-2 mb-3">
  <div class="flex flex-row gap-4 items-center">

    <div class="flex gap-4 items-center">
      <div class="relative">
        <input
          bind:value={searchInput}
          class="bg-white dark:bg-neutral-100 dark:text-neutral-700 placeholder-neutral-500! p-1 pr-7 border border-neutral-300 dark:border-none focus:outline-none"
          placeholder="Search..."
          onkeydown={(e) => {
            if (e.key === "Enter") handleSearch();
          }}
        />
        {#if searchInput}
          <button
            onclick={handleClearSearch}
            class="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-700 cursor-pointer font-bold text-xs"
            title="Clear search"
          >
            ✕
          </button>
        {/if}
      </div>
      <button
        onclick={handleSearch}
        class="cursor-pointer bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded text-neutral-100"
        >Search</button
      >
    </div>

    <div class="flex flex-row w-full justify-between items-center">
      <div class="flex flex-row gap-2">
        <div class="relative" data-panel="filter-panel">
          <button
            onclick={(e) => {
              e.stopPropagation();
              if (uiCtx.filterPanel.visible) {
                setOpenPanel(uiCtx);
              } else {
                setOpenPanel(uiCtx, 'filterPanel');
                uiCtx.filterPanel.visible = true;
              }
            }}
            class="flex items-center gap-2 px-3 py-1.5 rounded bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-600 hover:bg-neutral-50 dark:hover:bg-slate-700 text-sm cursor-pointer"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
            </svg>
            <span>Filters</span>
            {#if queryStore.filters.length > 0}
              <span class="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-xs font-medium">
                {queryStore.filters.length}
              </span>
            {/if}
          </button>
          {#if uiCtx.filterPanel.visible}
            <FilterPanel />
          {/if}
        </div>
        {#if user}
          <button
            onclick={addNewRow}
            class="flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-600 hover:bg-neutral-50 dark:hover:bg-slate-700 text-sm cursor-pointer"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6"></path></svg>
            <span>New Row</span>
          </button>
        {/if}
        {#if pendingCtx.edits.length > 0 && user}
          <div class="flex gap-2 items-center">
            <button
              onclick={() => {
                if (pendingCtx.edits.some((e) => !e.isValid)) {
                  toastState.addToast('Fix invalid cells before committing', 'warning');
                  return;
                }
                enqueue(
                  {
                    type: 'COMMIT_UPDATE',
                    payload: {
                      changes: $state.snapshot(pendingCtx.edits),
                      user,
                    },
                  },
                  { pendingCtx },
                );
              }}
              class="cursor-pointer bg-green-600 hover:bg-green-500 px-2 py-1 rounded text-neutral-100 whitespace-nowrap"
            >
              Commit
            </button>
            <button
              onclick={handleDiscard}
              class="cursor-pointer bg-red-700 hover:bg-red-600 px-2 py-1 rounded text-neutral-100"
            >
              Discard
            </button>
            {#if hasInvalid}
              <div class="flex items-center gap-2 text-xs">
                <span class="text-yellow-600 dark:text-yellow-400 font-medium">
                  Invalid cells found
                </span>
                <button
                  onclick={navigateToError}
                  class="cursor-pointer bg-yellow-600 hover:bg-yellow-500 px-2 py-1 rounded text-neutral-100"
                  title="Next error"
                >
                Go To
                </button>
              </div>
            {/if}
          </div>
        {:else if newRowCtx.hasNewRows && user}
          <div class="flex gap-2 items-center">
            <button
              onclick={() => enqueue(
                {
                  type: 'COMMIT_CREATE',
                  payload: {
                    rows: $state.snapshot(newRowCtx.newRows),
                    user,
                  },
                },
                { newRowCtx },
              )}
              class="cursor-pointer bg-green-600 hover:bg-green-500 px-2 py-1 rounded text-neutral-100 whitespace-nowrap"
            >
              Commit
            </button>
            <button
              onclick={handleDiscard}
              class="cursor-pointer bg-red-700 hover:bg-red-600 px-2 py-1 rounded text-neutral-100"
            >
              Discard
            </button>
            {#if hasInvalid}
              <div class="flex items-center gap-2 text-xs">
                <span class="text-yellow-600 dark:text-yellow-400 font-medium">
                  Invalid cells found
                </span>
                <button
                  onclick={navigateToError}
                  class="cursor-pointer bg-yellow-600 hover:bg-yellow-500 px-2 py-1 rounded text-neutral-100"
                  title="Next error"
                >
                Go To
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- View Selector Dropdown -->
      <div class="relative">
        <button
          onclick={() => viewDropdownOpen = !viewDropdownOpen}
          class="flex items-center gap-1 px-3 py-1.5 rounded bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-600 hover:bg-neutral-50 dark:hover:bg-slate-700 text-sm cursor-pointer"
        >
          <span>{currentViewLabel}</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        {#if viewDropdownOpen}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="fixed inset-0 z-40"
            onclick={() => viewDropdownOpen = false}
          ></div>
          <div class="absolute right-0 mt-1 w-40 bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-600 rounded shadow-lg z-50">
            {#each VIEW_CONFIGS as view}
              <button
                onclick={() => handleViewChange(view.name)}
                class="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-slate-700 cursor-pointer {queryStore.view === view.name ? 'bg-blue-50 dark:bg-blue-900/30 font-medium' : ''}"
              >
                {view.label}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
