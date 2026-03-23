import { queryStore } from '$lib/data/queryStore.svelte';
import { setOpenPanel } from '$lib/utils/gridHelpers';
import { pendingStore } from '$lib/data/cellStore.svelte';
import { newRowStore } from '$lib/data/newRowStore.svelte';
import { enqueue } from '$lib/grid/eventQueue/eventQueue';
import { resetEditState } from '$lib/utils/gridHelpers';

export function clearAllFilters() {
  if (pendingStore.edits.length > 0 || newRowStore.hasNewRows) {
    enqueue(
      { type: 'DISCARD', payload: {} },
    );
    resetEditState();
  }
  queryStore.filters = [];
  setOpenPanel();
  enqueue(
    { type: 'QUERY', payload: { view: queryStore.view, q: queryStore.q, filters: [] } },
  );
}

export function removeFilter(index: number) {
  if (pendingStore.edits.length > 0 || newRowStore.hasNewRows) {
    enqueue(
      { type: 'DISCARD', payload: {} },
    );
    resetEditState();
  }
  queryStore.filters.splice(index, 1);
  enqueue(
    { type: 'QUERY', payload: { view: queryStore.view, q: queryStore.q, filters: $state.snapshot(queryStore.filters) } },
  );
}
