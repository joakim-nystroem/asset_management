import { editingStore, pendingStore, selectionStore, clipboardStore } from '$lib/data/cellStore.svelte';
import { uiStore, columnWidthStore, setOpenPanel } from '$lib/data/uiStore.svelte';
import { presenceStore } from '$lib/data/presenceStore.svelte';
import { assetStore } from '$lib/data/assetStore.svelte';
import { toastState } from '$lib/toast/toastState.svelte';
import { DEFAULT_WIDTH } from '$lib/grid/gridConfig';

export function getAssets() {
  return assetStore.displayedAssets;
}

export function getKeys() {
  return Object.keys(getAssets()[0] ?? {});
}

export function assetIndex(id: number): number {
  return getAssets().findIndex((a: Record<string, any>) => a.id === id);
}

export function colBounds(col: string): { left: number; right: number } {
  const keys = getKeys();
  const colIdx = keys.indexOf(col);
  if (colIdx === -1) return { left: 0, right: 0 };
  let left = 0;
  for (let c = 0; c < colIdx; c++) left += columnWidthStore.widths.get(keys[c]) ?? DEFAULT_WIDTH;
  return { left, right: left + (columnWidthStore.widths.get(col) ?? DEFAULT_WIDTH) };
}

export function selectCell(row: number, col: string) {
  selectionStore.pasteRange = null;
  selectionStore.selectionStart = { row, col };
  selectionStore.selectionEnd = { row, col };
  selectionStore.isSelecting = false;
  selectionStore.hideSelection = false;
}

export function resetSelection() {
  selectionStore.pasteRange = null;
  selectionStore.selectionStart = { row: -1, col: '' };
  selectionStore.selectionEnd = { row: -1, col: '' };
  selectionStore.isSelecting = false;
  selectionStore.hideSelection = false;
}

export function clearClipboard() {
  clipboardStore.copyStart = { row: -1, col: '' };
  clipboardStore.copyEnd = { row: -1, col: '' };
}

export function startCellEdit(row: number, col: string) {
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
  setOpenPanel();
  const asset = getAssets().find((a: Record<string, any>) => a.id === row);
  const pendingEdit = pendingStore.edits.find(e => e.row === row && e.col === col);
  editingStore.editValue = pendingEdit ? pendingEdit.value : String(asset?.[col] ?? '');
  editingStore.isEditing = true;
  editingStore.editRow = row;
  editingStore.editCol = col;
}

export function getArrowTarget(
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
