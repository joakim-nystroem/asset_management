<script lang="ts">
  import { getUiContext, getSortContext, getColumnWidthContext } from '$lib/context/gridContext.svelte.ts';
  import HeaderMenu from '$lib/grid/components/header-menu/headerMenu.svelte';

  import { DEFAULT_WIDTH } from '$lib/grid/gridConfig';

  const uiCtx = getUiContext();
  const sortCtx = getSortContext();
  const colWidthCtx = getColumnWidthContext();

  type Props = {
    keys: string[];
  };

  let { keys }: Props = $props();

  // --- Menu alignment (computed from DOM when menu opens) ---
  let headerMenuEl = $state<HTMLElement | null>(null);
  let menuAlignRight = $state(false);

  $effect(() => {
    if (uiCtx.headerMenu.visible) {
      const idx = keys.indexOf(uiCtx.headerMenu.activeKey);
      headerMenuEl = document.querySelector(`[data-header-col="${idx}"]`);
      
      
    function recalc() {
      if (headerMenuEl) menuAlignRight = headerMenuEl?.getBoundingClientRect().right + 192 > window.innerWidth; 
    }

    recalc();
    document.addEventListener('scroll', recalc, true);
    return () => document.removeEventListener('scroll', recalc, true);
    }
  });

</script>

<div class="sticky top-0 z-20 flex border-b border-neutral-200 dark:border-slate-600 bg-neutral-50 dark:bg-slate-700">
  {#each keys as key, i}
    <div
      data-header-col={i}
      class="header-interactive relative group border-r border-neutral-200 dark:border-slate-600 last:border-r-0"
      style="width: {colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH}px; min-width: {colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH}px;"
    >
      <button
        class="w-full h-full px-2 py-2 text-xs font-medium text-neutral-900 dark:text-neutral-100 uppercase hover:bg-neutral-100 dark:hover:bg-slate-600 text-left flex items-center justify-between focus:outline-none focus:bg-neutral-200 dark:focus:bg-slate-500 cursor-pointer"
      >
        <span class="truncate">{key.replaceAll("_", " ")}</span>
        <span class="ml-1">
          {#if sortCtx.key === key}
            <span>{sortCtx.direction === "asc" ? "▲" : "▼"}</span>
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
        onclick={(e) => e.stopPropagation()}
        ondblclick={(e) => {
          e.stopPropagation();
          colWidthCtx.widths.delete(key);
        }}
      ></div>

      {#if uiCtx.headerMenu.visible && uiCtx.headerMenu.activeKey === key}
        <HeaderMenu activeKey={key} alignRight={menuAlignRight}/>
      {/if}
    </div>
  {/each}
</div>
