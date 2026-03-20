import { queryStore } from '$lib/data/queryStore.svelte';
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

export function toggleFilter(key: string, value: string) {
  if (pendingStore.edits.length > 0 || newRowStore.hasNewRows) {
    enqueue(
      { type: 'DISCARD', payload: {} },
      { pendingCtx: pendingStore, newRowCtx: newRowStore },
    );
    resetEditState();
  }
  const idx = queryStore.filters.findIndex(f => f.key === key && f.value === value);
  if (idx >= 0) {
    queryStore.filters.splice(idx, 1);
  } else {
    queryStore.filters.push({ key, value });
  }
  enqueue(
    { type: 'QUERY', payload: { view: queryStore.view, q: queryStore.q, filters: $state.snapshot(queryStore.filters) } },
    {},
  );
}
