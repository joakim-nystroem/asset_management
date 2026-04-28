<script lang="ts">
  import { assetStore } from '$lib/data/assetStore.svelte';
  import { queryStore } from '$lib/data/queryStore.svelte';
  import { scrollStore } from '$lib/data/scrollStore.svelte';
  import { sortStore } from '$lib/data/uiStore.svelte';
  import { setOpenPanel } from '$lib/utils/gridHelpers';
  import { toggleFilter } from './headerMenu.svelte.ts';

  import type { Attachment } from 'svelte/attachments';

  const metadataOptions: Record<string, () => string[]> = {
    location: () => assetStore.locations.map((l: any) => l.location_name),
    status: () => assetStore.statuses.map((s: any) => s.status_name),
    condition: () => assetStore.conditions.map((c: any) => c.condition_name),
    department: () => assetStore.departments.map((d: any) => d.department_name),
  };

  let {
    activeKey,
    alignRight = false,
  }: {
    activeKey: string;
    alignRight?: boolean;
  } = $props();

  function handleSort(key: string, direction: 'asc' | 'desc') {
    if (sortStore.key === key && sortStore.direction === direction) {
      sortStore.key = null;
      assetStore.displayedAssets = [...assetStore.displayedAssets].sort(
        (a, b) => Number(a.id) - Number(b.id)
      );
    } else {
      sortStore.key = key;
      sortStore.direction = direction;
      const d = direction === 'asc' ? 1 : -1;
      assetStore.displayedAssets = [...assetStore.displayedAssets].sort(
        (a, b) => String(a[key]).localeCompare(String(b[key])) * d
      );
    }
    setOpenPanel();
  }

  // Local rendering state
  let filterOpen = $state(false);
  let filterSearchTerm = $state('');
  let tabAnchor = $state('');
  let tabCycling = $state(false);
  let selectedIndex = $state(-1);
  let menuElement: HTMLElement | undefined = $state(undefined);
  let submenuDirection = $state<'left' | 'right'>('right');

  // Refine submenu direction based on viewport
  $effect(() => {
    const _scrollLeft = scrollStore.scrollLeft;
    if (menuElement && !filterOpen) {
      const rect = menuElement.getBoundingClientRect();
      const SUBMENU_WIDTH = 192;
      submenuDirection = rect.right + SUBMENU_WIDTH > window.innerWidth ? 'left' : 'right';
    }
  });

  // Compute filtered items for keyboard navigation.
  // Cascading: source = baseAssets narrowed by every filter EXCEPT the active column's own.
  // (Using displayedAssets directly hides values of the active column when it is itself filtered.)
  let allItems = $derived.by<string[]>(() => {
    if (metadataOptions[activeKey]) return metadataOptions[activeKey]();

    const otherFilters = queryStore.filters.filter(f => f.key !== activeKey);
    let source: Record<string, any>[] = assetStore.baseAssets;

    if (otherFilters.length > 0) {
      const byKey = new Map<string, Set<string>>();
      for (const f of otherFilters) {
        if (!byKey.has(f.key)) byKey.set(f.key, new Set());
        byKey.get(f.key)!.add(f.value);
      }
      source = source.filter(asset =>
        [...byKey.entries()].every(([key, values]) => values.has(String(asset[key] ?? '')))
      );
    }

    const out = new Set<string>();
    for (const a of source) {
      const v = String(a[activeKey] ?? '');
      if (v) out.add(v);
    }
    return [...out];
  });

  // Filter by the anchor (what the user typed), not the displayed tab-cycled value
  let filteredItems = $derived(
    tabAnchor
      ? allItems
          .filter((i: string) => i.toLowerCase().includes(tabAnchor.toLowerCase()))
          .sort((a: string, b: string) => {
            const lower = tabAnchor.toLowerCase();
            const aStarts = a.toLowerCase().startsWith(lower);
            const bStarts = b.toLowerCase().startsWith(lower);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.localeCompare(b);
          })
      : allItems
  );

  function handleFilterKeydown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (filteredItems.length === 0) return;

      if (!tabCycling) {
        tabCycling = true;
        selectedIndex = e.shiftKey ? filteredItems.length - 1 : 0;
      } else if (e.shiftKey) {
        selectedIndex = selectedIndex <= 0 ? filteredItems.length - 1 : selectedIndex - 1;
      } else {
        selectedIndex = selectedIndex >= filteredItems.length - 1 ? 0 : selectedIndex + 1;
      }

      filterSearchTerm = filteredItems[selectedIndex];
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredItems.length === 0) return;
      selectedIndex = selectedIndex >= filteredItems.length - 1 ? 0 : selectedIndex + 1;
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredItems.length === 0) return;
      selectedIndex = selectedIndex <= 0 ? filteredItems.length - 1 : selectedIndex - 1;
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filteredItems.length) {
        toggleFilter(activeKey, filteredItems[selectedIndex]);
      }
      return;
    }

    if (e.key === 'Escape') {
      setOpenPanel();
      return;
    }
  }

  const closeOnEscape: Attachment = () => {
		onkeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenPanel();
      }
    };
	};

</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={menuElement}
    data-panel="header-menu"
    class="absolute top-full {alignRight ? 'right-0' : 'left-0'} z-50 bg-bg-header border border-border-strong rounded shadow-xl py-1 text-sm text-text-primary min-w-48 font-normal normal-case cursor-default text-left flex flex-col"
    onclick={(e) => e.stopPropagation()}
  >
    <button
      class="px-3 py-1.5 hover:bg-bg-hover-item text-left flex items-center gap-2 group"
      onclick={() => handleSort(activeKey, 'asc')}
    >
      <div class="w-4 flex justify-center text-text-muted">
        {#if sortStore.key === activeKey && sortStore.direction === 'asc'}✓{/if}
      </div>
      <span>Sort A to Z</span>
    </button>

    <button
      class="px-3 py-1.5 hover:bg-bg-hover-item text-left flex items-center gap-2 group w-full"
      onclick={() => handleSort(activeKey, 'desc')}
    >
      <div class="w-4 flex justify-center text-text-muted">
        {#if sortStore.key === activeKey && sortStore.direction === 'desc'}✓{/if}
      </div>
      <span>Sort Z to A</span>
    </button>

    <div class="border-b border-border-strong my-1"></div>

    <div class="relative w-full">
      <button
        class="px-3 py-1.5 hover:bg-bg-hover-item text-left flex items-center justify-between group w-full"
        onclick={() => { filterOpen = !filterOpen; if (filterOpen) { filterSearchTerm = ''; tabAnchor = ''; tabCycling = false; selectedIndex = -1; } }}
      >
        <div class="flex items-center gap-2">
          <div class="w-4"></div>
          <span>Filter By</span>
        </div>
        <span class="text-text-muted group-hover:text-blue-600 dark:group-hover:text-blue-400">
          {submenuDirection === 'left' ? '‹' : '›'}
        </span>
      </button>

      {#if filterOpen}
        {@const focusOnInit = (node: HTMLElement) => { node.focus(); }}
        <div
          {@attach closeOnEscape}
          class="absolute z-50 top-0 bg-bg-header border border-border-strong rounded shadow-xl py-1 text-sm w-48 {submenuDirection === 'left' ? 'right-full mr-0.5' : 'left-full ml-0.5'}"
        >
          <div class="px-2 py-1 border-b border-border-strong mb-1">
            <input
              use:focusOnInit
              bind:value={filterSearchTerm}
              oninput={() => { tabAnchor = filterSearchTerm; tabCycling = false; selectedIndex = -1; }}
              onkeydown={handleFilterKeydown}
              class="w-full pl-2 text-text-primary placeholder:text-neutral-400! dark:placeholder:text-neutral-300! focus:outline-none text-xs"
              placeholder="Search values..."
              onclick={(e) => e.stopPropagation()}
            />
          </div>

          <div class="max-h-48 overflow-y-auto no-scrollbar">
            {#each filteredItems as item, idx}
              <button
                class="px-3 py-1.5 text-left flex items-center gap-2 group w-full {idx === selectedIndex ? 'bg-blue-500 text-white' : 'hover:bg-bg-hover-item'}"
                onclick={() => toggleFilter(activeKey, item)}
                onmouseenter={() => { selectedIndex = idx; }}
              >
                <div class="w-4 flex justify-center {idx === selectedIndex ? 'text-white' : 'text-blue-600 dark:text-blue-400'} font-bold">
                  {#if queryStore.filters.some(f => f.key === activeKey && f.value === item)}✓{/if}
                </div>
                <div class="truncate">{item}</div>
              </button>
            {:else}
              <div class="px-3 py-1.5 text-text-muted">No items found.</div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
