import { selectionStore, clipboardStore } from '$lib/data/cellStore.svelte';

/** Select a single cell: anchor + visible border, drag and paste markers cleared. */
export function selectCell(row: number, col: string) {
  selectionStore.pasteRange = null;
  selectionStore.selectionStart = { row, col };
  selectionStore.selectionEnd = { row, col };
  selectionStore.isDragging = false;
  selectionStore.isCellSelected = true;
}

/** Clear the selection entirely — no anchor remains, arrow keys go dead until the next click. */
export function resetSelection() {
  selectionStore.pasteRange = null;
  selectionStore.selectionStart = { row: -1, col: '' };
  selectionStore.selectionEnd = { row: -1, col: '' };
  selectionStore.isDragging = false;
  selectionStore.isCellSelected = false;
}

/** Hide all selection dressings (border, paste range) but keep the anchor so actions and arrows still work. */
export function hideSelection() {
  selectionStore.pasteRange = null;
  selectionStore.isDragging = false;
  selectionStore.isCellSelected = false;
}

/** Re-show the selection border at the preserved anchor (no-op without an anchor). */
export function revealSelection() {
  if (!selectionStore.hasAnchor) return;
  selectionStore.isCellSelected = true;
}

/** Extend the selection rectangle to `target`, keeping the anchor (selectionStart). */
export function extendSelectionTo(target: { row: number; col: string }) {
  selectionStore.pasteRange = null;
  selectionStore.selectionEnd = { row: target.row, col: target.col };
}

/** Clear the copy marquee markers. */
export function clearClipboard() {
  clipboardStore.copyStart = { row: -1, col: '' };
  clipboardStore.copyEnd = { row: -1, col: '' };
}
