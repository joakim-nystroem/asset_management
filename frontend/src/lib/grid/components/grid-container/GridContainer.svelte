<script lang="ts">
  import { assetStore } from '$lib/data/assetStore.svelte';
  import { scrollStore } from '$lib/data/scrollStore.svelte';
  import { uiStore, columnWidthStore } from '$lib/data/uiStore.svelte';
  import { DEFAULT_WIDTH, DEFAULT_ROW_HEIGHT } from '$lib/grid/gridConfig';
  import GridRow from '$lib/grid/components/grid-row/GridRow.svelte';
  import GridHeader from '$lib/grid/components/grid-header/GridHeader.svelte';
  import GridOverlays from '$lib/grid/components/grid-overlays/GridOverlays.svelte';
  import EditHandler from '$lib/grid/components/edit-handler/EditHandler.svelte';
  import ContextMenu from '$lib/grid/components/context-menu/contextMenu.svelte';
  import CustomScrollbar from '$lib/grid/components/virtual-scroll/CustomScrollbar.svelte';
  import { setContext } from 'svelte';
  import { createVirtualGridContainer } from './virtualGridContainer.svelte.ts';

  const TRACK_SIZE = 6;

  // Viewport dimensions — owned by GridContainer, measured via ResizeObserver
  let viewport = $state({ width: 0, height: 0 });
  setContext('viewport', viewport);

  const virtualGrid = createVirtualGridContainer();

  let keys = $derived(Object.keys(assetStore.displayedAssets[0] ?? {}));

  // Close menus on scroll
  let prevScrollTop = 0;
  let prevScrollLeft = 0;
  $effect(() => {
    const top = scrollStore.scrollTop;
    const left = scrollStore.scrollLeft;
    if (top === prevScrollTop && left === prevScrollLeft) return;
    prevScrollTop = top;
    prevScrollLeft = left;
    if (uiStore.contextMenu.visible) uiStore.contextMenu.visible = false;
  });

  let visibleItems = $derived(
    assetStore.displayedAssets.slice(scrollStore.visibleRange.startIndex, scrollStore.visibleRange.endIndex)
  );

  // Content dimensions (derived, not stored)
  let contentHeight = $derived(assetStore.displayedAssets.length * DEFAULT_ROW_HEIGHT);
  let contentWidth = $derived(
    keys.reduce((sum, key) => sum + (columnWidthStore.widths.get(key) ?? DEFAULT_WIDTH), 0)
  );

  // Scrollbar calculations — fixed thumb size, scroll speed scales with content
  const V_THUMB = 40;
  const H_THUMB = 120;

  let showVertical = $derived(contentHeight > viewport.height);
  let showHorizontal = $derived(contentWidth > viewport.width);

  // Vertical thumb
  let vMaxScroll = $derived(contentHeight - viewport.height);
  let vTrackSpace = $derived(viewport.height - V_THUMB);
  let vThumbPosition = $derived(vMaxScroll > 0 ? (scrollStore.scrollTop / vMaxScroll) * vTrackSpace : 0);

  // Horizontal thumb
  let hMaxScroll = $derived(contentWidth - viewport.width);
  let hTrackSpace = $derived(viewport.width - H_THUMB);
  let hThumbPosition = $derived(hMaxScroll > 0 ? (scrollStore.scrollLeft / hMaxScroll) * hTrackSpace : 0);

  // Viewport measurement
  let viewportRef: HTMLDivElement | null = $state(null);
  $effect(() => {
    if (!viewportRef) return;
    // Synchronous initial read — runs before browser paints
    viewport.width = viewportRef.clientWidth;
    viewport.height = viewportRef.clientHeight;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === viewport.width && height === viewport.height) return;
        viewport.width = width;
        viewport.height = height;
      }
    });
    ro.observe(viewportRef);
    return () => ro.disconnect();
  });

  // Auto-scroll (middle click)
  function handleMouseDown(e: MouseEvent) {
    if (e.button === 1) {
      e.preventDefault();
      if (scrollStore.isAutoScrolling) { virtualGrid.stopAutoScroll(); return; }
      virtualGrid.startAutoScroll(e.clientX, e.clientY);
      return;
    }
    if (scrollStore.isAutoScrolling) virtualGrid.stopAutoScroll();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="h-[calc(100dvh-8.9rem)] rounded-lg border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-md overflow-hidden flex flex-col select-none focus:outline-none"
  tabindex="-1"
>
  {#if assetStore.displayedAssets.length > 0}
    <!-- Header: scrolls horizontally, stays pinned vertically -->
    <div class="relative z-10">
      <div style="transform: translateX({-scrollStore.scrollLeft}px);">
        <GridHeader {keys} />
      </div>
    </div>

    <!-- Viewport -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      bind:this={viewportRef}
      onwheel={virtualGrid.handleWheel}
      onmousedown={handleMouseDown}
      class="flex-1 min-h-0 relative overflow-hidden"
    >
      <div style="transform: translateX({-scrollStore.scrollLeft}px);">
        <GridOverlays />

        <div
          class="absolute top-0 w-full"
          style="top: {scrollStore.visibleRange.startIndex * DEFAULT_ROW_HEIGHT - scrollStore.scrollTop}px;"
        >
          {#each visibleItems as asset, i (asset.id || scrollStore.visibleRange.startIndex + i)}
            <GridRow {asset} {keys} />
          {/each}
        </div>

        <EditHandler />
      </div>

      <!-- Scrollbars (overlay siblings, not wrappers) -->
      <CustomScrollbar
        orientation="vertical"
        visible={showVertical}
        size="thin"
        thumbSize={V_THUMB}
        thumbPosition={vThumbPosition}
        trackSpace={vTrackSpace}
        maxScroll={vMaxScroll}
        onscroll={(pos) => virtualGrid.clampedScroll(pos, scrollStore.scrollLeft)}
      />
    </div>

    <!-- Horizontal scrollbar: flex child at bottom, not absolute inside viewport -->
    <CustomScrollbar
      orientation="horizontal"
      visible={showHorizontal}
      size="thin"
      thumbSize={H_THUMB}
      thumbPosition={hThumbPosition}
      trackSpace={hTrackSpace}
      maxScroll={hMaxScroll}
      onscroll={(pos) => virtualGrid.clampedScroll(scrollStore.scrollTop, pos)}
    />

    {#if uiStore.contextMenu.visible}
      <ContextMenu />
    {/if}
  {:else}
    <div class="flex items-center justify-center h-full">
      <p class="text-lg text-neutral-400">Query successful, but no data was returned.</p>
    </div>
  {/if}
</div>
{#if assetStore.displayedAssets.length > 0}
  <p class="ml-1 text-sm text-neutral-600 dark:text-neutral-300">
    Showing {assetStore.displayedAssets.length} items.
  </p>
{/if}

{#if scrollStore.isAutoScrolling}
  <div
    class="fixed z-[100] pointer-events-none -translate-x-1/2 -translate-y-1/2
      w-7 h-7 rounded-full border border-neutral-300 dark:border-slate-600
      bg-white/90 dark:bg-slate-800/90 shadow-md flex items-center justify-center"
    style="left: {virtualGrid.autoScrollOriginX}px; top: {virtualGrid.autoScrollOriginY}px;"
  >
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" class="text-neutral-500 dark:text-slate-400">
      <path d="M11 1 L8 5 H14 Z" fill="currentColor" />
      <path d="M11 21 L8 17 H14 Z" fill="currentColor" />
      <path d="M1 11 L5 8 V14 Z" fill="currentColor" />
      <path d="M21 11 L17 8 V14 Z" fill="currentColor" />
      <circle cx="11" cy="11" r="1.5" fill="currentColor" />
    </svg>
  </div>
{/if}
