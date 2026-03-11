<script lang="ts">
  import type { ScrollbarState, ScrollbarSize } from './customScrollbar.svelte.ts';
  import type { Snippet } from 'svelte';

  interface Props {
    scroll: ScrollbarState;
    height: string;
    size?: ScrollbarSize;
    vertical?: boolean;
    horizontal?: boolean;
    children: Snippet;
    onscroll?: (scrollTop: number, scrollLeft: number) => void;
  }

  let {
    scroll,
    height,
    size = 'thin',
    vertical = true,
    horizontal = true,
    children,
    onscroll,
  }: Props = $props();

  const trackSize = $derived(scroll.TRACK_SIZES[size]);

  // Clamp thumb positions so they stop before the corner square
  const bothVisible = $derived(vertical && scroll.vVisible && horizontal && scroll.hVisible);
  const vThumbTop = $derived(bothVisible
    ? Math.min(scroll.vThumbTop, scroll.viewportHeight - trackSize - scroll.vThumbHeight)
    : scroll.vThumbTop);
  const hThumbLeft = $derived(bothVisible
    ? Math.min(scroll.hThumbLeft, scroll.viewportWidth - trackSize - scroll.hThumbWidth)
    : scroll.hThumbLeft);

  let containerRef: HTMLDivElement | null = $state(null);
  let isDraggingV = $state(false);
  let isDraggingH = $state(false);
  let dragStartY = $state(0);
  let dragStartX = $state(0);
  let dragStartScrollTop = $state(0);
  let dragStartScrollLeft = $state(0);

  // Observe container dimensions
  $effect(() => {
    if (!containerRef) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        scroll.setDimensions(
          scroll.contentWidth,
          scroll.contentHeight,
          entry.contentRect.width,
          entry.contentRect.height
        );
      }
    });
    ro.observe(containerRef);
    return () => ro.disconnect();
  });

  // Wheel handler
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const newTop = scroll.scrollTop + e.deltaY;
    const newLeft = scroll.scrollLeft + e.deltaX;
    scroll.setScroll(newTop, newLeft);
    onscroll?.(scroll.scrollTop, scroll.scrollLeft);
  }

  // --- Vertical thumb drag ---
  function onVThumbDown(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDraggingV = true;
    dragStartY = e.clientY;
    dragStartScrollTop = scroll.scrollTop;
    window.addEventListener('mousemove', onVDrag);
    window.addEventListener('mouseup', onVDragEnd);
  }

  function onVDrag(e: MouseEvent) {
    const deltaY = e.clientY - dragStartY;
    const newTop = scroll.vTrackToScroll(
      (dragStartScrollTop / (scroll.vMaxScroll || 1)) * (scroll.viewportHeight - scroll.vThumbHeight) + deltaY
    );
    scroll.scrollTop = newTop;
    onscroll?.(scroll.scrollTop, scroll.scrollLeft);
  }

  function onVDragEnd() {
    isDraggingV = false;
    window.removeEventListener('mousemove', onVDrag);
    window.removeEventListener('mouseup', onVDragEnd);
  }

  // Vertical track click
  function onVTrackClick(e: MouseEvent) {
    const track = e.currentTarget as HTMLElement;
    const rect = track.getBoundingClientRect();
    const clickY = e.clientY - rect.top - scroll.vThumbHeight / 2;
    scroll.scrollTop = scroll.vTrackToScroll(clickY);
    onscroll?.(scroll.scrollTop, scroll.scrollLeft);
  }

  // --- Horizontal thumb drag ---
  function onHThumbDown(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDraggingH = true;
    dragStartX = e.clientX;
    dragStartScrollLeft = scroll.scrollLeft;
    window.addEventListener('mousemove', onHDrag);
    window.addEventListener('mouseup', onHDragEnd);
  }

  function onHDrag(e: MouseEvent) {
    const deltaX = e.clientX - dragStartX;
    const newLeft = scroll.hTrackToScroll(
      (dragStartScrollLeft / (scroll.hMaxScroll || 1)) * (scroll.viewportWidth - scroll.hThumbWidth) + deltaX
    );
    scroll.scrollLeft = newLeft;
    onscroll?.(scroll.scrollTop, scroll.scrollLeft);
  }

  function onHDragEnd() {
    isDraggingH = false;
    window.removeEventListener('mousemove', onHDrag);
    window.removeEventListener('mouseup', onHDragEnd);
  }

  // Horizontal track click
  function onHTrackClick(e: MouseEvent) {
    const track = e.currentTarget as HTMLElement;
    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left - scroll.hThumbWidth / 2;
    scroll.scrollLeft = scroll.hTrackToScroll(clickX);
    onscroll?.(scroll.scrollTop, scroll.scrollLeft);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={containerRef}
  onwheel={handleWheel}
  class="relative overflow-hidden"
  style="height: {height};"
>
  {@render children()}

  <!-- Vertical scrollbar -->
  {#if vertical && scroll.vVisible}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute top-0 right-0 z-[200] bg-neutral-200 dark:bg-slate-700"
      style="width: {trackSize}px; height: {horizontal && scroll.hVisible ? `calc(100% - ${trackSize}px)` : '100%'};"
      onmousedown={onVTrackClick}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute w-full rounded-full transition-colors
          {isDraggingV ? 'bg-neutral-600 dark:bg-slate-300' : 'bg-neutral-400 dark:bg-slate-400 hover:bg-neutral-500 dark:hover:bg-slate-300'}"
        style="top: {vThumbTop}px; height: {scroll.vThumbHeight}px;"
        onmousedown={onVThumbDown}
      ></div>
    </div>
  {/if}

  <!-- Horizontal scrollbar -->
  {#if horizontal && scroll.hVisible}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute bottom-0 left-0 z-[200] bg-neutral-200 dark:bg-slate-700"
      style="height: {trackSize}px; width: {vertical && scroll.vVisible ? `calc(100% - ${trackSize}px)` : '100%'};"
      onmousedown={onHTrackClick}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute h-full rounded-full transition-colors
          {isDraggingH ? 'bg-neutral-600 dark:bg-slate-300' : 'bg-neutral-400 dark:bg-slate-400 hover:bg-neutral-500 dark:hover:bg-slate-300'}"
        style="left: {hThumbLeft}px; width: {scroll.hThumbWidth}px;"
        onmousedown={onHThumbDown}
      ></div>
    </div>
  {/if}

  <!-- Corner square where both scrollbars meet -->
  {#if vertical && scroll.vVisible && horizontal && scroll.hVisible}
    <div
      class="absolute bottom-0 right-0 z-[200] bg-neutral-200 dark:bg-slate-700"
      style="width: {trackSize}px; height: {trackSize}px;"
    ></div>
  {/if}
</div>
