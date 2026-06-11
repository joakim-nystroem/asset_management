import { editingStore, pendingStore } from '$lib/data/cellStore.svelte';
import { scrollStore } from '$lib/data/scrollStore.svelte';
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
): ArrowTarget {
  const assets = assetStore.displayedAssets;
  // Column keys from first asset
  const keys = Object.keys(assets[0] ?? {});
  const currentRowIdx = () => assets.findIndex((asset: Record<string, any>) => asset.id === current.row);
  switch (key) {
    case 'ArrowUp':    return { row: assets[0]?.id ?? current.row, col: current.col, rowIdx: assets.length > 0 ? 0 : -1 };
    case 'ArrowDown':  return { row: assets[assets.length - 1]?.id ?? current.row, col: current.col, rowIdx: assets.length - 1 };
    case 'ArrowLeft':  return { row: current.row, col: keys[0] ?? current.col, rowIdx: currentRowIdx() };
    case 'ArrowRight': return { row: current.row, col: keys[keys.length - 1] ?? current.col, rowIdx: currentRowIdx() };
    default:           return { row: current.row, col: current.col, rowIdx: currentRowIdx() };
  }
}

/** A navigation target: cell coordinates plus its position in displayedAssets. */
export type ArrowTarget = { row: number; col: string; rowIdx: number };

/** Signal the virtual grid to bring the target cell into view.
 * Uses the precomputed rowIdx when given, otherwise scans by id. */
export function scrollToCell(target: { row: number; col: string; rowIdx?: number }) {
  const rowIdx = target.rowIdx ?? assetStore.displayedAssets.findIndex((asset: Record<string, any>) => asset.id === target.row);
  if (rowIdx !== -1) scrollStore.scrollToRow = rowIdx;
  scrollStore.scrollToCol = colBounds(target.col);
}

/** Map Enter/Tab (+Shift) to the equivalent arrow direction; null for other keys. */
export function navKeyToArrow(key: string, shiftKey: boolean): string | null {
  if (key === 'Enter') return shiftKey ? 'ArrowUp' : 'ArrowDown';
  if (key === 'Tab') return shiftKey ? 'ArrowLeft' : 'ArrowRight';
  return null;
}

export function getArrowTarget(
  key: string,
  current: { row: number; col: string },
): ArrowTarget | null {
  const assets = assetStore.displayedAssets;
  // Column keys from first asset
  const keys = Object.keys(assets[0] ?? {});
  // Find asset position by ID
  const idx = assets.findIndex((asset: Record<string, any>) => asset.id === current.row);
  if (idx === -1) return null;
  const colIdx = keys.indexOf(current.col);
  if (colIdx === -1) return null;
  switch (key) {
    case 'ArrowUp':    return idx > 0 ? { row: assets[idx - 1].id, col: current.col, rowIdx: idx - 1 } : null;
    case 'ArrowDown':  return idx < assets.length - 1 ? { row: assets[idx + 1].id, col: current.col, rowIdx: idx + 1 } : null;
    case 'ArrowLeft':  return colIdx > 0 ? { row: current.row, col: keys[colIdx - 1], rowIdx: idx } : null;
    case 'ArrowRight': return colIdx < keys.length - 1 ? { row: current.row, col: keys[colIdx + 1], rowIdx: idx } : null;
    default:           return null;
  }
}
