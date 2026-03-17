import { queryStore } from '$lib/data/queryStore.svelte';
import { type UiContext, setOpenPanel } from '$lib/context/gridContext.svelte';

export function clearAllFilters(uiCtx: UiContext) {
  queryStore.filters = [];
  setOpenPanel(uiCtx);
}

export function removeFilter(index: number) {
  queryStore.filters.splice(index, 1);
}
