import { assetStore } from '$lib/data/assetStore.svelte';
import { newRowStore } from '$lib/data/newRowStore.svelte';
import { clipboardStore, selectionStore, pendingStore, historyStore, type HistoryAction } from '$lib/data/cellStore.svelte';
import { validateCell } from '$lib/grid/validation';
import { enqueue } from '$lib/eventQueue/eventQueue';
import { toastState } from '$lib/toast/toastState.svelte';
import { NON_EDITABLE_COLUMNS } from '$lib/grid/gridConfig';

/** Resolve visible value for a cell — pending edit if any, else asset value. */
function cellValue(assetId: number, colKey: string): string {
  const pending = pendingStore.edits.find((e) => e.row === assetId && e.col === colKey);
  if (pending) return pending.value;
  const asset = assetStore.displayedAssets.find((a: Record<string, any>) => a.id === assetId);
  return asset ? String(asset[colKey] ?? '') : '';
}

/**
 * Copy current selection to system clipboard as TSV.
 * If `e` provided (native copy event), writes via `clipboardData` and prevents default.
 * Otherwise writes via `navigator.clipboard.writeText` (e.g., context-menu invocation).
 */
export function doCopy(e?: ClipboardEvent): void {
  if (selectionStore.selectionStart.row === -1) return;

  const assets = assetStore.displayedAssets;
  const keys = Object.keys(assets[0] ?? {});

  const startIdx = assets.findIndex((a: Record<string, any>) => a.id === selectionStore.selectionStart.row);
  const endIdx = assets.findIndex((a: Record<string, any>) => a.id === selectionStore.selectionEnd.row);
  const startColIdx = keys.indexOf(selectionStore.selectionStart.col);
  const endColIdx = keys.indexOf(selectionStore.selectionEnd.col);
  if (startIdx === -1 || endIdx === -1 || startColIdx === -1 || endColIdx === -1) return;

  const minRow = Math.min(startIdx, endIdx);
  const maxRow = Math.max(startIdx, endIdx);
  const minCol = Math.min(startColIdx, endColIdx);
  const maxCol = Math.max(startColIdx, endColIdx);
  const colKeys = keys.slice(minCol, maxCol + 1);

  const grid: string[][] = [];
  for (let r = minRow; r <= maxRow; r++) {
    const asset = assets[r];
    grid.push(colKeys.map((key) => cellValue(asset.id, key)));
  }

  selectionStore.pasteRange = null;
  clipboardStore.copyStart = { ...selectionStore.selectionStart };
  clipboardStore.copyEnd = { ...selectionStore.selectionEnd };
  selectionStore.hideSelection = true;

  const text = grid.map((row) => row.join('\t')).join('\n');
  if (e) {
    e.preventDefault();
    e.clipboardData?.setData('text/plain', text);
  } else {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

/**
 * Paste TSV text into current selection, tiling to fit when selection is a multiple
 * of clipboard dimensions. Source: native paste event clipboardData, or
 * `navigator.clipboard.readText()` for context-menu invocation.
 */
export function doPaste(text: string): void {
  if (!text) return;
  if (selectionStore.selectionStart.row === -1) return;
  if (newRowStore.newRows.length > 0 && selectionStore.selectionStart.row > 0) {
    toastState.addToast('Commit or discard new rows before editing.', 'warning');
    return;
  }

  const grid: string[][] = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.split('\t'));
  // Strip trailing empty line (Excel/Sheets often append \n)
  if (grid.length > 1 && grid[grid.length - 1].length === 1 && grid[grid.length - 1][0] === '') {
    grid.pop();
  }
  if (grid.length === 0 || grid[0].length === 0) return;

  const assets = assetStore.displayedAssets;
  const keys = Object.keys(assets[0] ?? {});

  const clipHeight = grid.length;
  const clipWidth = grid[0].length;

  const startRow = assets.findIndex((a: Record<string, any>) => a.id === selectionStore.selectionStart.row);
  const endRow = assets.findIndex((a: Record<string, any>) => a.id === selectionStore.selectionEnd.row);
  const startCol = keys.indexOf(selectionStore.selectionStart.col);
  const endCol = keys.indexOf(selectionStore.selectionEnd.col);
  if (startRow === -1 || endRow === -1 || startCol === -1 || endCol === -1) return;
  const minStartRow = Math.min(startRow, endRow);
  const minStartCol = Math.min(startCol, endCol);
  const selHeight = Math.abs(endRow - startRow) + 1;
  const selWidth = Math.abs(endCol - startCol) + 1;

  const canTile = selHeight % clipHeight === 0 && selWidth % clipWidth === 0;
  const maxRow = Math.min(canTile ? selHeight : clipHeight, assets.length - minStartRow);
  const maxCol = Math.min(canTile ? selWidth : clipWidth, keys.length - minStartCol);

  const pastedKeys = new Set<string>();
  const newEdits: typeof pendingStore.edits = [];
  const historyBatch: HistoryAction[] = [];

  for (let r = 0; r < maxRow; r++) {
    const asset = assets[minStartRow + r];
    const clipRow = grid[r % clipHeight];

    for (let c = 0; c < maxCol; c++) {
      const key = keys[minStartCol + c];
      if (NON_EDITABLE_COLUMNS.has(key)) continue;

      const newValue = clipRow[c % clipWidth];
      const oldValue = cellValue(asset.id, key);
      const original = String(asset[key] ?? '');
      pastedKeys.add(`${asset.id}:${key}`);

      if (newValue !== original) {
        const { isValid, error } = validateCell(asset.id, key, newValue, pendingStore.edits);
        newEdits.push({ row: asset.id, col: key, original, value: newValue, isValid, validationError: error });
        enqueue({ type: 'CELL_PENDING', payload: { assetId: asset.id, key, value: newValue } });
      } else {
        enqueue({ type: 'CELL_PENDING_CLEAR', payload: { assetId: asset.id, key } });
      }

      if (oldValue !== newValue) {
        historyBatch.push({ id: asset.id, key, oldValue, newValue });
      }
    }
  }

  pendingStore.edits = [
    ...pendingStore.edits.filter((e) => !pastedKeys.has(`${e.row}:${e.col}`)),
    ...newEdits,
  ];

  if (historyBatch.length > 0) {
    historyStore.undoStack = [...historyStore.undoStack, historyBatch];
    historyStore.redoStack = [];
  }

  const pasteStartId = assets[minStartRow].id;
  const pasteEndId = assets[minStartRow + maxRow - 1].id;
  const pasteStartCol = keys[minStartCol];
  const pasteEndCol = keys[minStartCol + maxCol - 1];
  selectionStore.selectionStart = { row: pasteStartId, col: pasteStartCol };
  selectionStore.selectionEnd = { row: pasteEndId, col: pasteEndCol };
  selectionStore.hideSelection = true;
  selectionStore.pasteRange = { start: { row: pasteStartId, col: pasteStartCol }, end: { row: pasteEndId, col: pasteEndCol } };
}
