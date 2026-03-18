import type {
  EditingContext,
  PendingContext,
  SelectionContext,
  ClipboardContext,
  UiContext,
  ColumnWidthContext,
} from '$lib/context/gridContext.svelte';
import { presenceStore } from '$lib/data/presenceStore.svelte';
import { setOpenPanel } from '$lib/context/gridContext.svelte';
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

export function colBounds(col: string, colWidthCtx: ColumnWidthContext): { left: number; right: number } {
  const keys = getKeys();
  const colIdx = keys.indexOf(col);
  if (colIdx === -1) return { left: 0, right: 0 };
  let left = 0;
  for (let c = 0; c < colIdx; c++) left += colWidthCtx.widths.get(keys[c]) ?? DEFAULT_WIDTH;
  return { left, right: left + (colWidthCtx.widths.get(col) ?? DEFAULT_WIDTH) };
}

export function selectCell(selCtx: SelectionContext, row: number, col: string) {
  selCtx.pasteRange = null;
  selCtx.selectionStart = { row, col };
  selCtx.selectionEnd = { row, col };
  selCtx.isSelecting = false;
  selCtx.hideSelection = false;
}

export function resetSelection(selCtx: SelectionContext) {
  selCtx.pasteRange = null;
  selCtx.selectionStart = { row: -1, col: '' };
  selCtx.selectionEnd = { row: -1, col: '' };
  selCtx.isSelecting = false;
  selCtx.hideSelection = false;
}

export function clearClipboard(clipCtx: ClipboardContext) {
  clipCtx.copyStart = { row: -1, col: '' };
  clipCtx.copyEnd = { row: -1, col: '' };
}

export function startCellEdit(
  editingCtx: EditingContext,
  pendingCtx: PendingContext,
  uiCtx: UiContext,
  row: number,
  col: string,
) {
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
  setOpenPanel(uiCtx);
  const asset = getAssets().find((a: Record<string, any>) => a.id === row);
  const pendingEdit = pendingCtx.edits.find(e => e.row === row && e.col === col);
  editingCtx.editValue = pendingEdit ? pendingEdit.value : String(asset?.[col] ?? '');
  editingCtx.isEditing = true;
  editingCtx.editRow = row;
  editingCtx.editCol = col;
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
