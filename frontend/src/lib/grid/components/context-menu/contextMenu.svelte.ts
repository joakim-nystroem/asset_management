import { queryStore } from '$lib/data/queryStore.svelte';

export function handleFilterByValue(
  key: string,
  value: string,
  close: () => void,
) {
  const alreadyExists = queryStore.filters.some(f => f.key === key && f.value === value);
  if (!alreadyExists) {
    queryStore.filters.push({ key, value });
  }
  close();
}
