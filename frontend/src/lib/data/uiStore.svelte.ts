import { SvelteMap } from 'svelte/reactivity';

// ─── Stores ──────────────────────────────────────────────────

export const uiStore = $state({
  filterPanel: { visible: false },
  headerMenu: { visible: false, activeKey: '' },
  contextMenu: { visible: false, x: 0, y: 0, row: -1, col: '', value: '' },
  suggestionMenu: { visible: false },
});

export const sortStore = $state({
  key: null as string | null,
  direction: 'asc' as 'asc' | 'desc',
});

export const columnWidthStore = $state({
  widths: new SvelteMap<string, number>(),
});

export const rowStore = $state({
  rowHeights: new SvelteMap<number, number>(),
});

// ─── Helpers ─────────────────────────────────────────────────

export function setOpenPanel(panel?: 'contextMenu' | 'headerMenu' | 'filterPanel' | 'suggestionMenu') {
  if (panel !== 'contextMenu' && uiStore.contextMenu.visible) uiStore.contextMenu.visible = false;
  if (panel !== 'headerMenu' && uiStore.headerMenu.visible) { uiStore.headerMenu.activeKey = ''; uiStore.headerMenu.visible = false; }
  if (panel !== 'filterPanel' && uiStore.filterPanel.visible) uiStore.filterPanel.visible = false;
  if (panel !== 'suggestionMenu' && uiStore.suggestionMenu.visible) uiStore.suggestionMenu.visible = false;
}
