import { getEditingContext, getColumnContext, getRowContext } from '$lib/context/gridContext.svelte.ts';

const DEFAULT_WIDTH = 150;
const MIN_WIDTH = 50;

function calculateContentWidth(text: string): number {
  const charWidth = 8;
  const padding = 16;
  const estimatedWidth = (text.length * charWidth) + padding;
  return Math.min(300, estimatedWidth);
}

export function createEditController() {
  const editCtx = getEditingContext();
  const colCtx = getColumnContext();
  const rowCtx = getRowContext();

  function startEdit(row: number, col: number, key: string, currentValue: string) {
    const originalWidth = colCtx.columnWidths.get(key) ?? DEFAULT_WIDTH;

    editCtx.editRow = row;
    editCtx.editCol = col;
    editCtx.editKey = key;
    editCtx.editOriginalValue = currentValue;
    editCtx.editOriginalColumnWidth = originalWidth;
    editCtx.inputValue = currentValue;
    editCtx.isEditing = true;

    const contentWidth = calculateContentWidth(currentValue);
    const expandedWidth = Math.min(300, Math.max(originalWidth, contentWidth));
    colCtx.columnWidths.set(key, Math.max(MIN_WIDTH, expandedWidth));
    rowCtx.rowHeights.set(row, 32);
  }

  function updateRowHeight(textareaElement: HTMLTextAreaElement | null) {
    if (!editCtx.isEditing || !textareaElement || editCtx.editKey === null) return;
    const currentWidth = colCtx.columnWidths.get(editCtx.editKey) ?? DEFAULT_WIDTH;
    if (currentWidth >= 300) {
      const contentHeight = textareaElement.scrollHeight;
      const paddingHeight = 16;
      const totalHeight = contentHeight + paddingHeight;
      rowCtx.rowHeights.set(editCtx.editRow, Math.max(32, totalHeight));
    } else {
      rowCtx.rowHeights.set(editCtx.editRow, 32);
    }
  }

  async function save(assets: Record<string, any>[]): Promise<{
    id: any; key: string; oldValue: any; newValue: any;
  } | null> {
    if (!editCtx.isEditing || editCtx.editKey === null) return null;

    const { editRow, editKey, editOriginalValue, editOriginalColumnWidth } = editCtx;
    const newValue = editCtx.inputValue.trim();
    const asset = assets[editRow];
    if (!asset) return null;

    colCtx.columnWidths.set(editKey, Math.max(MIN_WIDTH, editOriginalColumnWidth));
    rowCtx.rowHeights.delete(editRow);
    editCtx.isEditing = false;
    editCtx.editKey = null;
    editCtx.editRow = -1;
    editCtx.editCol = -1;
    editCtx.inputValue = '';

    if (editOriginalValue !== newValue) {
      // Optimistic update: update UI immediately
      asset[editKey] = newValue;
      return { id: asset.id, key: editKey, oldValue: editOriginalValue, newValue };
    }
    return null;
  }

  function cancel() {
    if (!editCtx.isEditing || editCtx.editKey === null) return;
    colCtx.columnWidths.set(editCtx.editKey, Math.max(MIN_WIDTH, editCtx.editOriginalColumnWidth));
    rowCtx.rowHeights.delete(editCtx.editRow);
    editCtx.isEditing = false;
    editCtx.editKey = null;
    editCtx.editRow = -1;
    editCtx.editCol = -1;
    editCtx.inputValue = '';
  }

  function getEditPosition(): { row: number; col: number } | null {
    if (!editCtx.isEditing) return null;
    return { row: editCtx.editRow, col: editCtx.editCol };
  }

  function isEditingCell(row: number, col: number): boolean {
    return editCtx.isEditing && editCtx.editRow === row && editCtx.editCol === col;
  }

  return { startEdit, updateRowHeight, save, cancel, getEditPosition, isEditingCell };
}

export type EditController = ReturnType<typeof createEditController>;
