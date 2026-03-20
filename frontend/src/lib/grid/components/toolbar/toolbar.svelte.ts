import { selectionStore, clipboardStore, historyStore } from '$lib/data/cellStore.svelte';

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
