<script lang="ts">
  import type { FilterPanelState } from './filterPanel.svelte.ts';
  import type { SearchManager } from '$lib/utils/data/searchManager.svelte';
  
  type Props = {
    state: FilterPanelState;
    searchManager: SearchManager;
    onRemoveFilter?: (filter: { key: string; value: string }) => void;
    onClearAllFilters?: () => void;
  };

  let { state, searchManager, onRemoveFilter, onClearAllFilters }: Props = $props();
  let panelRef: HTMLDivElement | null = null;
  
  // Handle outside clicks
  function handleClick(e: MouseEvent) {
    state.handleOutsideClick(e, panelRef);
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      state.close();
    }
  }

  $effect(() => {
    if (state.isOpen) {
      // Delay to avoid immediate close from the same click that opened it
      setTimeout(() => {
        window.addEventListener('click', handleClick);
      }, 0);
      window.addEventListener('keydown', handleKeydown);

      return () => {
        window.removeEventListener('click', handleClick);
        window.removeEventListener('keydown', handleKeydown);
      };
    }
  });
</script>

<div class="relative" bind:this={panelRef}>
  <!-- Trigger Button -->
  <button
    onclick={(e) => { e.stopPropagation(); state.toggle(); }}
    class="flex items-center gap-2 px-3 py-1.5 rounded bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-600 hover:bg-neutral-50 dark:hover:bg-slate-700 text-sm cursor-pointer"
  >
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path>
    </svg>
    <span>Filters</span>
    {#if searchManager.getFilterCount() > 0}
      <span class="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-xs font-medium">
        {searchManager.getFilterCount()}
      </span>
    {/if}
  </button>

  <!-- Popover Panel -->
  {#if state.isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
      class="absolute top-full left-0 mt-1 w-80 bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 rounded-lg shadow-xl z-50"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-slate-700">
        <h3 class="font-semibold text-sm text-neutral-900 dark:text-neutral-100">Active Filters</h3>
        {#if searchManager.getFilterCount() > 0}
          <button
            onclick={() => {
              if (onClearAllFilters) {
                onClearAllFilters();
              } else {
                searchManager.clearAllFilters();
              }
              state.close();
            }}
            class="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium cursor-pointer"
          >
            Clear All
          </button>
        {/if}
      </div>

      <!-- Filter List -->
      <div class="max-h-96 overflow-y-auto">
        {#if searchManager.getFilterCount() === 0}
          <div class="px-4 py-8 text-center text-neutral-500 dark:text-neutral-400 text-sm">
            No active filters
          </div>
        {:else}
          <div class="p-2 space-y-1">
            {#each searchManager.selectedFilters as filter}
              <div class="flex items-center justify-between px-3 py-2 rounded hover:bg-neutral-50 dark:hover:bg-slate-700 group">
                <div class="flex-1 min-w-0">
                  <div class="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
                    {filter.key.replaceAll('_', ' ')}
                  </div>
                  <div class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                    {filter.value}
                  </div>
                </div>
                <button
                  onclick={() => {
                    if (onRemoveFilter) {
                      onRemoveFilter(filter);
                    } else {
                      searchManager.removeFilter(filter);
                    }
                  }}
                  class="ml-2 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 cursor-pointer"
                  aria-label="Remove filter"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>