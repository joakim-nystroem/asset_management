<script lang="ts">
  import { page } from '$app/state';
  import {
    getUiContext,
    getPendingContext,
    getNewRowContext,
    getQueryContext,
    getSortContext,
    getEditingContext,
    getSelectionContext,
    getClipboardContext,
    getViewContext,
    getColumnWidthContext,
    setOpenPanel,
  } from '$lib/context/gridContext.svelte';

  import { createKeyboardHandler } from './EventListener.svelte.ts';
  import { enqueue } from './eventQueue';

  let { children } = $props();

  const uiCtx = getUiContext();
  const pendingCtx = getPendingContext();
  const newRowCtx = getNewRowContext();
  const queryCtx = getQueryContext();
  const sortCtx = getSortContext();
  const editingCtx = getEditingContext();
  const selCtx = getSelectionContext();
  const clipCtx = getClipboardContext();
  const viewCtx = getViewContext();
  const colWidthCtx = getColumnWidthContext();

  const handleKeyDown = createKeyboardHandler({
    editingCtx, selCtx, clipCtx, viewCtx, uiCtx, colWidthCtx,
  });

  // --- Middle-click auto-scroll ---
  let isAutoScrolling = $state(false);
  let autoScrollOriginX = $state(0);
  let autoScrollOriginY = $state(0);
  let autoScrollDX = 0;
  let autoScrollDY = 0;
  let autoScrollRAF = 0;

  function handleMiddleDown(e: MouseEvent) {
    if (e.button === 1) {
      e.preventDefault();
      if (isAutoScrolling) { stopAutoScroll(); return; }
      isAutoScrolling = true;
      autoScrollOriginX = e.clientX;
      autoScrollOriginY = e.clientY;
      window.addEventListener('mousemove', onAutoScrollMove);
      autoScrollLoop();
      return;
    }
    // Any other mouse button stops auto-scroll
    if (isAutoScrolling) stopAutoScroll();
  }

  function onAutoScrollMove(e: MouseEvent) {
    autoScrollDX = e.clientX - autoScrollOriginX;
    autoScrollDY = e.clientY - autoScrollOriginY;
  }

  function autoScrollLoop() {
    if (!isAutoScrolling) return;
    const deadzone = 5;
    const speed = 0.15;
    const dx = Math.abs(autoScrollDX) > deadzone ? autoScrollDX * speed : 0;
    const dy = Math.abs(autoScrollDY) > deadzone ? autoScrollDY * speed : 0;
    if (dx !== 0 || dy !== 0) {
      viewCtx.setScroll(viewCtx.scrollTop + dy, viewCtx.scrollLeft + dx);
    }
    autoScrollRAF = requestAnimationFrame(autoScrollLoop);
  }

  function stopAutoScroll() {
    isAutoScrolling = false;
    autoScrollDX = 0;
    autoScrollDY = 0;
    cancelAnimationFrame(autoScrollRAF);
    window.removeEventListener('mousemove', onAutoScrollMove);
  }

  // ─── COMMIT_UPDATE: existing row edits ─────────────────────────────────────
  $effect(() => {
    if (uiCtx.commitRequested) {
      enqueue(
        {
          type: 'COMMIT_UPDATE',
          payload: {
            changes: $state.snapshot(pendingCtx.edits),
            hasInvalidChanges: pendingCtx.edits.some((e) => !e.isValid),
            user: page.data.user ?? null,
          },
        },
        { pendingCtx },
      );
      uiCtx.commitRequested = false;
    }
  });

  // ─── COMMIT_CREATE: new row creation ───────────────────────────────────────
  $effect(() => {
    if (uiCtx.commitCreateRequested) {
      enqueue(
        {
          type: 'COMMIT_CREATE',
          payload: {
            rows: $state.snapshot(newRowCtx.newRows),
            user: page.data.user ?? null,
          },
        },
        { newRowCtx },
      );
      uiCtx.commitCreateRequested = false;
    }
  });

  // ─── DISCARD: revert uncommitted changes ───────────────────────────────────
  $effect(() => {
    if (uiCtx.discardRequested) {
      enqueue(
        {
          type: 'DISCARD',
          payload: {
            user: page.data.user ?? null,
          },
        },
        { pendingCtx, newRowCtx },
      );
      uiCtx.discardRequested = false;
    }
  });

  // ─── QUERY: auto-fire on any queryCtx change (view, search, filters) ──────
  let queryInitialized = false;
  $effect(() => {
    const view = queryCtx.view;
    const q = queryCtx.q;
    const filters = $state.snapshot(queryCtx.filters);

    if (!queryInitialized) {
      queryInitialized = true;
      return;
    }

    sortCtx.key = null;
    enqueue(
      {
        type: 'QUERY',
        payload: { view, q, filters },
      },
      {},
    );
  });
</script>

<svelte:window
  onkeydown={(e) => { if (isAutoScrolling) { stopAutoScroll(); return; } handleKeyDown(e); }}
  onmousedown={handleMiddleDown}
  onmouseup={() => { selCtx.isSelecting = false; }}
  onclick={(e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-panel]')) return;
    setOpenPanel(uiCtx);
  }}
/>

{#if isAutoScrolling}
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

{@render children?.()}