export const queryStore = $state({
  view: 'default',
  q: '',
  filters: [] as { key: string; value: string }[],
});
