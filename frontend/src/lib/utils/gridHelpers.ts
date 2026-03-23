import { editingStore, selectionStore, clipboardStore, historyStore } from '$lib/data/cellStore.svelte';
import { uiStore } from '$lib/data/uiStore.svelte';

/** Reset editing state back to idle. */
export function resetEditing() {
  editingStore.isEditing = false;
  editingStore.editRow = -1;
  editingStore.editCol = '';
  editingStore.editValue = '';
}

/** Close all panels except the one specified (mutually exclusive panel system). */
export function setOpenPanel(panel?: 'contextMenu' | 'headerMenu' | 'filterPanel' | 'suggestionMenu') {
  if (panel !== 'contextMenu' && uiStore.contextMenu.visible) uiStore.contextMenu.visible = false;
  if (panel !== 'headerMenu' && uiStore.headerMenu.visible) { uiStore.headerMenu.activeKey = ''; uiStore.headerMenu.visible = false; }
  if (panel !== 'filterPanel' && uiStore.filterPanel.visible) uiStore.filterPanel.visible = false;
  if (panel !== 'suggestionMenu' && uiStore.suggestionMenu.visible) uiStore.suggestionMenu.visible = false;
}

/** Reset selection and clipboard after commit — keeps undo/redo history intact. */
export function resetAfterCommit() {
  selectionStore.pasteRange = null;
  selectionStore.selectionStart = { row: -1, col: '' };
  selectionStore.selectionEnd = { row: -1, col: '' };
  selectionStore.hideSelection = false;
  clipboardStore.copyStart = { row: -1, col: '' };
  clipboardStore.copyEnd = { row: -1, col: '' };
}

/** Reset selection, clipboard, and history after commit or discard. */
export function resetEditState() {
  historyStore.undoStack = [];
  historyStore.redoStack = [];
  selectionStore.pasteRange = null;
  selectionStore.selectionStart = { row: -1, col: '' };
  selectionStore.selectionEnd = { row: -1, col: '' };
  selectionStore.hideSelection = false;
  clipboardStore.copyStart = { row: -1, col: '' };
  clipboardStore.copyEnd = { row: -1, col: '' };
}
