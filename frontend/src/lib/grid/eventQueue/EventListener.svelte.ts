import type {
  EditingContext,
  SelectionContext,
  ClipboardContext,
  UiContext,
  ColumnWidthContext,
} from '$lib/context/gridContext.svelte';
import { presenceStore } from '$lib/data/presenceStore.svelte';
import { getScrollSignalContext, setOpenPanel, resetEditing } from '$lib/context/gridContext.svelte';
import { enqueue } from './eventQueue';
import { assetStore } from '$lib/data/assetStore.svelte';
import { toastState } from '$lib/toast/toastState.svelte';
import { DEFAULT_WIDTH } from '$lib/grid/gridConfig';

type KeyboardContexts = {
  editingCtx: EditingContext;
  selCtx: SelectionContext;
  clipCtx: ClipboardContext;
  uiCtx: UiContext;
  colWidthCtx: ColumnWidthContext;
};

export function createKeyboardHandler(ctxs: KeyboardContexts) {
  const { editingCtx, selCtx, clipCtx, uiCtx, colWidthCtx } = ctxs;
  const scrollSignalCtx = getScrollSignalContext();

  function getAssets() {
    return assetStore.filteredAssets;
  }

  function getKeys() {
    return Object.keys(getAssets()[0] ?? {});
  }

  function getWidth(key: string): number {
    return colWidthCtx.widths.get(key) ?? DEFAULT_WIDTH;
  }

  function assetIndex(id: number): number {
    return getAssets().findIndex((a: Record<string, any>) => a.id === id);
  }

  function colBounds(col: string): { left: number; right: number } {
    const keys = getKeys();
    const colIdx = keys.indexOf(col);
    if (colIdx === -1) return { left: 0, right: 0 };
    let left = 0;
    for (let c = 0; c < colIdx; c++) left += getWidth(keys[c]);
    return { left, right: left + getWidth(col) };
  }

  function selectCell(row: number, col: string) {
    selCtx.pasteRange = null;
    selCtx.selectionStart = { row, col };
    selCtx.selectionEnd = { row, col };
    selCtx.isSelecting = false;
    selCtx.hideSelection = false;
  }

  function resetSelection() {
    selCtx.pasteRange = null;
    selCtx.selectionStart = { row: -1, col: '' };
    selCtx.selectionEnd = { row: -1, col: '' };
    selCtx.isSelecting = false;
    selCtx.hideSelection = false;
  }

  function clearClipboard() {
    clipCtx.copyStart = { row: -1, col: '' };
    clipCtx.copyEnd = { row: -1, col: '' };
  }


  function startCellEdit(row: number, col: string) {
    const lock = presenceStore.users.find(u => u.row === row && u.col === col && u.isLocked);
    if (lock) {
      toastState.addToast(`Cell is being edited by ${lock.firstname} ${lock.lastname}`.trim(), 'warning');
      return;
    }
    const pending = presenceStore.pendingCells.find(p => p.assetId === row && p.key === col);
    if (pending) {
      toastState.addToast(`Cell has pending changes by ${pending.firstname} ${pending.lastname}`.trim(), 'warning');
      return;
    }
    editingCtx.isEditing = true;
    editingCtx.editRow = row;
    editingCtx.editCol = col;
  }

  function getArrowTarget(
    key: string,
    current: { row: number; col: string },
  ): { row: number; col: string } | null {
    const assets = getAssets();
    const keys = getKeys();
    const idx = assetIndex(current.row);
    if (idx === -1) return null;
    const colIdx = keys.indexOf(current.col);
    if (colIdx === -1) return null;
    switch (key) {
      case 'ArrowUp':    return idx > 0 ? { row: assets[idx - 1].id, col: current.col } : null;
      case 'ArrowDown':  return idx < assets.length - 1 ? { row: assets[idx + 1].id, col: current.col } : null;
      case 'ArrowLeft':  return colIdx > 0 ? { row: current.row, col: keys[colIdx - 1] } : null;
      case 'ArrowRight': return colIdx < keys.length - 1 ? { row: current.row, col: keys[colIdx + 1] } : null;
      default:           return null;
    }
  }

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
        resetSelection();
      }
      clearClipboard();
      setOpenPanel(uiCtx);
      return;
    }

    if (e.key === 'F2') {
      e.preventDefault();
      if (selCtx.selectionStart.row === -1) return;
      const row = selCtx.selectionStart.row;
      const col = selCtx.selectionStart.col;
      if (col === '' || col === 'id') return;
      startCellEdit(row, col);
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
        if (selCtx.selectionStart.row === -1) return;
        editingCtx.isPasting = true;
        return;
      }

      if (k === 'z') {
        e.preventDefault();
        editingCtx.isUndoing = true;
        return;
      }

      if (k === 'y') {
        e.preventDefault();
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
          selectCell(targetRow, targetCol);
        }
        const idx = assetIndex(targetRow);
        if (idx !== -1) scrollSignalCtx.scrollToRow = idx;
        scrollSignalCtx.scrollToCol = colBounds(targetCol);
        return;
      }

      if (e.shiftKey) {
        const next = getArrowTarget(e.key, selCtx.selectionEnd);
        if (next) {
          selCtx.selectionEnd = next;
          const idx = assetIndex(next.row);
          if (idx !== -1) scrollSignalCtx.scrollToRow = idx;
          scrollSignalCtx.scrollToCol = colBounds(next.col);
        }
      } else {
        const next = getArrowTarget(e.key, anchor);
        if (next) {
          selectCell(next.row, next.col);
          const idx = assetIndex(next.row);
          if (idx !== -1) scrollSignalCtx.scrollToRow = idx;
          scrollSignalCtx.scrollToCol = colBounds(next.col);
        }
      }
    }
  }

  return handleKeyDown;
}
