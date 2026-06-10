<script lang="ts">
  import { page } from '$app/state';
  import { editingStore, pendingStore, selectionStore } from '$lib/data/cellStore.svelte';
  import { scrollStore } from '$lib/data/scrollStore.svelte';
  import { resetEditing, setOpenPanel } from '$lib/utils/gridHelpers';
  import { realtime } from '$lib/utils/realtimeManager.svelte';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import {
    startCellEdit,
    assertCellMutable,
    getArrowTarget,
    getEdgeTarget,
    extendSelectionTo,
    selectCell,
    hideSelection,
    revealSelection,
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
    const position = selectionStore.hasAnchor
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

    if (!selectionStore.hasAnchor || col === '') {
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
      if (selectionStore.isCellSelected) {
        hideSelection();
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
      if (!selectionStore.isCellSelected) return;
      const row = selectionStore.selectionStart.row;
      const col = selectionStore.selectionStart.col;
      if (col === '' || col === 'id') return;
      startCellEdit(row, col);
      return;
    }

    if (e.key === 'Delete') {
      e.preventDefault();
      if (!user) { toastState.addToast('Log in to edit.', 'warning'); return; }
      if (uiStore.contextMenu.visible || uiStore.filterPanel.visible || uiStore.headerMenu.visible || uiStore.suggestionMenu.visible) return;
      if (!selectionStore.isCellSelected) return;

      const startIdx = assets.findIndex((a: Record<string, any>) => a.id === selectionStore.selectionStart.row);
      const endIdx = assets.findIndex((a: Record<string, any>) => a.id === selectionStore.selectionEnd.row);
      const startColIdx = keys.indexOf(selectionStore.selectionStart.col);
      const endColIdx = keys.indexOf(selectionStore.selectionEnd.col);
      if (startIdx === -1 || endIdx === -1 || startColIdx === -1 || endColIdx === -1) return;
      const minRow = Math.min(startIdx, endIdx);
      const maxRow = Math.max(startIdx, endIdx);
      const minCol = Math.min(startColIdx, endColIdx);
      const maxCol = Math.max(startColIdx, endColIdx);

      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          if (!assertCellMutable(assets[r].id, keys[c])) return;
        }
      }

      editingStore.isDeleting = true;
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
      setOpenPanel();
      const anchor = selectionStore.selectionStart;
      if (!selectionStore.hasAnchor) return;
      revealSelection();

      if (e.metaKey || e.ctrlKey) {
        // Shift extends from the selection end so the perpendicular span is preserved
        const base = e.shiftKey ? selectionStore.selectionEnd : selectionStore.selectionStart;
        const target = getEdgeTarget(e.key, base);
        if (e.shiftKey) {
          extendSelectionTo(target);
        } else {
          selectCell(target.row, target.col);
        }
        // Find asset position by ID
        const idx = assets.findIndex((a: Record<string, any>) => a.id === target.row);
        if (idx !== -1) scrollStore.scrollToRow = idx;
        scrollStore.scrollToCol = colBounds(target.col);
        return;
      }

      if (e.shiftKey) {
        const next = getArrowTarget(e.key, selectionStore.selectionEnd);
        if (next) {
          extendSelectionTo(next);
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
  onmouseup={() => { selectionStore.isDragging = false; }}
  onclick={(e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-panel]')) return;
    setOpenPanel();
  }}
/>

{@render children?.()}
