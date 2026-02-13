<script lang="ts">
  import type { SafeUser } from '$lib/types';
  import type { FilterPanelState } from "$lib/utils/ui/filterPanel/filterPanel.svelte.ts";
  import type { Filter } from '$lib/utils/data/searchManager.svelte';
  import FilterPanel from "$lib/utils/ui/filterPanel/filterPanel.svelte";
  import { searchManager } from "$lib/utils/data/searchManager.svelte";
  import { changeManager } from "$lib/utils/interaction/changeManager.svelte";
  import { rowGenerationManager } from "$lib/utils/interaction/rowGenerationManager.svelte";
  import { viewManager } from "$lib/utils/core/viewManager.svelte";

  type Props = {
    user: SafeUser | null;
    filterPanel: FilterPanelState;
    getCurrentUrlState: () => { q: string; filters: Filter[]; view: string };
    updateSearchUrl: (params: { q?: string; filters?: Filter[]; view?: string }) => void;
    onAddNewRow: () => void;
    onCommit: () => void;
    onDiscard: () => void;
    onViewChange: (view: string) => void;
  };

  let {
    user,
    filterPanel,
    getCurrentUrlState,
    updateSearchUrl,
    onAddNewRow,
    onCommit,
    onDiscard,
    onViewChange,
  }: Props = $props();

  let viewDropdownOpen = $state(false);

  function handleViewChange(viewName: string) {
    viewDropdownOpen = false;
    onViewChange(viewName);
  }
</script>

<div class="flex flex-col gap-2 mb-3">
  <div class="flex flex-row gap-4 items-center">

    <div class="flex gap-4 items-center">
      <div class="relative">
        <input
          bind:value={searchManager.inputValue}
          class="bg-white dark:bg-neutral-100 dark:text-neutral-700 placeholder-neutral-500! p-1 pr-7 border border-neutral-300 dark:border-none focus:outline-none"
          placeholder="Search..."
          onkeydown={(e) => {
            if (e.key === "Enter") {
              const { filters, view } = getCurrentUrlState();
              updateSearchUrl({ q: searchManager.inputValue, filters, view });
            }
          }}
        />
        {#if searchManager.inputValue}
          <button
            onclick={() => {
              searchManager.inputValue = '';
              const { filters, view } = getCurrentUrlState();
              updateSearchUrl({ q: '', filters, view });
            }}
            class="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-700 cursor-pointer font-bold text-xs"
            title="Clear search"
          >
            ✕
          </button>
        {/if}
      </div>
      <button
        onclick={() => {
          const { filters, view } = getCurrentUrlState();
          updateSearchUrl({ q: searchManager.inputValue, filters, view });
        }}
        class="cursor-pointer bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded text-neutral-100"
        >Search</button
      >
    </div>

    <div class="flex flex-row w-full justify-between items-center">
      <div class="flex flex-row gap-2">
        <FilterPanel
          state={filterPanel}
          {searchManager}
          onRemoveFilter={(filter) => {
            const { q, filters, view } = getCurrentUrlState();
            const newFilters = filters.filter(f => !(f.key === filter.key && f.value === filter.value));
            updateSearchUrl({ q, filters: newFilters, view });
          }}
          onClearAllFilters={() => {
            const { q, view } = getCurrentUrlState();
            updateSearchUrl({ q, filters: [], view });
          }}
        />
        {#if user}
          <button
            onclick={onAddNewRow}
            class="flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-600 hover:bg-neutral-50 dark:hover:bg-slate-700 text-sm cursor-pointer"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6"></path></svg>
            <span>New Row</span>
          </button>
        {/if}
        {#if (changeManager.hasChanges || rowGenerationManager.hasNewRows) && user}
          <div class="flex gap-2 items-center">
            <button
              onclick={onCommit}
              class="cursor-pointer bg-green-500 hover:bg-green-600 px-2 py-1 rounded text-neutral-100 whitespace-nowrap"
            >
              Commit Changes
              {#if changeManager.hasInvalidChanges}
                <span class="ml-1 text-xs"
                  >({changeManager.validChangeCount} valid)</span
                >
              {/if}
              {#if rowGenerationManager.hasNewRows}
                <span class="ml-1 text-xs"
                  >({rowGenerationManager.newRowCount} new {rowGenerationManager.newRowCount === 1 ? 'row' : 'rows'})</span
                >
              {/if}
            </button>
            <button
              onclick={onDiscard}
              class="cursor-pointer bg-red-500 hover:bg-red-600 px-2 py-1 rounded text-neutral-100"
            >
              Discard
            </button>
            {#if changeManager.hasInvalidChanges}
              <span class="text-yellow-600 dark:text-yellow-400 text-xs">
                ⚠️ Some changes have invalid values
              </span>
            {/if}
          </div>
        {/if}
        {#if rowGenerationManager.hasNewRows && user}
          <div class="flex gap-2 items-center">
            <span class="text-blue-600 dark:text-blue-400 text-xs">
              {rowGenerationManager.newRowCount} new {rowGenerationManager.newRowCount === 1 ? 'row' : 'rows'}
              {#if rowGenerationManager.hasInvalidNewRows}
                <span class="text-yellow-600 dark:text-yellow-400">
                  ({rowGenerationManager.invalidNewRowCount} invalid)
                </span>
              {/if}
            </span>
          </div>
        {/if}
      </div>

      <!-- View Selector Dropdown -->
      <div class="relative">
        <button
          onclick={() => viewDropdownOpen = !viewDropdownOpen}
          class="flex items-center gap-1 px-3 py-1.5 rounded bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-600 hover:bg-neutral-50 dark:hover:bg-slate-700 text-sm cursor-pointer"
        >
          <span>{viewManager.currentLabel}</span>
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
            {#each viewManager.views as view}
              <button
                onclick={() => handleViewChange(view.name)}
                class="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-slate-700 cursor-pointer {viewManager.currentView === view.name ? 'bg-blue-50 dark:bg-blue-900/30 font-medium' : ''}"
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
