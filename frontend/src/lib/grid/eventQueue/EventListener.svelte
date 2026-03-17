<script lang="ts">
  import { queryStore } from '$lib/data/queryStore.svelte';
  import {
    getUiContext,
    getSortContext,
    getEditingContext,
    getSelectionContext,
    getClipboardContext,
    getColumnWidthContext,
    getScrollSignalContext,
    getPendingContext,
    setOpenPanel,
  } from '$lib/context/gridContext.svelte';
  import { realtime } from '$lib/utils/realtimeManager.svelte';

  import { replaceState } from '$app/navigation';
  import { createKeyboardHandler } from './EventListener.svelte.ts';
  import { enqueue } from './eventQueue';

  let { children } = $props();

  const uiCtx = getUiContext();
  const sortCtx = getSortContext();
  const editingCtx = getEditingContext();
  const selCtx = getSelectionContext();
  const clipCtx = getClipboardContext();
  const colWidthCtx = getColumnWidthContext();
  const scrollSignalCtx = getScrollSignalContext();
  const pendingCtx = getPendingContext();
  const handleKeyDown = createKeyboardHandler({
    editingCtx, pendingCtx, selCtx, clipCtx, uiCtx, colWidthCtx,
  });

  // ─── CLIENT_STATE provider for reconnect ─────────────────────────────────
  realtime.setLocalStateProvider(() => {
    const position = selCtx.selectionStart.row !== -1
      ? { row: selCtx.selectionStart.row, col: selCtx.selectionStart.col }
      : null;
    const lock = editingCtx.isEditing && editingCtx.editRow !== -1
      ? { assetId: editingCtx.editRow, key: editingCtx.editCol }
      : null;
    const pending = pendingCtx.edits.map(e => ({
      assetId: e.row,
      key: e.col,
      value: e.value,
    }));
    return { position, lock, pending };
  });

  // ─── WS BRIDGE: outbound selection → position update ───────────────────────
  $effect(() => {
    const row = selCtx.selectionStart.row;
    const col = selCtx.selectionStart.col;

    if (row === -1 || col === '') {
      enqueue({ type: 'POSITION_DESELECT', payload: {} }, {});
      return;
    }
    enqueue({ type: 'POSITION_UPDATE', payload: { assetId: row, key: col } }, {});
  });

  // ─── WS BRIDGE: outbound edit lock ────────────────────────────────────────
  $effect(() => {
    if (editingCtx.isEditing && editingCtx.editRow !== -1 && editingCtx.editCol !== '') {
      enqueue({ type: 'CELL_EDIT_START', payload: { assetId: editingCtx.editRow, key: editingCtx.editCol } }, {});
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
