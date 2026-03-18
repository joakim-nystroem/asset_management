import { queryStore } from '$lib/data/queryStore.svelte';
import { type PendingContext, type NewRowContext, type SelectionContext, type ClipboardContext, type HistoryContext } from '$lib/context/gridContext.svelte';
import { enqueue } from '$lib/grid/eventQueue/eventQueue';

function resetEditState(
  selCtx: SelectionContext,
  clipCtx: ClipboardContext,
  historyCtx: HistoryContext,
) {
  historyCtx.undoStack = [];
  historyCtx.redoStack = [];
  selCtx.pasteRange = null;
  selCtx.selectionStart = { row: -1, col: '' };
  selCtx.selectionEnd = { row: -1, col: '' };
  selCtx.hideSelection = false;
  clipCtx.copyStart = { row: -1, col: '' };
  clipCtx.copyEnd = { row: -1, col: '' };
}

export function toggleFilter(
  key: string,
  value: string,
  pendingCtx: PendingContext,
  newRowCtx: NewRowContext,
  selCtx: SelectionContext,
  clipCtx: ClipboardContext,
  historyCtx: HistoryContext,
) {
  if (pendingCtx.edits.length > 0 || newRowCtx.hasNewRows) {
    enqueue(
      { type: 'DISCARD', payload: {} },
      { pendingCtx, newRowCtx },
    );
    resetEditState(selCtx, clipCtx, historyCtx);
  }
  const idx = queryStore.filters.findIndex(f => f.key === key && f.value === value);
  if (idx >= 0) {
    queryStore.filters.splice(idx, 1);
  } else {
    queryStore.filters.push({ key, value });
  }
}
