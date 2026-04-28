<script lang="ts">
  import type { Attachment } from 'svelte/attachments';
  import DatePicker from '$lib/utils/date-picker/DatePicker.svelte';

  type Props = {
    column: string;
    label: string;
    align: 'left' | 'right';
    sortKey: string;
    sortDir: 'asc' | 'desc';
    activeFilter: string | undefined;
    dateFrom: string;
    dateTo: string;
    onSort: (col: string, dir: 'asc' | 'desc') => void;
    onSetFilter: (col: string, value: string | undefined) => void;
    onSetDateRange: (from: string, to: string) => void;
    onClose: () => void;
  };

  let {
    column, label, align,
    sortKey, sortDir,
    activeFilter,
    dateFrom, dateTo,
    onSort, onSetFilter, onSetDateRange, onClose,
  }: Props = $props();

  const isDateColumn = $derived(column === 'modified_at');
  const isFilterableValueColumn = $derived(!isDateColumn);

  let filterOpen = $state(false);
  let menuElement: HTMLElement | undefined = $state(undefined);
  let submenuDirection = $state<'left' | 'right'>('right');

  let allValues = $state<string[]>([]);
  let valuesLoaded = $state(false);
  let loadingValues = $state(false);
  let loadError = $state<string | null>(null);

  let searchTerm = $state('');
  let tabAnchor = $state('');
  let tabCycling = $state(false);
  let selectedIndex = $state(-1);

  // Direction of submenu — keep on right unless near viewport edge
  $effect(() => {
    if (menuElement && !filterOpen) {
      const rect = menuElement.getBoundingClientRect();
      const SUBMENU_WIDTH = 240;
      submenuDirection = rect.right + SUBMENU_WIDTH > window.innerWidth ? 'left' : 'right';
    }
  });

  async function loadValues() {
    if (valuesLoaded || loadingValues || !isFilterableValueColumn) return;
    loadingValues = true;
    loadError = null;
    try {
      const res = await fetch(`/api/admin/history/distinct?column=${encodeURIComponent(column)}`);
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const data = await res.json();
      allValues = data.values ?? [];
      valuesLoaded = true;
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'Failed to load values';
    } finally {
      loadingValues = false;
    }
  }

  function openFilterSubmenu() {
    filterOpen = !filterOpen;
    if (filterOpen) {
      searchTerm = '';
      tabAnchor = '';
      tabCycling = false;
      selectedIndex = -1;
      loadValues();
    }
  }

  let filteredValues = $derived(
    tabAnchor
      ? allValues
          .filter(v => v.toLowerCase().includes(tabAnchor.toLowerCase()))
          .sort((a, b) => {
            const lower = tabAnchor.toLowerCase();
            const aStarts = a.toLowerCase().startsWith(lower);
            const bStarts = b.toLowerCase().startsWith(lower);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.localeCompare(b);
          })
      : allValues
  );

  function handleSortClick(dir: 'asc' | 'desc') {
    onSort(column, dir);
    onClose();
  }

  function handleFilterValueClick(value: string) {
    if (activeFilter === value) {
      onSetFilter(column, undefined);
    } else {
      onSetFilter(column, value);
    }
    onClose();
  }

  function handleFilterKeydown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (filteredValues.length === 0) return;
      if (!tabCycling) {
        tabCycling = true;
        selectedIndex = e.shiftKey ? filteredValues.length - 1 : 0;
      } else if (e.shiftKey) {
        selectedIndex = selectedIndex <= 0 ? filteredValues.length - 1 : selectedIndex - 1;
      } else {
        selectedIndex = selectedIndex >= filteredValues.length - 1 ? 0 : selectedIndex + 1;
      }
      searchTerm = filteredValues[selectedIndex];
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredValues.length === 0) return;
      selectedIndex = selectedIndex >= filteredValues.length - 1 ? 0 : selectedIndex + 1;
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredValues.length === 0) return;
      selectedIndex = selectedIndex <= 0 ? filteredValues.length - 1 : selectedIndex - 1;
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filteredValues.length) {
        handleFilterValueClick(filteredValues[selectedIndex]);
      }
      return;
    }
    if (e.key === 'Escape') {
      onClose();
    }
  }


  const closeOnEscape: Attachment = () => {
    onkeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
  };

  const focusOnInit = (node: HTMLElement) => { node.focus(); };
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={menuElement}
  data-panel="history-header-menu"
  class="absolute top-full {align === 'right' ? 'right-0' : 'left-0'} z-50 bg-bg-header border border-border-strong rounded shadow-xl py-1 text-sm text-text-primary min-w-48 font-normal normal-case cursor-default text-left flex flex-col"
  onclick={(e) => e.stopPropagation()}
>
  <button
    class="px-3 py-1.5 hover:bg-bg-hover-item text-left flex items-center gap-2 group w-full"
    onclick={() => handleSortClick('asc')}
  >
    <div class="w-4 flex justify-center text-text-muted">
      {#if sortKey === column && sortDir === 'asc'}✓{/if}
    </div>
    <span>Sort A to Z</span>
  </button>

  <button
    class="px-3 py-1.5 hover:bg-bg-hover-item text-left flex items-center gap-2 group w-full"
    onclick={() => handleSortClick('desc')}
  >
    <div class="w-4 flex justify-center text-text-muted">
      {#if sortKey === column && sortDir === 'desc'}✓{/if}
    </div>
    <span>Sort Z to A</span>
  </button>

  <div class="border-b border-border-strong my-1"></div>

  <div class="relative w-full">
    <button
      class="px-3 py-1.5 hover:bg-bg-hover-item text-left flex items-center justify-between group w-full"
      onclick={openFilterSubmenu}
    >
      <div class="flex items-center gap-2">
        <div class="w-4"></div>
        <span>{isDateColumn ? 'Filter date' : 'Filter By'}</span>
      </div>
      <span class="text-text-muted group-hover:text-blue-600 dark:group-hover:text-blue-400">
        {submenuDirection === 'left' ? '‹' : '›'}
      </span>
    </button>

    {#if filterOpen && isDateColumn}
      <div class="absolute z-50 top-0 {submenuDirection === 'left' ? 'right-full mr-0.5' : 'left-full ml-0.5'}">
        <DatePicker
          from={dateFrom}
          to={dateTo}
          onApply={(f, t) => onSetDateRange(f, t)}
          onClose={onClose}
        />
      </div>
    {:else if filterOpen}
      <div
        {@attach closeOnEscape}
        class="absolute z-50 top-0 bg-bg-header border border-border-strong rounded shadow-xl py-1 text-sm w-48 {submenuDirection === 'left' ? 'right-full mr-0.5' : 'left-full ml-0.5'}"
      >
        <div class="px-2 py-1 border-b border-border-strong mb-1">
          <input
            use:focusOnInit
            bind:value={searchTerm}
            oninput={() => { tabAnchor = searchTerm; tabCycling = false; selectedIndex = -1; }}
            onkeydown={handleFilterKeydown}
            class="w-full pl-2 text-text-primary placeholder:text-neutral-400! dark:placeholder:text-neutral-300! focus:outline-none text-xs"
            placeholder="Search values..."
            onclick={(e) => e.stopPropagation()}
          />
        </div>

        <div class="max-h-64 overflow-y-auto no-scrollbar">
          {#if loadError}
            <div class="px-3 py-1.5 text-text-danger">{loadError}</div>
          {:else if valuesLoaded && filteredValues.length === 0}
            <div class="px-3 py-1.5 text-text-muted">No items found.</div>
          {:else if valuesLoaded}
            {#each filteredValues as item, idx}
              <button
                class="px-3 py-1.5 text-left flex items-center gap-2 group w-full {idx === selectedIndex ? 'bg-blue-500 text-white' : 'hover:bg-bg-hover-item'}"
                onclick={() => handleFilterValueClick(item)}
                onmouseenter={() => { selectedIndex = idx; }}
              >
                <div class="w-4 flex justify-center {idx === selectedIndex ? 'text-white' : 'text-blue-600 dark:text-blue-400'} font-bold">
                  {#if activeFilter === item}✓{/if}
                </div>
                <div class="truncate">{item}</div>
              </button>
            {/each}
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
