<script lang="ts">
  import { page } from '$app/state';
  import { queryStore } from '$lib/data/queryStore.svelte';
  import {
    getUiContext,
    getPendingContext,
    getNewRowContext,
    getSortContext,
    getEditingContext,
    getSelectionContext,
    getClipboardContext,
    getColumnWidthContext,
    getScrollSignalContext,
    getPresenceContext,
    setOpenPanel,
  } from '$lib/context/gridContext.svelte';
  import { realtime } from '$lib/utils/realtimeManager.svelte';

  import { replaceState } from '$app/navigation';
  import { createKeyboardHandler } from './EventListener.svelte.ts';
  import { enqueue } from './eventQueue';

  let { children } = $props();

  const uiCtx = getUiContext();
  const pendingCtx = getPendingContext();
  const newRowCtx = getNewRowContext();
  const sortCtx = getSortContext();
  const editingCtx = getEditingContext();
  const selCtx = getSelectionContext();
  const clipCtx = getClipboardContext();
  const colWidthCtx = getColumnWidthContext();
  const scrollSignalCtx = getScrollSignalContext();
  const presenceCtx = getPresenceContext();

  const handleKeyDown = createKeyboardHandler({
    editingCtx, selCtx, clipCtx, uiCtx, colWidthCtx, presenceCtx,
  });

  // ─── WS BRIDGE: incoming messages → queue ──────────────────────────────────
  realtime.setMessageHandler((type, payload) => {
    enqueue({ type: 'WS_' + type, payload }, { presenceCtx, editingCtx });
  });

  // ─── WS BRIDGE: outbound edit lock/unlock ──────────────────────────────────
  $effect(() => {
    if (editingCtx.isEditing && editingCtx.editRow !== -1 && editingCtx.editCol !== '') {
      enqueue({ type: 'CELL_EDIT_START', payload: { assetId: editingCtx.editRow, key: editingCtx.editCol } }, {});
    } else if (!editingCtx.isEditing) {
      enqueue({ type: 'CELL_EDIT_END', payload: {} }, {});
    }
  });

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

  // ─── QUERY: auto-fire on any queryStore change (view, search, filters) ──────
  let queryInitialized = false;
  $effect(() => {
    const view = queryStore.view;
    const q = queryStore.q;
    const filters = $state.snapshot(queryStore.filters);

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

    // Sync URL to reflect current query state
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    if (q) url.searchParams.set('q', q); else url.searchParams.delete('q');
    url.searchParams.delete('filter');
    for (const f of filters) url.searchParams.append('filter', `${f.key}:${f.value}`);
    replaceState(url, {});
  });
</script>

<svelte:window
  onkeydown={(e) => {
    if (scrollSignalCtx.isAutoScrolling) {
      scrollSignalCtx.isAutoScrolling = false;
      return;
    }
    handleKeyDown(e);
  }}
  onmouseup={() => { selCtx.isSelecting = false; }}
  onclick={(e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-panel]')) return;
    setOpenPanel(uiCtx);
  }}
/>

{@render children?.()}
