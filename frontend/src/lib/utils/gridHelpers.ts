import { editingStore, historyStore } from '$lib/data/cellStore.svelte';
import { uiStore } from '$lib/data/uiStore.svelte';
import { resetSelection, clearClipboard } from '$lib/utils/selection';

/** Reset editing state back to idle. */
export function resetEditing() {
  editingStore.isEditing = false;
  editingStore.editRow = -1;
  editingStore.editCol = '';
  editingStore.editValue = '';
}

/** Close all panels except the one specified (mutually exclusive panel system). */
export function setOpenPanel(panel?: 'contextMenu' | 'headerMenu' | 'filterPanel' | 'suggestionMenu' | 'settingsMenu') {
  if (panel !== 'contextMenu' && uiStore.contextMenu.visible) uiStore.contextMenu.visible = false;
  if (panel !== 'headerMenu' && uiStore.headerMenu.visible) { uiStore.headerMenu.activeKey = ''; uiStore.headerMenu.visible = false; }
  if (panel !== 'filterPanel' && uiStore.filterPanel.visible) uiStore.filterPanel.visible = false;
  if (panel !== 'suggestionMenu' && uiStore.suggestionMenu.visible) uiStore.suggestionMenu.visible = false;
  if (panel !== 'settingsMenu' && uiStore.settingsMenu.visible) uiStore.settingsMenu.visible = false;
}

/** Reset selection and clipboard after commit — keeps undo/redo history intact. */
export function resetAfterCommit() {
  resetSelection();
  clearClipboard();
}

/** Reset selection, clipboard, and history after commit or discard. */
export function resetEditState() {
  historyStore.undoStack = [];
  historyStore.redoStack = [];
  resetSelection();
  clearClipboard();
}
