<script lang="ts">
  import { uiStore, sortStore, columnWidthStore } from '$lib/data/uiStore.svelte';
  import { setOpenPanel } from '$lib/utils/gridHelpers';
  import { scrollStore } from '$lib/data/scrollStore.svelte';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import HeaderMenu from '$lib/grid/components/header-menu/headerMenu.svelte';

  import { DEFAULT_WIDTH, MIN_COLUMN_WIDTH } from '$lib/grid/gridConfig';

  // Offscreen canvas for auto-fit column width measurement.
  // Font must match grid cell style: text-xs (12px) in GridRow.svelte
  let measureCtx: CanvasRenderingContext2D | null = null;

  function getMeasureCtx(): CanvasRenderingContext2D {
    if (!measureCtx) {
      measureCtx = document.createElement('canvas').getContext('2d')!;
      measureCtx.font = '12px system-ui, -apple-system, sans-serif';
    }
    return measureCtx;
  }

  function autoFitWidth(key: string): number {
    const ctx = getMeasureCtx();
    let maxWidth = 0;
    for (const asset of assetStore.displayedAssets) {
      const w = ctx.measureText(String(asset[key] ?? '')).width;
      if (w > maxWidth) maxWidth = w;
    }
    // px-2 padding (16px) + buffer for borders/sort icon
    return Math.max(DEFAULT_WIDTH, Math.ceil(maxWidth + 36));
  }

  type Props = {
    keys: string[];
  };

  let { keys }: Props = $props();

  // --- Menu alignment (computed from DOM when menu opens) ---
  let menuAlignRight = $state(false);

  $effect(() => {
    // Re-evaluate on horizontal scroll (scrollLeft changes the header's visual position)
    const _scrollLeft = scrollStore.scrollLeft;
    if (uiStore.headerMenu.visible) {
      const idx = keys.indexOf(uiStore.headerMenu.activeKey);
      const el = document.querySelector(`[data-header-col="${idx}"]`);
      if (el) menuAlignRight = el.getBoundingClientRect().right + 192 > window.innerWidth;
    }
  });

  // --- Header click: toggle menu for this column ---
  function handleHeaderClick(key: string) {
    if (uiStore.headerMenu.visible && uiStore.headerMenu.activeKey === key) {
      setOpenPanel(); // Toggle off
    } else {
      setOpenPanel('headerMenu');
      uiStore.headerMenu.activeKey = key;
      uiStore.headerMenu.visible = true;
    }
  }

  // --- Resize drag state ---
  let resizeDrag = $state<{ key: string; startX: number; startWidth: number } | null>(null);

  function startResize(key: string, e: MouseEvent) {
    setOpenPanel();

    const startWidth = columnWidthStore.widths.get(key) ?? DEFAULT_WIDTH;
    resizeDrag = { key, startX: e.clientX, startWidth };
    document.body.style.cursor = 'col-resize';
    e.preventDefault();
    e.stopPropagation();
  }

  $effect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizeDrag) return;
      const delta = e.clientX - resizeDrag.startX;
      const newWidth = Math.max(MIN_COLUMN_WIDTH, resizeDrag.startWidth + delta);
      columnWidthStore.widths.set(resizeDrag.key, newWidth);
    }

    function onMouseUp() {
      if (resizeDrag) {
        document.body.style.cursor = '';
        resizeDrag = null;
      }
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  });
</script>

<div class="sticky top-0 z-20 flex border-b border-border">
  {#each keys as key, i}
    <div
      data-header-col={i}
      data-panel="header-menu"
      class="header-interactive relative group border-r border-border last:border-r-0 bg-bg-header"
      style="width: {columnWidthStore.widths.get(key) ?? DEFAULT_WIDTH}px; min-width: {columnWidthStore.widths.get(key) ?? DEFAULT_WIDTH}px;"
    >
      <button
        class="w-full h-full px-2 py-2 text-xs font-medium text-text-primary uppercase hover:bg-bg-hover-item text-left flex items-center justify-between focus:outline-none focus:bg-neutral-200 dark:focus:bg-slate-500 cursor-pointer"
        onclick={(e) => { e.stopPropagation(); handleHeaderClick(key); }}
      >
        <span class="truncate">{key.replaceAll("_", " ")}</span>
        <span class="ml-1">
          {#if sortStore.key === key}
            <span>{sortStore.direction === "asc" ? "▲" : "▼"}</span>
          {:else}
            <span class="invisible group-hover:visible text-text-muted">▾</span>
          {/if}
        </span>
      </button>

      <!-- Resize handle -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 z-50"
        onmousedown={(e) => startResize(key, e)}
        ondblclick={(e) => {
          e.stopPropagation();
          if (columnWidthStore.widths.has(key)) {
            columnWidthStore.widths.delete(key);
          } else {
            columnWidthStore.widths.set(key, autoFitWidth(key));
          }
        }}
      ></div>

      {#if uiStore.headerMenu.visible && uiStore.headerMenu.activeKey === key}
        <HeaderMenu activeKey={key} alignRight={menuAlignRight} />
      {/if}
    </div>
  {/each}
</div>
