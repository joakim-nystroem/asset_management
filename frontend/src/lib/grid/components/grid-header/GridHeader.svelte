<script lang="ts">
  import { SvelteMap } from 'svelte/reactivity';
  import { getUiContext } from '$lib/context/gridContext.svelte.ts';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import HeaderMenu from '$lib/grid/components/header-menu/headerMenu.svelte';

  const DEFAULT_WIDTH = 150;
  const MIN_WIDTH = 50;

  const uiCtx = getUiContext();

  // Sort state — owned by GridHeader
  let sortKey = $state<string | null>(null);
  let sortDirection = $state<'asc' | 'desc'>('asc');

  type Props = {
    keys: string[];
    columnWidths: SvelteMap<string, number>;
  };

  let { keys, columnWidths }: Props = $props();

  function handleSort(key: string, direction: 'asc' | 'desc') {
    sortKey = key;
    sortDirection = direction;
    assetStore.filteredAssets = [...assetStore.filteredAssets].sort((a, b) => {
      const aVal = String(a[key] ?? '');
      const bVal = String(b[key] ?? '');
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
      return direction === 'asc' ? cmp : -cmp;
    });
    uiCtx.headerMenu?.close();
  }

  function handleHeaderClick(e: MouseEvent, key: string, isLast: boolean) {
    uiCtx.contextMenu.visible = false;
    uiCtx.filterPanel?.close();
    uiCtx.headerMenu?.toggle(e, key, [], isLast);
  }

  // Resize: self-contained with temp window listeners
  function startResize(e: MouseEvent, key: string) {
    e.preventDefault();
    e.stopPropagation();
    document.body.style.cursor = 'col-resize';
    const startX = e.clientX;
    const startWidth = columnWidths.get(key) ?? DEFAULT_WIDTH;

    function onMouseMove(ev: MouseEvent) {
      ev.preventDefault();
      const delta = ev.clientX - startX;
      columnWidths.set(key, Math.max(MIN_WIDTH, startWidth + delta));
    }
    function onMouseUp() {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
</script>

<div class="sticky top-0 z-20 flex border-b border-neutral-200 dark:border-slate-600 bg-neutral-50 dark:bg-slate-700">
  {#each keys as key, i}
    <div
      data-header-col={i}
      class="header-interactive relative group border-r border-neutral-200 dark:border-slate-600 last:border-r-0"
      style="width: {columnWidths.get(key) ?? DEFAULT_WIDTH}px; min-width: {columnWidths.get(key) ?? DEFAULT_WIDTH}px;"
    >
      <button
        class="w-full h-full px-2 py-2 text-xs font-medium text-neutral-900 dark:text-neutral-100 uppercase hover:bg-neutral-100 dark:hover:bg-slate-600 text-left flex items-center justify-between focus:outline-none focus:bg-neutral-200 dark:focus:bg-slate-500 cursor-pointer"
        onclick={(e) => handleHeaderClick(e, key, i === keys.length - 1)}
      >
        <span class="truncate">{key.replaceAll("_", " ")}</span>
        <span class="ml-1">
          {#if sortKey === key}
            <span>{sortDirection === "asc" ? "▲" : "▼"}</span>
          {:else}
            <span class="invisible group-hover:visible text-neutral-400">▾</span>
          {/if}
        </span>
      </button>

      <!-- Resize handle -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 z-50"
        onmousedown={(e) => startResize(e, key)}
        onclick={(e) => e.stopPropagation()}
        ondblclick={(e) => {
          e.stopPropagation();
          columnWidths.delete(key);
        }}
      ></div>
    </div>
  {/each}
</div>

{#if uiCtx.headerMenu}
  <HeaderMenu
    state={uiCtx.headerMenu}
    sortState={{ key: sortKey ?? '', direction: sortDirection }}
    onSort={handleSort}
  />
{/if}
