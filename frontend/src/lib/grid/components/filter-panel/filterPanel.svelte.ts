import { queryStore } from '$lib/data/queryStore.svelte';
import { type UiContext, type PendingContext, type NewRowContext, type SelectionContext, type ClipboardContext, type HistoryContext, setOpenPanel } from '$lib/context/gridContext.svelte';
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

export function clearAllFilters(
  uiCtx: UiContext,
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
  queryStore.filters = [];
  setOpenPanel(uiCtx);
  enqueue(
    { type: 'QUERY', payload: { view: queryStore.view, q: queryStore.q, filters: [] } },
    {},
  );
}

export function removeFilter(
  index: number,
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
  queryStore.filters.splice(index, 1);
  enqueue(
    { type: 'QUERY', payload: { view: queryStore.view, q: queryStore.q, filters: $state.snapshot(queryStore.filters) } },
    {},
  );
}
