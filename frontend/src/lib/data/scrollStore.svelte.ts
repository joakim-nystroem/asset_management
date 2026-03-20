export const scrollStore = $state({
  scrollTop: 0,
  scrollLeft: 0,
  visibleRange: { startIndex: 0, endIndex: 50 },
  scrollToRow: null as number | null,
  scrollToCol: null as { left: number; right: number } | null,
  isAutoScrolling: false,
});
