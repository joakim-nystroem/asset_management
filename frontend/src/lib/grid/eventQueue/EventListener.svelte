<script lang="ts">
  import { page } from '$app/state';
  import {
    getUiContext,
    getEditingContext,
    getSelectionContext,
    getClipboardContext,
    getColumnWidthContext,
    getScrollSignalContext,
    getPendingContext,
    setOpenPanel,
    resetEditing,
  } from '$lib/context/gridContext.svelte';
  import { realtime } from '$lib/utils/realtimeManager.svelte';
  import {
    startCellEdit,
    getArrowTarget,
    selectCell,
    resetSelection,
    clearClipboard,
    colBounds,
    getAssets,
    getKeys,
    assetIndex,
  } from './EventListener.svelte.ts';
  import { enqueue } from './eventQueue';
  import { toastState } from '$lib/toast/toastState.svelte';

  let { children } = $props();

  const uiCtx = getUiContext();
  const editingCtx = getEditingContext();
  const selCtx = getSelectionContext();
  const clipCtx = getClipboardContext();
  const colWidthCtx = getColumnWidthContext();
  const scrollSignalCtx = getScrollSignalContext();
  const pendingCtx = getPendingContext();

  const user = $derived(page.data.user);

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

  // ─── Keyboard handler ──────────────────────────────────────────────────────
  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    if (isInput) return;

    const assets = getAssets();
    const keys = getKeys();

    if (e.key === 'Escape') {
      if (editingCtx.isEditing) {
        resetEditing(editingCtx);
        enqueue({ type: 'CELL_EDIT_END', payload: {} }, {});
        return;
      }
      if (selCtx.selectionStart.row !== -1) {
        resetSelection(selCtx);
      }
      clearClipboard(clipCtx);
      setOpenPanel(uiCtx);
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      if (!user) { toastState.addToast('Log in to edit.', 'warning'); return; }
      if (selCtx.selectionStart.row === -1) return;
      const row = selCtx.selectionStart.row;
      const col = selCtx.selectionStart.col;
      if (col === '' || col === 'id') return;
      startCellEdit(editingCtx, pendingCtx, uiCtx, row, col);
      return;
    }

    if (e.metaKey || e.ctrlKey) {
      const k = e.key.toLowerCase();

      if (k === 'c') {
        e.preventDefault();
        if (selCtx.selectionStart.row === -1) return;
        clipCtx.isCopying = true;
        return;
      }

      if (k === 'v') {
        e.preventDefault();
        if (!user) { toastState.addToast('Log in to edit.', 'warning'); return; }
        if (selCtx.selectionStart.row === -1) return;
        editingCtx.isPasting = true;
        return;
      }

      if (k === 'z') {
        e.preventDefault();
        if (!user) { toastState.addToast('Log in to edit.', 'warning'); return; }
        editingCtx.isUndoing = true;
        return;
      }

      if (k === 'y') {
        e.preventDefault();
        if (!user) { toastState.addToast('Log in to edit.', 'warning'); return; }
        editingCtx.isRedoing = true;
        return;
      }
    }

    // Arrow key navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      if (selCtx.hideSelection) selCtx.hideSelection = false;
      const anchor = selCtx.selectionStart;
      if (anchor.row === -1) return;

      if (e.metaKey || e.ctrlKey) {
        let targetRow = selCtx.selectionEnd.row;
        let targetCol = selCtx.selectionEnd.col;
        switch (e.key) {
          case 'ArrowUp':    targetRow = assets[0]?.id ?? targetRow; break;
          case 'ArrowDown':  targetRow = assets[assets.length - 1]?.id ?? targetRow; break;
          case 'ArrowLeft':  targetCol = keys[0]; break;
          case 'ArrowRight': targetCol = keys[keys.length - 1]; break;
        }
        if (e.shiftKey) {
          selCtx.selectionEnd = { row: targetRow, col: targetCol };
        } else {
          selectCell(selCtx, targetRow, targetCol);
        }
        const idx = assetIndex(targetRow);
        if (idx !== -1) scrollSignalCtx.scrollToRow = idx;
        scrollSignalCtx.scrollToCol = colBounds(targetCol, colWidthCtx);
        return;
      }

      if (e.shiftKey) {
        const next = getArrowTarget(e.key, selCtx.selectionEnd);
        if (next) {
          selCtx.selectionEnd = next;
          const idx = assetIndex(next.row);
          if (idx !== -1) scrollSignalCtx.scrollToRow = idx;
          scrollSignalCtx.scrollToCol = colBounds(next.col, colWidthCtx);
        }
      } else {
        const next = getArrowTarget(e.key, anchor);
        if (next) {
          selectCell(selCtx, next.row, next.col);
          const idx = assetIndex(next.row);
          if (idx !== -1) scrollSignalCtx.scrollToRow = idx;
          scrollSignalCtx.scrollToCol = colBounds(next.col, colWidthCtx);
        }
      }
    }
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Tab') { e.preventDefault(); }
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
