import { queryStore } from '$lib/data/queryStore.svelte';
import { pendingStore } from '$lib/data/cellStore.svelte';
import { newRowStore } from '$lib/data/newRowStore.svelte';
import { enqueue } from '$lib/eventQueue/eventQueue';
import { resetEditState } from '$lib/utils/gridHelpers';

export function handleFilterByValue(
  key: string,
  value: string,
) {
  if (pendingStore.edits.length > 0 || newRowStore.newRows.length > 0) {
    enqueue(
      { type: 'DISCARD', payload: {} },
    );
    resetEditState();
  }
  const alreadyExists = queryStore.filters.some(f => f.key === key && f.value === value);
  if (!alreadyExists) {
    queryStore.filters.push({ key, value });
  }
  enqueue(
    { type: 'QUERY', payload: { view: queryStore.view, q: queryStore.q, filters: $state.snapshot(queryStore.filters) } },
  );
}
