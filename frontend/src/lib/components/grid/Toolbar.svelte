<script lang="ts">
  import FilterPanel from "$lib/grid/components/filter-panel/filterPanel.svelte";
  import { searchManager } from "$lib/data/searchManager.svelte";
  import { getDataContext, getViewContext, getUiContext, getChangeContext, getRowGenControllerContext } from '$lib/context/gridContext.svelte.ts';

  const rowGen = getRowGenControllerContext();
  const dataCtx = getDataContext();
  const viewCtx = getViewContext();
  const uiCtx = getUiContext();
  const changeCtx = getChangeContext();

  // Static view config (was in viewManager.VIEW_CONFIGS)
  const VIEW_CONFIGS = [
    { name: 'default', label: 'Default' },
    { name: 'audit', label: 'Audit' },
    { name: 'ped', label: 'PED' },
    { name: 'galaxy', label: 'Galaxy' },
    { name: 'network', label: 'Network' },
  ];

  const currentViewLabel = $derived(
    VIEW_CONFIGS.find(v => v.name === viewCtx.activeView)?.label ?? 'Default'
  );

  const hasInvalid = $derived(
    changeCtx.hasInvalidChanges || (rowGen.hasNewRows && rowGen.invalidNewRowCount > 0)
  );

  let viewDropdownOpen = $state(false);

  function handleViewChange(viewName: string) {
    viewDropdownOpen = false;
    dataCtx.viewChange?.(viewName);
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
              const state = uiCtx.getCurrentUrlState?.();
              if (state) {
                uiCtx.updateSearchUrl?.({ q: searchManager.inputValue, filters: state.filters, view: state.view });
              }
            }
          }}
        />
        {#if searchManager.inputValue}
          <button
            onclick={() => {
              searchManager.inputValue = '';
              const state = uiCtx.getCurrentUrlState?.();
              if (state) {
                uiCtx.updateSearchUrl?.({ q: '', filters: state.filters, view: state.view });
              }
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
          const state = uiCtx.getCurrentUrlState?.();
          if (state) {
            uiCtx.updateSearchUrl?.({ q: searchManager.inputValue, filters: state.filters, view: state.view });
          }
        }}
        class="cursor-pointer bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded text-neutral-100"
        >Search</button
      >
    </div>

    <div class="flex flex-row w-full justify-between items-center">
      <div class="flex flex-row gap-2">
        <FilterPanel
          state={uiCtx.filterPanel!}
          {searchManager}
          onRemoveFilter={(filter) => {
            const state = uiCtx.getCurrentUrlState?.();
            if (state) {
              const newFilters = state.filters.filter(f => !(f.key === filter.key && f.value === filter.value));
              uiCtx.updateSearchUrl?.({ q: state.q, filters: newFilters, view: state.view });
            }
          }}
          onClearAllFilters={() => {
            const state = uiCtx.getCurrentUrlState?.();
            if (state) {
              uiCtx.updateSearchUrl?.({ q: state.q, filters: [], view: state.view });
            }
          }}
        />
        {#if dataCtx.user}
          <button
            onclick={() => dataCtx.addNewRow?.()}
            class="flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-600 hover:bg-neutral-50 dark:hover:bg-slate-700 text-sm cursor-pointer"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6"></path></svg>
            <span>New Row</span>
          </button>
        {/if}
        {#if changeCtx.hasUnsavedChanges && dataCtx.user}
          <div class="flex gap-2 items-center">
            <button
              onclick={() => dataCtx.commit?.()}
              class="cursor-pointer bg-green-600 hover:bg-green-500 px-2 py-1 rounded text-neutral-100 whitespace-nowrap"
            >
              Commit
            </button>
            <button
              onclick={() => dataCtx.discard?.()}
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
                  onclick={() => dataCtx.navigateError?.('next')}
                  class="cursor-pointer bg-yellow-600 hover:bg-yellow-500 px-2 py-1 rounded text-neutral-100"
                  title="Next error"
                >
                Go To
                </button>
              </div>
            {/if}
          </div>
        {:else if rowGen.hasNewRows && dataCtx.user}
          <div class="flex gap-2 items-center">
            <button
              onclick={() => dataCtx.addRows?.()}
              class="cursor-pointer bg-green-600 hover:bg-green-500 px-2 py-1 rounded text-neutral-100 whitespace-nowrap"
            >
              Commit
            </button>
            <button
              onclick={() => dataCtx.discard?.()}
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
                  onclick={() => dataCtx.navigateError?.('next')}
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
                class="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-slate-700 cursor-pointer {viewCtx.activeView === view.name ? 'bg-blue-50 dark:bg-blue-900/30 font-medium' : ''}"
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
