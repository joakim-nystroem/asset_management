import type { QueryContext } from '$lib/context/gridContext.svelte.ts';

export function handleFilterByValue(
  key: string,
  value: string,
  queryCtx: QueryContext,
  close: () => void,
) {
  const alreadyExists = queryCtx.filters.some(f => f.key === key && f.value === value);
  if (!alreadyExists) {
    queryCtx.filters.push({ key, value });
  }
  close();
}
