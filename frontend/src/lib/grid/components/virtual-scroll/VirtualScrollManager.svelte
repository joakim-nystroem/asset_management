<script lang="ts">
  import type { Snippet } from 'svelte';
  import CustomScrollbar from './CustomScrollbar.svelte';
  import { createScrollbarState, type ScrollbarSize } from './customScrollbar.svelte.ts';
  import { DEFAULT_ROW_HEIGHT } from '$lib/grid/gridConfig';
  import { getScrollSignalContext } from '$lib/context/gridContext.svelte';

  interface Props {
    scrollTop?: number;
    scrollLeft?: number;
    visibleRange?: { startIndex: number; endIndex: number };
    rowCount: number;
    rowHeight?: number;
    contentWidth: number;
    height: string;
    scrollbarSize?: ScrollbarSize;
    vertical?: boolean;
    horizontal?: boolean;
    children: Snippet;
  }

  let {
    scrollTop = $bindable(0),
    scrollLeft = $bindable(0),
    visibleRange = $bindable({ startIndex: 0, endIndex: 0 }),
    rowCount,
    rowHeight = DEFAULT_ROW_HEIGHT,
    contentWidth,
    height,
    scrollbarSize = 'thin',
    vertical = true,
    horizontal = true,
    children,
  }: Props = $props();

  const scrollSignalCtx = getScrollSignalContext();
  const scrollbar = createScrollbarState();
  const overscan = 15;

  // --- Content height from row count ---
  const contentHeight = $derived(rowCount * rowHeight + scrollbar.TRACK_SIZES[scrollbarSize]);

  // --- Keep scrollbar content dimensions in sync ---
  $effect(() => {
    scrollbar.setDimensions(contentWidth, contentHeight, scrollbar.viewportWidth, scrollbar.viewportHeight);
  });

  // --- Derive visible range ---
  $effect(() => {
    const startIndex = Math.max(0, Math.floor(scrollbar.scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(scrollbar.viewportHeight / rowHeight);
    const endIndex = Math.min(startIndex + visibleCount + (overscan * 2), rowCount);
    visibleRange = { startIndex, endIndex };
  });

  // --- Sync scrollbar → bindable props ---
  function handleScrollbarScroll(top: number, left: number) {
    scrollbar.setScroll(top, left);
    scrollTop = scrollbar.scrollTop;
    scrollLeft = scrollbar.scrollLeft;
  }

  // --- Watch external writes to scrollTop/scrollLeft (from parent binding) ---
  $effect(() => {
    // Touch scrollTop/scrollLeft to subscribe
    const _top = scrollTop;
    const _left = scrollLeft;
    scrollbar.setScroll(_top, _left);
  });

  // --- ScrollToRow signal ---
  $effect(() => {
    const row = scrollSignalCtx.scrollToRow;
    if (row === null) return;

    const rowTop = row * rowHeight;
    const rowBottom = rowTop + rowHeight;
    const viewTop = scrollbar.scrollTop;
    const viewBottom = scrollbar.scrollTop + scrollbar.viewportHeight;

    if (rowTop < viewTop) {
      scrollbar.scrollTop = rowTop;
    } else if (rowBottom > viewBottom) {
      scrollbar.scrollTop = rowBottom - scrollbar.viewportHeight + 40;
    }

    scrollTop = scrollbar.scrollTop;
    scrollSignalCtx.scrollToRow = null;
  });

  // --- ScrollToCol signal ---
  $effect(() => {
    const col = scrollSignalCtx.scrollToCol;
    if (col === null) return;

    const viewLeft = scrollbar.scrollLeft;
    const viewRight = scrollbar.scrollLeft + scrollbar.viewportWidth;

    if (col.left < viewLeft) {
      scrollbar.scrollLeft = col.left;
    } else if (col.right > viewRight) {
      scrollbar.scrollLeft = col.right - scrollbar.viewportWidth;
    }

    scrollLeft = scrollbar.scrollLeft;
    scrollSignalCtx.scrollToCol = null;
  });

  // --- Auto-scroll ---
  let autoScrollOriginX = $state(0);
  let autoScrollOriginY = $state(0);
  let autoScrollDX = 0;
  let autoScrollDY = 0;
  let autoScrollRAF = 0;

  function onAutoScrollMove(e: MouseEvent) {
    autoScrollDX = e.clientX - autoScrollOriginX;
    autoScrollDY = e.clientY - autoScrollOriginY;
  }

  function autoScrollLoop() {
    if (!scrollSignalCtx.isAutoScrolling) return;
    const deadzone = 5;
    const speed = 0.15;
    const dx = Math.abs(autoScrollDX) > deadzone ? autoScrollDX * speed : 0;
    const dy = Math.abs(autoScrollDY) > deadzone ? autoScrollDY * speed : 0;
    if (dx !== 0 || dy !== 0) {
      handleScrollbarScroll(scrollbar.scrollTop + dy, scrollbar.scrollLeft + dx);
    }
    autoScrollRAF = requestAnimationFrame(autoScrollLoop);
  }

  function stopAutoScroll() {
    scrollSignalCtx.isAutoScrolling = false;
    autoScrollDX = 0;
    autoScrollDY = 0;
    cancelAnimationFrame(autoScrollRAF);
    window.removeEventListener('mousemove', onAutoScrollMove);
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button === 1) {
      e.preventDefault();
      if (scrollSignalCtx.isAutoScrolling) { stopAutoScroll(); return; }
      scrollSignalCtx.isAutoScrolling = true;
      autoScrollOriginX = e.clientX;
      autoScrollOriginY = e.clientY;
      window.addEventListener('mousemove', onAutoScrollMove);
      autoScrollLoop();
      return;
    }
    // Any other click stops auto-scroll
    if (scrollSignalCtx.isAutoScrolling) stopAutoScroll();
  }

  // Watch for external stop (EventListener sets isAutoScrolling = false)
  $effect(() => {
    if (!scrollSignalCtx.isAutoScrolling) {
      autoScrollDX = 0;
      autoScrollDY = 0;
      cancelAnimationFrame(autoScrollRAF);
      window.removeEventListener('mousemove', onAutoScrollMove);
    }
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div onmousedown={handleMouseDown}>
  <CustomScrollbar
    scroll={scrollbar}
    {height}
    size={scrollbarSize}
    {vertical}
    {horizontal}
    onscroll={(top, left) => handleScrollbarScroll(top, left)}
  >
    {@render children()}
  </CustomScrollbar>
</div>

{#if scrollSignalCtx.isAutoScrolling}
  <div
    class="fixed z-[9999] pointer-events-none -translate-x-1/2 -translate-y-1/2
      w-7 h-7 rounded-full border border-neutral-300 dark:border-slate-600
      bg-white/90 dark:bg-slate-800/90 shadow-md flex items-center justify-center"
    style="left: {autoScrollOriginX}px; top: {autoScrollOriginY}px;"
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
