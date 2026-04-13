<script lang="ts">
  import { page } from '$app/state';
  import FilterPanel from "$lib/grid/components/filter-panel/filterPanel.svelte";
  import { assetStore } from '$lib/data/assetStore.svelte';
  import { queryStore } from '$lib/data/queryStore.svelte';
  import { uiStore } from '$lib/data/uiStore.svelte';
  import { setOpenPanel } from '$lib/utils/gridHelpers';
  import { pendingStore } from '$lib/data/cellStore.svelte';
  import { newRowStore } from '$lib/data/newRowStore.svelte';
  import { scrollStore } from '$lib/data/scrollStore.svelte';

  import { enqueue } from '$lib/eventQueue/eventQueue';
  import { toastState } from '$lib/toast/toastState.svelte';
  import { validateNewRow } from '$lib/grid/validation';
  import { resetEditState, resetAfterCommit } from '$lib/utils/gridHelpers';

  // Local search input — seeded from queryStore on mount, only pushed back on explicit action
  let searchInput = $state(queryStore.q);

  const VIEW_CONFIGS = [
    { name: 'default', label: 'Default' },
    { name: 'ped', label: 'PED' },
    { name: 'galaxy', label: 'Galaxy' },
    { name: 'network', label: 'Network' },
  ];

  const currentViewLabel = $derived(
    VIEW_CONFIGS.find(v => v.name === queryStore.view)?.label ?? 'Default'
  );

  const hasInvalid = $derived(
    pendingStore.edits.some((e) => !e.isValid)
  );

  const user = $derived(page.data.user);

  let viewDropdownOpen = $state(false);

  const allStatuses = $derived(assetStore.statuses.map((s: any) => s.status_name));

  function toggleStatus(status: string) {
    const hidden = queryStore.hiddenStatuses;
    if (hidden.includes(status)) {
      queryStore.hiddenStatuses = hidden.filter(s => s !== status);
    } else {
      queryStore.hiddenStatuses = [...hidden, status];
    }
    document.cookie = `hidden_statuses=${queryStore.hiddenStatuses.join(',')};path=/;max-age=${60 * 60 * 24 * 365}`;
    searchInput = '';
    enqueue({ type: 'SETTINGS_UPDATE', payload: { view: queryStore.view, hiddenStatuses: $state.snapshot(queryStore.hiddenStatuses) } });
  }

  function handleSearch() {
    if (pendingStore.edits.length > 0 || newRowStore.newRows.length > 0) {
      enqueue(
        { type: 'DISCARD', payload: {} },
      );
      resetEditState();
    }
    queryStore.q = searchInput;
    enqueue(
      { type: 'QUERY', payload: { view: queryStore.view, q: searchInput, filters: $state.snapshot(queryStore.filters) } },
    );
  }

  function handleClearSearch() {
    if (pendingStore.edits.length > 0 || newRowStore.newRows.length > 0) {
      enqueue(
        { type: 'DISCARD', payload: {} },
      );
      resetEditState();
    }
    searchInput = '';
    queryStore.q = '';
    enqueue(
      { type: 'QUERY', payload: { view: queryStore.view, q: '', filters: $state.snapshot(queryStore.filters) } },
    );
  }

  function handleViewChange(viewName: string) {
    viewDropdownOpen = false;
    if (pendingStore.edits.length > 0 || newRowStore.newRows.length > 0) {
      enqueue(
        { type: 'DISCARD', payload: {} },
      );
      resetEditState();
    }
    searchInput = '';
    queryStore.q = '';
    queryStore.filters = [];
    queryStore.view = viewName;
    enqueue(
      { type: 'VIEW_CHANGE', payload: { view: viewName } },
    );
  }

  function addNewRow() {
    if (pendingStore.edits.length > 0) {
      toastState.addToast('Commit or discard pending changes before adding new rows.', 'warning');
      return;
    }
    const keys = Object.keys(assetStore.displayedAssets[0] ?? {});
    const newRow: Record<string, any> = { id: -(1001 + newRowStore.newRows.length) };
    for (const key of keys) {
      if (key !== 'id') newRow[key] = '';
    }
    newRowStore.newRows = [...newRowStore.newRows, newRow];
    assetStore.displayedAssets = [...assetStore.displayedAssets, newRow];
    scrollStore.scrollToRow = assetStore.displayedAssets.length - 1;
  }

  function handleDiscard() {
    enqueue(
      { type: 'DISCARD', payload: {} },
    );
    resetEditState();
  }

</script>

<div class="flex flex-col">
  <div class="flex flex-row gap-4 items-center pt-3 pb-1">

    <div class="flex gap-4 items-center">
        <div class="relative">
          <input
            bind:value={searchInput}
            class="rounded-sm bg-white dark:bg-neutral-100 dark:text-neutral-700 placeholder-neutral-500! p-1 pl-2 pr-6 border border-border-strong dark:border-none focus:outline-none"
            placeholder="Search..."
            onkeydown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
          />
          {#if searchInput}
            <button
              onclick={handleClearSearch}
              class="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary cursor-pointer font-bold text-xs"
              title="Clear search"
            >
              ✕
            </button>
          {/if}
        </div>
      <button
        onclick={handleSearch}
        class="cursor-pointer bg-btn-primary hover:bg-btn-primary-hover px-2 py-1 rounded text-white text-shadow-warm"
        >Search</button
      >
    </div>

    <div class="flex flex-row w-full justify-between items-center">
      <div class="flex flex-row gap-2">
        <div class="relative" data-panel="filter-panel">
          <button
            onclick={(e) => {
              e.stopPropagation();
              if (uiStore.filterPanel.visible) {
                setOpenPanel();
              } else {
                setOpenPanel('filterPanel');
                uiStore.filterPanel.visible = true;
              }
            }}
            class="flex items-center gap-2 px-3 py-1.5 rounded bg-bg-card border border-border-strong hover:bg-bg-hover-button text-sm cursor-pointer"
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
          {#if uiStore.filterPanel.visible}
            <FilterPanel />
          {/if}
        </div>
        {#if user}
          <button
            onclick={addNewRow}
            class="flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-bg-card border border-border-strong hover:bg-bg-hover-button text-sm cursor-pointer"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6"></path></svg>
            <span>New Row</span>
          </button>
        {/if}
        {#if newRowStore.newRows.length > 0 && user}
          <div class="flex gap-2 items-center">
            <button
              onclick={() => {
                // Merge pending edits into new row objects before sending
                const newRows = newRowStore.newRows.map((row: any) => {
                  const merged = { ...row };
                  for (const edit of pendingStore.edits) {
                    if (edit.row === row.id) merged[edit.col] = edit.value;
                  }
                  return merged;
                });
                // Validate each merged row before committing
                for (const row of newRows) {
                  const result = validateNewRow(row, pendingStore.edits);
                  if (!result.isValid) {
                    toastState.addToast(`Fix invalid cells before committing: ${result.errors[0]}`, 'warning');
                    return;
                  }
                }
                enqueue(
                  {
                    type: 'COMMIT_CREATE',
                    payload: {
                      rows: $state.snapshot(newRows),
                    },
                  },
                );
                resetAfterCommit();
              }}
              class="cursor-pointer bg-btn-success hover:bg-btn-success-hover px-2 py-1 rounded text-white text-shadow-warm whitespace-nowrap"
            >
              Commit
            </button>
            <button
              onclick={handleDiscard}
              class="cursor-pointer bg-btn-danger hover:bg-btn-danger-hover px-2 py-1 rounded text-white text-shadow-warm"
            >
              Discard
            </button>
            {#if hasInvalid}
              <span class="text-yellow-600 dark:text-yellow-400 font-medium text-xs">
                Invalid cells found
              </span>
            {/if}
          </div>
        {:else if pendingStore.edits.length > 0 && user}
          <div class="flex gap-2 items-center">
            <button
              onclick={() => {
                if (pendingStore.edits.some((e) => !e.isValid)) {
                  toastState.addToast('Fix invalid cells before committing', 'warning');
                  return;
                }
                enqueue(
                  {
                    type: 'COMMIT_UPDATE',
                    payload: {
                      changes: $state.snapshot(pendingStore.edits),
                    },
                  },
                );
                resetAfterCommit();
              }}
              class="cursor-pointer bg-btn-success hover:bg-btn-success-hover px-2 py-1 rounded text-white text-shadow-warm whitespace-nowrap"
            >
              Commit
            </button>
            <button
              onclick={handleDiscard}
              class="cursor-pointer bg-btn-danger hover:bg-btn-danger-hover px-2 py-1 rounded text-white text-shadow-warm"
            >
              Discard
            </button>
            {#if hasInvalid}
              <span class="text-yellow-600 dark:text-yellow-400 font-medium text-xs">
                Invalid cells found
              </span>
            {/if}
          </div>
        {/if}
      </div>

      <div class="flex gap-2">
      <!-- View Selector Dropdown -->
      <div class="relative">
        <button
          onclick={() => { viewDropdownOpen = !viewDropdownOpen; uiStore.settingsMenu.visible = false; }}
          class="flex items-center gap-1 px-3 py-1.5 rounded bg-bg-card border border-border-strong hover:bg-bg-hover-button text-sm cursor-pointer"
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
          <div class="absolute right-1 mt-1 w-40 bg-bg-header border border-border-strong rounded shadow-lg z-50">
            {#each VIEW_CONFIGS as view}
              <button
                onclick={() => handleViewChange(view.name)}
                class="px-3 py-1.5 text-left flex items-center gap-2 group w-full hover:bg-bg-hover-item cursor-pointer" 
              > 
                <div class="w-4 flex text-text-muted justify-center">
                  {#if queryStore.view === view.name}✓{/if}
                </div>
                <span>{view.label}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Settings Dropdown -->
      <div class="relative">
        <button
          onclick={(e) => {
              e.stopPropagation();
              if (uiStore.settingsMenu.visible) {
                setOpenPanel();
              } else {
                setOpenPanel('settingsMenu');
                uiStore.settingsMenu.visible = true;
              }
            }}
          class="flex items-center px-2 py-1.5 rounded bg-bg-card border border-border-strong hover:bg-bg-hover-button text-sm cursor-pointer h-full"
          title="Grid Settings"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
        </button>
        {#if uiStore.settingsMenu.visible}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div class="absolute right-1 mt-1 w-48 bg-bg-header border border-border-strong rounded shadow-lg z-900" onclick={(e) => e.stopPropagation()}>
            <div class="px-3 py-2 border-b border-border">
              <span class="text-xs font-semibold text-text-muted uppercase tracking-wider">Visible Statuses</span>
            </div>
            {#each allStatuses as status}
              <button
                onclick={() => toggleStatus(status)}
                class="px-3 py-1.5 text-left flex items-center gap-2 w-full hover:bg-bg-hover-item cursor-pointer"
              >
                <div class="w-4 h-4 rounded border flex items-center justify-center text-xs
                  {queryStore.hiddenStatuses.includes(status)
                    ? 'border-border-strong text-transparent'
                    : 'border-blue-500 bg-blue-500 text-white'}">
                  {#if !queryStore.hiddenStatuses.includes(status)}✓{/if}
                </div>
                <span class="text-sm text-text-primary">{status}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
      </div>
    </div>
  </div>
</div>

<!--
<button
      class="px-3 py-1.5 hover:bg-bg-hover-item text-left flex items-center gap-2 group w-full"
      onclick={() => handleSort(activeKey, 'desc')}
    >
      <div class="w-4 flex justify-center text-blue-600 dark:text-blue-400 font-bold">
        {#if sortStore.key === activeKey && sortStore.direction === 'desc'}✓{/if}
      </div>
      <span>Sort Z to A</span>
    </button> -->