import { scrollStore } from '$lib/data/scrollStore.svelte';
import { assetStore } from '$lib/data/assetStore.svelte';
import { uiStore, columnWidthStore } from '$lib/data/uiStore.svelte';
import { gridPrefsStore } from '$lib/data/gridPrefsStore.svelte';
import { DEFAULT_WIDTH } from '$lib/grid/gridConfig';
import { getContext } from 'svelte';

const OVERSCAN = 15;
const AUTO_SCROLL_DEADZONE = 5;
const AUTO_SCROLL_SPEED = 0.15;

// ── Helpers ──────────────────────────────────────────────────

function calculateContentHeight(): number {
  return assetStore.displayedAssets.length * gridPrefsStore.rowHeight;
}

function calculateContentWidth(colWidths: Map<string, number>): number {
  const keys = Object.keys(assetStore.displayedAssets[0] ?? {});
  return keys.reduce((sum, key) => sum + (colWidths.get(key) ?? DEFAULT_WIDTH), 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

// ── Main ─────────────────────────────────────────────────────

export function createVirtualGridContainer() {
  const viewport = getContext<{ width: number; height: number }>('viewport');

  setupVisibleRangeTracking(viewport);
  setupScrollToRowSignal(viewport);
  setupScrollToColSignal(viewport);

  const autoScroll = createAutoScroller(viewport);

  function applyClampedScroll(top: number, left: number) {
    const maxVertical = Math.max(0, calculateContentHeight() - viewport.height);
    const maxHorizontal = Math.max(0, calculateContentWidth(columnWidthStore.widths) - viewport.width);

    scrollStore.scrollTop = clamp(top, 0, maxVertical);
    scrollStore.scrollLeft = clamp(left, 0, maxHorizontal);
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    uiStore.contextMenu.visible = false;
    applyClampedScroll(
      scrollStore.scrollTop + e.deltaY,
      scrollStore.scrollLeft + e.deltaX,
    );
  }

  return {
    handleWheel,
    clampedScroll: applyClampedScroll,
    startAutoScroll: autoScroll.start,
    stopAutoScroll: autoScroll.stop,
    get autoScrollOriginX() { return autoScroll.originX; },
    get autoScrollOriginY() { return autoScroll.originY; },
  };
}

// ── Visible range tracking ───────────────────────────────────

function setupVisibleRangeTracking(viewport: { height: number }) {
  $effect(() => {
    const rowCount = assetStore.displayedAssets.length;
    const contentHeight = rowCount * gridPrefsStore.rowHeight;
    const maxScroll = Math.max(0, contentHeight - viewport.height);

    // Clamp scrollTop when content shrinks (e.g. discard new rows, filter)
    if (scrollStore.scrollTop > maxScroll) {
      scrollStore.scrollTop = maxScroll;
    }

    const visibleCount = Math.ceil(viewport.height / gridPrefsStore.rowHeight);
    const startIndex = Math.max(0, Math.floor(scrollStore.scrollTop / gridPrefsStore.rowHeight) - OVERSCAN);
    const endIndex = Math.min(startIndex + visibleCount + OVERSCAN * 2, rowCount);

    scrollStore.visibleRange = { startIndex, endIndex };
  });
}

// ── Scroll-to-row signal ─────────────────────────────────────

function setupScrollToRowSignal(viewport: { height: number }) {
  $effect(() => {
    const row = scrollStore.scrollToRow;
    if (row === null) return;

    const rowTop = row * gridPrefsStore.rowHeight;
    const rowBottom = rowTop + gridPrefsStore.rowHeight;
    const viewBottom = scrollStore.scrollTop + viewport.height;

    if (rowTop < scrollStore.scrollTop) {
      scrollStore.scrollTop = rowTop;
    } else if (rowBottom > viewBottom) {
      scrollStore.scrollTop = rowBottom - viewport.height;
    }

    scrollStore.scrollToRow = null;
  });
}

// ── Scroll-to-col signal ─────────────────────────────────────

function setupScrollToColSignal(viewport: { width: number }) {
  $effect(() => {
    const col = scrollStore.scrollToCol;
    if (col === null) return;

    const viewRight = scrollStore.scrollLeft + viewport.width;

    if (col.left < scrollStore.scrollLeft) {
      scrollStore.scrollLeft = col.left;
    } else if (col.right > viewRight) {
      scrollStore.scrollLeft = col.right - viewport.width;
    }

    scrollStore.scrollToCol = null;
  });
}

// ── Auto-scroll (middle-click drag) ──────────────────────────

function createAutoScroller(viewport: { width: number; height: number }) {
  let originX = $state(0);
  let originY = $state(0);
  let deltaX = 0;
  let deltaY = 0;
  let rafId = 0;

  function onMouseMove(e: MouseEvent) {
    deltaX = e.clientX - originX;
    deltaY = e.clientY - originY;
  }

  function tick() {
    if (!scrollStore.isAutoScrolling) return;

    const dx = Math.abs(deltaX) > AUTO_SCROLL_DEADZONE ? deltaX * AUTO_SCROLL_SPEED : 0;
    const dy = Math.abs(deltaY) > AUTO_SCROLL_DEADZONE ? deltaY * AUTO_SCROLL_SPEED : 0;

    if (dx !== 0 || dy !== 0) {
      const maxV = Math.max(0, calculateContentHeight() - viewport.height);
      const maxH = Math.max(0, calculateContentWidth(columnWidthStore.widths) - viewport.width);

      scrollStore.scrollTop = clamp(scrollStore.scrollTop + dy, 0, maxV);
      scrollStore.scrollLeft = clamp(scrollStore.scrollLeft + dx, 0, maxH);
    }

    rafId = requestAnimationFrame(tick);
  }

  function resetState() {
    deltaX = 0;
    deltaY = 0;
    cancelAnimationFrame(rafId);
    window.removeEventListener('mousemove', onMouseMove);
  }

  function start(x: number, y: number) {
    scrollStore.isAutoScrolling = true;
    originX = x;
    originY = y;
    deltaX = 0;
    deltaY = 0;
    window.addEventListener('mousemove', onMouseMove);
    tick();
  }

  function stop() {
    scrollStore.isAutoScrolling = false;
    resetState();
  }

  // Sync cleanup when auto-scroll is stopped externally
  $effect(() => {
    if (!scrollStore.isAutoScrolling) {
      resetState();
    }
  });

  return {
    start,
    stop,
    get originX() { return originX; },
    get originY() { return originY; },
  };
}
