import { queryStore } from '$lib/data/queryStore.svelte';
import { setOpenPanel } from '$lib/data/uiStore.svelte';
import { pendingStore, selectionStore, clipboardStore, historyStore } from '$lib/data/cellStore.svelte';
import { newRowStore } from '$lib/data/newRowStore.svelte';
import { enqueue } from '$lib/grid/eventQueue/eventQueue';

function resetEditState() {
  historyStore.undoStack = [];
  historyStore.redoStack = [];
  selectionStore.pasteRange = null;
  selectionStore.selectionStart = { row: -1, col: '' };
  selectionStore.selectionEnd = { row: -1, col: '' };
  selectionStore.hideSelection = false;
  clipboardStore.copyStart = { row: -1, col: '' };
  clipboardStore.copyEnd = { row: -1, col: '' };
}

export function clearAllFilters() {
  if (pendingStore.edits.length > 0 || newRowStore.hasNewRows) {
    enqueue(
      { type: 'DISCARD', payload: {} },
      { pendingCtx: pendingStore, newRowCtx: newRowStore },
    );
    resetEditState();
  }
  queryStore.filters = [];
  setOpenPanel();
  enqueue(
    { type: 'QUERY', payload: { view: queryStore.view, q: queryStore.q, filters: [] } },
    {},
  );
}

export function removeFilter(index: number) {
  if (pendingStore.edits.length > 0 || newRowStore.hasNewRows) {
    enqueue(
      { type: 'DISCARD', payload: {} },
      { pendingCtx: pendingStore, newRowCtx: newRowStore },
    );
    resetEditState();
  }
  queryStore.filters.splice(index, 1);
  enqueue(
    { type: 'QUERY', payload: { view: queryStore.view, q: queryStore.q, filters: $state.snapshot(queryStore.filters) } },
    {},
  );
}
