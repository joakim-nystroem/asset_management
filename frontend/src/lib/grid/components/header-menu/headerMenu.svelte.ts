import { queryStore } from '$lib/data/queryStore.svelte';
import { pendingStore } from '$lib/data/cellStore.svelte';
import { newRowStore } from '$lib/data/newRowStore.svelte';
import { enqueue } from '$lib/eventQueue/eventQueue';
import { resetEditState } from '$lib/utils/gridHelpers';
import type { DateOp } from '$lib/grid/dateFilter';

export function toggleFilter(key: string, value: string) {
  if (pendingStore.edits.length > 0 || newRowStore.newRows.length > 0) {
    enqueue(
      { type: 'DISCARD', payload: {} },
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
  );
}

export function setDateFilter(key: string, op: DateOp, iso: string) {
  if (!iso) return;
  if (pendingStore.edits.length > 0 || newRowStore.newRows.length > 0) {
    enqueue({ type: 'DISCARD', payload: {} });
    resetEditState();
  }
  const next = `${op}${iso}`;
  const existing = queryStore.filters.findIndex(f => f.key === key);
  if (existing >= 0) {
    queryStore.filters[existing] = { key, value: next };
  } else {
    queryStore.filters.push({ key, value: next });
  }
  enqueue(
    { type: 'QUERY', payload: { view: queryStore.view, q: queryStore.q, filters: $state.snapshot(queryStore.filters) } },
  );
}

export function clearDateFilter(key: string) {
  if (pendingStore.edits.length > 0 || newRowStore.newRows.length > 0) {
    enqueue({ type: 'DISCARD', payload: {} });
    resetEditState();
  }
  const idx = queryStore.filters.findIndex(f => f.key === key);
  if (idx < 0) return;
  queryStore.filters.splice(idx, 1);
  enqueue(
    { type: 'QUERY', payload: { view: queryStore.view, q: queryStore.q, filters: $state.snapshot(queryStore.filters) } },
  );
}
