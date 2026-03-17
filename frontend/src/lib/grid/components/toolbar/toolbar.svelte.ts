import type { SelectionContext, ClipboardContext, HistoryContext } from '$lib/context/gridContext.svelte';

/** Reset selection, clipboard, and history after commit or discard. */
export function resetEditState(
  selCtx: SelectionContext,
  clipCtx: ClipboardContext,
  historyCtx: HistoryContext,
) {
  historyCtx.undoStack = [];
  historyCtx.redoStack = [];
  selCtx.pasteRange = null;
  selCtx.selectionStart = { row: -1, col: '' };
  selCtx.selectionEnd = { row: -1, col: '' };
  selCtx.hideSelection = false;
  clipCtx.copyStart = { row: -1, col: '' };
  clipCtx.copyEnd = { row: -1, col: '' };
}
