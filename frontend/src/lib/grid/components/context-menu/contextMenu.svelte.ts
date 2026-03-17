import { queryStore } from '$lib/data/queryStore.svelte';
import { getUiContext } from '$lib/context/gridContext.svelte';

export function handleFilterByValue(key: string, value: string) {
  const alreadyExists = queryStore.filters.some(f => f.key === key && f.value === value);
  if (!alreadyExists) {
    queryStore.filters.push({ key, value });
  }
  const uiCtx = getUiContext();
  uiCtx.contextMenu.visible = false;
}
