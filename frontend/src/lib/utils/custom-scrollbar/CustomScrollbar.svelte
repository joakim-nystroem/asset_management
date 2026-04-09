<script lang="ts">
  const TRACK_SIZES = { thin: 6, wide: 10 } as const;
  type ScrollbarSize = 'thin' | 'wide';

  interface Props {
    orientation: 'vertical' | 'horizontal';
    visible?: boolean;
    size?: ScrollbarSize;
    thumbSize: number;
    thumbPosition: number;
    trackSpace: number;
    maxScroll: number;
    onscroll: (position: number) => void;
  }

  let {
    orientation,
    visible = true,
    size = 'thin',
    thumbSize,
    thumbPosition,
    trackSpace,
    maxScroll,
    onscroll,
  }: Props = $props();

  const trackSize = $derived(TRACK_SIZES[size]);

  let isDragging = $state(false);
  let dragStart = $state(0);
  let dragStartScroll = $state(0);

  function trackToScroll(trackPos: number): number {
    if (trackSpace <= 0) return 0;
    return Math.max(0, Math.min(trackPos / trackSpace, 1)) * maxScroll;
  }

  function onThumbDown(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    dragStart = orientation === 'vertical' ? e.clientY : e.clientX;
    dragStartScroll = thumbPosition;
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', onDragEnd);
  }

  function onDrag(e: MouseEvent) {
    const delta = (orientation === 'vertical' ? e.clientY : e.clientX) - dragStart;
    onscroll(trackToScroll(dragStartScroll + delta));
  }

  function onDragEnd() {
    isDragging = false;
    window.removeEventListener('mousemove', onDrag);
    window.removeEventListener('mouseup', onDragEnd);
  }

  function onTrackClick(e: MouseEvent) {
    const track = e.currentTarget as HTMLElement;
    const rect = track.getBoundingClientRect();
    const clickPos = (orientation === 'vertical' ? e.clientY - rect.top : e.clientX - rect.left) - thumbSize / 2;
    onscroll(trackToScroll(clickPos));
  }
</script>

{#if orientation === 'vertical'}
  {#if visible}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="absolute z-[60] bg-border"
      style="top: 0; right: 0; width: {trackSize}px; height: 100%;"
      onmousedown={onTrackClick}
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute rounded-full transition-colors
          {isDragging ? 'bg-neutral-600 dark:bg-slate-300' : 'bg-neutral-400 dark:bg-slate-400 hover:bg-neutral-500 dark:hover:bg-slate-300'}"
        style="top: {thumbPosition}px; height: {thumbSize}px; width: 100%;"
        onmousedown={onThumbDown}
      ></div>
    </div>
  {/if}
{:else}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="relative z-[60] bg-border"
    style="height: {trackSize}px;"
    onmousedown={visible ? onTrackClick : undefined}
  >
    {#if visible}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute rounded-full transition-colors
          {isDragging ? 'bg-neutral-600 dark:bg-slate-300' : 'bg-neutral-400 dark:bg-slate-400 hover:bg-neutral-500 dark:hover:bg-slate-300'}"
        style="left: {thumbPosition}px; width: {thumbSize}px; height: 100%;"
        onmousedown={onThumbDown}
      ></div>
    {/if}
  </div>
{/if}
