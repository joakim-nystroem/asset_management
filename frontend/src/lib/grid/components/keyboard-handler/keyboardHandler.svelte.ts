import { editingStore, pendingStore, selectionStore, clipboardStore } from '$lib/data/cellStore.svelte';
import { uiStore, columnWidthStore } from '$lib/data/uiStore.svelte';
import { setOpenPanel } from '$lib/utils/gridHelpers';
import { presenceStore } from '$lib/data/presenceStore.svelte';
import { assetStore } from '$lib/data/assetStore.svelte';
import { toastState } from '$lib/toast/toastState.svelte';
import { DEFAULT_WIDTH, NON_EDITABLE_COLUMNS } from '$lib/grid/gridConfig';

export function colBounds(col: string): { left: number; right: number } {
  // Column keys from first asset
  const keys = Object.keys(assetStore.displayedAssets[0] ?? {});
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
  selectionStore.isDragging = false;
  selectionStore.isCellSelected = true;
}

/** Hide the selection overlay but keep the anchor so arrow keys can resume from it. */
export function hideSelection() {
  selectionStore.pasteRange = null;
  selectionStore.isDragging = false;
  selectionStore.isCellSelected = false;
}

/** Re-show the selection overlay at the preserved anchor (no-op without an anchor). */
export function revealSelection() {
  if (!selectionStore.hasAnchor) return;
  selectionStore.isCellSelected = true;
}

export function resetSelection() {
  selectionStore.pasteRange = null;
  selectionStore.selectionStart = { row: -1, col: '' };
  selectionStore.selectionEnd = { row: -1, col: '' };
  selectionStore.isDragging = false;
  selectionStore.isCellSelected = false;
}

export function clearClipboard() {
  clipboardStore.copyStart = { row: -1, col: '' };
  clipboardStore.copyEnd = { row: -1, col: '' };
}

export function assertCellMutable(row: number, col: string): boolean {
  if (NON_EDITABLE_COLUMNS.has(col)) {
    const label = col.replaceAll('_', ' ');
    toastState.addToast(`${label.charAt(0).toUpperCase() + label.slice(1)} column cannot be edited.`, 'warning');
    return false;
  }
  const rowLock = presenceStore.rowLocks[String(row)];
  if (rowLock) {
    toastState.addToast(`Row is locked by ${rowLock.firstname} ${rowLock.lastname}`, 'warning');
    return false;
  }
  const lock = presenceStore.users.find(u => u.row === row && u.col === col && u.isLocked);
  if (lock) {
    toastState.addToast(`Cell is being edited by ${lock.firstname} ${lock.lastname}`.trim(), 'warning');
    return false;
  }
  const pending = presenceStore.pendingCells.find(p => p.assetId === row && p.key === col);
  if (pending) {
    toastState.addToast(`Cell has pending changes by ${pending.firstname} ${pending.lastname}`.trim(), 'warning');
    return false;
  }
  return true;
}

export function startCellEdit(row: number, col: string) {
  if (!assertCellMutable(row, col)) return;
  setOpenPanel();
  const asset = assetStore.displayedAssets.find((a: Record<string, any>) => a.id === row);
  const pendingEdit = pendingStore.edits.find(e => e.row === row && e.col === col);
  editingStore.editValue = pendingEdit ? pendingEdit.value : String(asset?.[col] ?? '');
  editingStore.isEditing = true;
  editingStore.editRow = row;
  editingStore.editCol = col;
}

/** Edge-jump target for Ctrl+Arrow: first/last row or first/last column. Falls back to `current` on an empty grid. */
export function getEdgeTarget(
  key: string,
  current: { row: number; col: string },
): { row: number; col: string } {
  const assets = assetStore.displayedAssets;
  // Column keys from first asset
  const keys = Object.keys(assets[0] ?? {});
  switch (key) {
    case 'ArrowUp':    return { row: assets[0]?.id ?? current.row, col: current.col };
    case 'ArrowDown':  return { row: assets[assets.length - 1]?.id ?? current.row, col: current.col };
    case 'ArrowLeft':  return { row: current.row, col: keys[0] ?? current.col };
    case 'ArrowRight': return { row: current.row, col: keys[keys.length - 1] ?? current.col };
    default:           return { row: current.row, col: current.col };
  }
}

/** Extend the selection rectangle to `target`, keeping the anchor (selectionStart). */
export function extendSelectionTo(target: { row: number; col: string }) {
  selectionStore.pasteRange = null;
  selectionStore.selectionEnd = { row: target.row, col: target.col };
}

export function getArrowTarget(
  key: string,
  current: { row: number; col: string },
): { row: number; col: string } | null {
  const assets = assetStore.displayedAssets;
  // Column keys from first asset
  const keys = Object.keys(assets[0] ?? {});
  // Find asset position by ID
  const idx = assets.findIndex((a: Record<string, any>) => a.id === current.row);
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
