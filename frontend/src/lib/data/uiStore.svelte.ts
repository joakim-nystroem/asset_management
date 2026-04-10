import { SvelteMap } from 'svelte/reactivity';

// ─── Stores ──────────────────────────────────────────────────

export const uiStore = $state({
  filterPanel: { visible: false },
  headerMenu: { visible: false, activeKey: '' },
  contextMenu: { visible: false, x: 0, y: 0, row: -1, col: '', value: '' },
  suggestionMenu: { visible: false },
  settingsMenu: { visible: false },
});

export const sortStore = $state({
  key: null as string | null,
  direction: 'asc' as 'asc' | 'desc',
});

export const columnWidthStore = $state({
  widths: new SvelteMap<string, number>(),
});


