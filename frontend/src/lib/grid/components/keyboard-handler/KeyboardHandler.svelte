<script lang="ts">
  import { page } from '$app/state';
  import { editingStore, pendingStore, selectionStore } from '$lib/data/cellStore.svelte';
  import { scrollStore } from '$lib/data/scrollStore.svelte';
  import { resetEditing, setOpenPanel } from '$lib/utils/gridHelpers';
  import { realtime } from '$lib/utils/realtimeManager.svelte';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import {
    startCellEdit,
    getArrowTarget,
    selectCell,
    resetSelection,
    clearClipboard,
    colBounds,
  } from './keyboardHandler.svelte.ts';
  import { enqueue } from '$lib/eventQueue/eventQueue';
  import { toastState } from '$lib/toast/toastState.svelte';
  import { uiStore } from '$lib/data/uiStore.svelte.ts';

  let { children } = $props();

  const user = $derived(page.data.user);

  // ─── CLIENT_STATE provider for reconnect ─────────────────────────────────
  realtime.setLocalStateProvider(() => {
    const position = selectionStore.selectionStart.row !== -1
      ? { row: selectionStore.selectionStart.row, col: selectionStore.selectionStart.col }
      : null;
    const lock = editingStore.isEditing && editingStore.editRow !== -1
      ? { assetId: editingStore.editRow, key: editingStore.editCol }
      : null;
    const pending = pendingStore.edits.map(e => ({
      assetId: e.row,
      key: e.col,
      value: e.value,
    }));
    return { position, lock, pending };
  });

  // ─── WS BRIDGE: outbound selection → position update ───────────────────────
  $effect(() => {
    const row = selectionStore.selectionStart.row;
    const col = selectionStore.selectionStart.col;

    if (row === -1 || col === '') {
      enqueue({ type: 'POSITION_DESELECT', payload: {} });
      return;
    }
    enqueue({ type: 'POSITION_UPDATE', payload: { assetId: row, key: col } });
  });

  // ─── WS BRIDGE: outbound edit lock ────────────────────────────────────────
  $effect(() => {
    if (editingStore.isEditing && editingStore.editRow !== -1 && editingStore.editCol !== '') {
      enqueue({ type: 'CELL_EDIT_START', payload: { assetId: editingStore.editRow, key: editingStore.editCol } });
    }
  });

  // ─── Keyboard handler ──────────────────────────────────────────────────────
  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    if (isInput) return;

    // Column keys from first asset
    const assets = assetStore.displayedAssets;
    const keys = Object.keys(assets[0] ?? {});

    if (e.key === 'Escape') {
      if (editingStore.isEditing) {
        resetEditing();
        enqueue({ type: 'CELL_EDIT_END', payload: {} });
        return;
      }
      if (selectionStore.selectionStart.row !== -1) {
        resetSelection();
      }
      clearClipboard();
      setOpenPanel();
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      if (!user) { toastState.addToast('Log in to edit.', 'warning'); return; }
      // No UI panel open
      if(uiStore.contextMenu.visible || uiStore.filterPanel.visible || uiStore.headerMenu.visible || uiStore.suggestionMenu.visible) return;
      // No selection or invalid column
      if (selectionStore.selectionStart.row === -1) return;
      const row = selectionStore.selectionStart.row;
      const col = selectionStore.selectionStart.col;
      if (col === '' || col === 'id') return;
      startCellEdit(row, col);
      return;
    }

    if (e.metaKey || e.ctrlKey) {
      const k = e.key.toLowerCase();

      if (k === 'z') {
        e.preventDefault();
        if (!user) { toastState.addToast('Log in to edit.', 'warning'); return; }
        editingStore.isUndoing = true;
        return;
      }

      if (k === 'y') {
        e.preventDefault();
        if (!user) { toastState.addToast('Log in to edit.', 'warning'); return; }
        editingStore.isRedoing = true;
        return;
      }
    }

    // Arrow key navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      if (selectionStore.hideSelection) selectionStore.hideSelection = false;
      setOpenPanel();
      const anchor = selectionStore.selectionStart;
      if (anchor.row === -1) return;

      if (e.metaKey || e.ctrlKey) {
        let targetRow = selectionStore.selectionStart.row;
        let targetCol = selectionStore.selectionStart.col;
        switch (e.key) {
          case 'ArrowUp':    targetRow = assets[0]?.id ?? targetRow; break;
          case 'ArrowDown':  targetRow = assets[assets.length - 1]?.id ?? targetRow; break;
          case 'ArrowLeft':  targetCol = keys[0]; break;
          case 'ArrowRight': targetCol = keys[keys.length - 1]; break;
        }
        if (e.shiftKey) {
          selectionStore.pasteRange = null;
          selectionStore.selectionEnd = { row: targetRow, col: targetCol };
        } else {
          selectCell(targetRow, targetCol);
        }
        // Find asset position by ID
        const idx = assets.findIndex((a: Record<string, any>) => a.id === targetRow);
        if (idx !== -1) scrollStore.scrollToRow = idx;
        scrollStore.scrollToCol = colBounds(targetCol);
        return;
      }

      if (e.shiftKey) {
        const next = getArrowTarget(e.key, selectionStore.selectionEnd);
        if (next) {
          selectionStore.pasteRange = null;
          selectionStore.selectionEnd = next;
          // Find asset position by ID
          const idx = assets.findIndex((a: Record<string, any>) => a.id === next.row);
          if (idx !== -1) scrollStore.scrollToRow = idx;
          scrollStore.scrollToCol = colBounds(next.col);
        }
      } else {
        const next = getArrowTarget(e.key, anchor);
        if (next) {
          selectCell(next.row, next.col);
          // Find asset position by ID
          const idx = assets.findIndex((a: Record<string, any>) => a.id === next.row);
          if (idx !== -1) scrollStore.scrollToRow = idx;
          scrollStore.scrollToCol = colBounds(next.col);
        }
      }
    }
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Tab') { e.preventDefault(); }
    if (scrollStore.isAutoScrolling) {
      scrollStore.isAutoScrolling = false;
      return;
    }
    handleKeyDown(e);
  }}
  onmouseup={() => { selectionStore.isSelecting = false; }}
  onclick={(e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-panel]')) return;
    setOpenPanel();
  }}
/>

{@render children?.()}
