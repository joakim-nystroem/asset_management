import type { ColumnWidthManager } from '../core/columnManager.svelte';
import type { RowHeightManager } from '../core/rowManager.svelte';

export type EditState = {
  row: number;
  col: number;
  key: string;
  originalValue: string;
  originalColumnWidth: number;
}

function createEditManager() {
  let isEditing = $state(false);
  let editState = $state<EditState | null>(null);
  let inputValue = $state('');

  function startEdit(
    row: number,
    col: number,
    key: string,
    currentValue: string,
    columnManager: ColumnWidthManager,
    rowManager: RowHeightManager
  ) {
    const originalWidth = columnManager.getWidth(key);

    editState = {
      row,
      col,
      key,
      originalValue: currentValue,
      originalColumnWidth: originalWidth
    };

    inputValue = currentValue;
    isEditing = true;

    const contentWidth = calculateContentWidth(currentValue);
    const expandedWidth = Math.min(300, Math.max(originalWidth, contentWidth));
    columnManager.setWidth(key, expandedWidth);
    rowManager.setHeight(row, 32);
  }

  function updateRowHeight(textareaElement: HTMLTextAreaElement | null, rowManager: RowHeightManager, columnManager: ColumnWidthManager) {
    if (!editState || !textareaElement) return;
    const currentColumnWidth = columnManager.getWidth(editState.key);

    if (currentColumnWidth >= 300) {
      const contentHeight = textareaElement.scrollHeight;
      const paddingHeight = 16;
      const totalHeight = contentHeight + paddingHeight;
      const finalHeight = Math.max(32, totalHeight);
      rowManager.setHeight(editState.row, finalHeight);
    } else {
      rowManager.setHeight(editState.row, 32);
    }
  }

  function calculateContentWidth(text: string): number {
    const charWidth = 8;
    const padding = 16;
    const estimatedWidth = (text.length * charWidth) + padding;
    return Math.min(300, estimatedWidth);
  }

  async function save(
    assets: any[],
    columnManager: ColumnWidthManager,
    rowManager: RowHeightManager
  ): Promise<{ id: any; key: string; oldValue: any; newValue: any; } | null> {
    if (!editState) return null;

    const { row, key, originalValue, originalColumnWidth } = editState;
    const newValue = inputValue.trim();

    const asset = assets[row];
    if (!asset) return null;

    columnManager.setWidth(key, originalColumnWidth);
    rowManager.resetHeight(row);

    isEditing = false;
    editState = null;
    inputValue = '';

    if (originalValue !== newValue) {
      // 1. Optimistic Update (Update UI immediately)
      asset[key] = newValue;

      // 2. Return change for caller to handle
      return { id: asset.id, key: key, oldValue: originalValue, newValue: newValue };
    }

    return null;
  }

  function cancel(columnManager: ColumnWidthManager, rowManager: RowHeightManager) {
    if (!editState) return;
    const { key, originalColumnWidth, row } = editState;
    columnManager.setWidth(key, originalColumnWidth);
    rowManager.resetHeight(row);
    isEditing = false;
    editState = null;
    inputValue = '';
  }

  function getEditPosition(): { row: number; col: number } | null {
    if (!editState) return null;
    return { row: editState.row, col: editState.col };
  }

  function isEditingCell(row: number, col: number): boolean {
    if (!editState) return false;
    return editState.row === row && editState.col === col;
  }

  return {
    get isEditing() { return isEditing },
    get editState() { return editState },
    get inputValue() { return inputValue },
    set inputValue(value: string) { inputValue = value },

    startEdit,
    updateRowHeight,
    save,
    cancel,
    getEditPosition,
    isEditingCell
  };
}

export type EditManager = ReturnType<typeof createEditManager>;

// Export singleton instance
export const editManager = createEditManager();