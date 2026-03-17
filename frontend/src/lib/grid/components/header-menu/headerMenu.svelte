<script lang="ts">
  import { assetStore } from '$lib/data/assetStore.svelte';
  import { queryStore } from '$lib/data/queryStore.svelte';
  import { getUiContext, getSortContext, setOpenPanel } from '$lib/context/gridContext.svelte.ts';

  let {
    activeKey,
    alignRight = false,
  }: {
    activeKey: string;
    alignRight?: boolean;
  } = $props();

  const uiCtx = getUiContext();
  const sortCtx = getSortContext();

  function handleSort(key: string, direction: 'asc' | 'desc') {
    if (sortCtx.key === key && sortCtx.direction === direction) {
      sortCtx.key = null;
      assetStore.displayedAssets = [...assetStore.displayedAssets].sort(
        (a, b) => Number(a.id) - Number(b.id)
      );
    } else {
      sortCtx.key = key;
      sortCtx.direction = direction;
      const d = direction === 'asc' ? 1 : -1;
      assetStore.displayedAssets = [...assetStore.displayedAssets].sort(
        (a, b) => String(a[key]).localeCompare(String(b[key])) * d
      );
    }
    setOpenPanel(uiCtx);
  }

  // Local rendering state
  let filterOpen = $state(false);
  let filterSearchTerm = $state('');
  let menuElement: HTMLElement | undefined = $state(undefined);
  let submenuDirection = $state<'left' | 'right'>('right');

  // Refine submenu direction based on viewport
  $effect(() => {
    if (menuElement) {
      const rect = menuElement.getBoundingClientRect();
      const SUBMENU_WIDTH = 192;
      if (rect.right + SUBMENU_WIDTH > window.innerWidth) {
        submenuDirection = 'left';
      }
    }
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={menuElement}
    data-panel="header-menu"
    class="absolute top-full {alignRight ? 'right-0' : 'left-0'} z-50 bg-neutral-50 dark:bg-slate-900 border border-neutral-300 dark:border-slate-700 rounded shadow-xl py-1 text-sm text-neutral-900 dark:text-neutral-100 min-w-48 font-normal normal-case cursor-default text-left flex flex-col"
    onclick={(e) => e.stopPropagation()}
  >
    <button
      class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group w-full"
      onclick={() => handleSort(activeKey, 'asc')}
    >
      <div class="w-4 flex justify-center text-blue-600 dark:text-blue-400 font-bold">
        {#if sortCtx.key === activeKey && sortCtx.direction === 'asc'}✓{/if}
      </div>
      <span>Sort A to Z</span>
    </button>

    <button
      class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group w-full"
      onclick={() => handleSort(activeKey, 'desc')}
    >
      <div class="w-4 flex justify-center text-blue-600 dark:text-blue-400 font-bold">
        {#if sortCtx.key === activeKey && sortCtx.direction === 'desc'}✓{/if}
      </div>
      <span>Sort Z to A</span>
    </button>

    <div class="border-b border-neutral-200 dark:border-slate-700 my-1"></div>

    <div class="relative w-full">
      <button
        class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center justify-between group w-full"
        onclick={() => { filterOpen = !filterOpen; if (filterOpen) filterSearchTerm = ''; }}
      >
        <div class="flex items-center gap-2">
          <div class="w-4"></div>
          <span>Filter By</span>
        </div>
        <span class="text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">
          {submenuDirection === 'left' ? '‹' : '›'}
        </span>
      </button>

      {#if filterOpen}
        {@const focusOnInit = (node: HTMLElement) => { node.focus(); }}
        <div
          class="absolute z-50 top-0 bg-neutral-50 dark:bg-slate-900 border border-neutral-300 dark:border-slate-700 rounded shadow-xl py-1 text-sm min-w-48 {submenuDirection === 'left' ? 'right-full mr-0.5' : 'left-full ml-0.5'}"
        >
          <div class="px-2 py-1 border-b border-neutral-200 dark:border-slate-700 mb-1">
            <input
              use:focusOnInit
              bind:value={filterSearchTerm}
              class="w-full pl-2 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400! dark:placeholder:text-neutral-300! focus:outline-none text-xs"
              placeholder="Search values..."
              onclick={(e) => e.stopPropagation()}
            />
          </div>

          <div class="max-h-48 overflow-y-auto no-scrollbar">
            {#each [...new Set(
                (queryStore.filters.some(f => f.key !== activeKey)
                  ? assetStore.displayedAssets
                  : assetStore.baseAssets
                ).map((a: Record<string, any>) => String(a[activeKey] ?? '')).filter(Boolean)
              )]
              .filter((i: string) => i.toLowerCase().includes(filterSearchTerm.toLowerCase()))
              as item
            }
              <button
                class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group w-full"
                onclick={() => {
                  const idx = queryStore.filters.findIndex(f => f.key === activeKey && f.value === item);
                  if (idx >= 0) {
                    queryStore.filters.splice(idx, 1);
                  } else {
                    queryStore.filters.push({ key: activeKey, value: item });
                  }
                }}
              >
                <div class="w-4 flex justify-center text-blue-600 dark:text-blue-400 font-bold">
                  {#if queryStore.filters.some(f => f.key === activeKey && f.value === item)}✓{/if}
                </div>
                <div class="truncate">{item}</div>
              </button>
            {:else}
              <div class="px-3 py-1.5 text-neutral-500">No items found.</div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
