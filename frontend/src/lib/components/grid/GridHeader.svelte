<script lang="ts">
  import { columnManager } from "$lib/utils/core/columnManager.svelte";
  import { sortManager } from "$lib/utils/data/sortManager.svelte";

  type Props = {
    keys: string[];
    onHeaderClick: (e: MouseEvent, key: string, filterItems: string[], isLast: boolean) => void;
    onCloseContextMenu: () => void;
  };

  let { keys, onHeaderClick, onCloseContextMenu }: Props = $props();
</script>

<div class="sticky top-0 z-20 flex border-b border-neutral-200 dark:border-slate-600 bg-neutral-50 dark:bg-slate-700">
  {#each keys as key, i}
    <div
      data-header-col={i}
      class="header-interactive relative group border-r border-neutral-200 dark:border-slate-600 last:border-r-0"
      style="width: {columnManager.getWidth(key)}px; min-width: {columnManager.getWidth(key)}px;"
    >
      <button
        class="w-full h-full px-2 py-2 text-xs font-medium text-neutral-900 dark:text-neutral-100 uppercase hover:bg-neutral-100 dark:hover:bg-slate-600 text-left flex items-center justify-between focus:outline-none focus:bg-neutral-200 dark:focus:bg-slate-500 cursor-pointer"
        onclick={(e) => {
          onCloseContextMenu();
          onHeaderClick(
            e,
            key,
            [],
            i === keys.length - 1
          );
        }}
      >
        <span class="truncate">{key.replaceAll("_", " ")}</span>
        <span class="ml-1">
          {#if sortManager.key === key}
            <span>{sortManager.direction === "asc" ? "▲" : "▼"}</span>
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
        onmousedown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          document.body.style.cursor = "col-resize";
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
