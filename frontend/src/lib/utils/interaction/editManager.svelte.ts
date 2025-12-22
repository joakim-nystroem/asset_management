import type { ColumnWidthManager } from '../core/columnManager.svelte';
import type { RowHeightManager } from '../core/rowManager.svelte';

export type EditState = {
  row: number;
  col: number;
  key: string;
  originalValue: string;
  originalColumnWidth: number;
}

export class EditManager {
  isEditing = $state(false);
  editState = $state<EditState | null>(null);
  inputValue = $state('');

  startEdit(
    row: number,
    col: number,
    key: string,
    currentValue: string,
    columnManager: ColumnWidthManager,
    rowManager: RowHeightManager
  ) {
    const originalWidth = columnManager.getWidth(key);
    
    this.editState = {
      row,
      col,
      key,
      originalValue: currentValue,
      originalColumnWidth: originalWidth
    };
    
    this.inputValue = currentValue;
    this.isEditing = true;

    const contentWidth = this.calculateContentWidth(currentValue);
    const expandedWidth = Math.min(300, Math.max(originalWidth, contentWidth));
    columnManager.setWidth(key, expandedWidth);
    rowManager.setHeight(row, 32);
  }

  updateRowHeight(textareaElement: HTMLTextAreaElement | null, rowManager: RowHeightManager, columnManager: ColumnWidthManager) {
    if (!this.editState || !textareaElement) return;
    const currentColumnWidth = columnManager.getWidth(this.editState.key);
    
    if (currentColumnWidth >= 300) {
      const contentHeight = textareaElement.scrollHeight;
      const paddingHeight = 16;
      const totalHeight = contentHeight + paddingHeight;
      const finalHeight = Math.max(32, totalHeight);
      rowManager.setHeight(this.editState.row, finalHeight);
    } else {
      rowManager.setHeight(this.editState.row, 32);
    }
  }

  private calculateContentWidth(text: string): number {
    const charWidth = 8;
    const padding = 16; 
    const estimatedWidth = (text.length * charWidth) + padding;
    return Math.min(300, estimatedWidth);
  }

  async save(
    assets: any[],
    columnManager: ColumnWidthManager,
    rowManager: RowHeightManager
  ): Promise<{ id: any; key: string; oldValue: any; newValue: any; } | null> {
    if (!this.editState) return null;

    const { row, key, originalValue, originalColumnWidth } = this.editState;
    const newValue = this.inputValue.trim();

    const asset = assets[row];
    if (!asset) return null;

    columnManager.setWidth(key, originalColumnWidth);
    rowManager.resetHeight(row);

    this.isEditing = false;
    this.editState = null;
    this.inputValue = '';

    if (originalValue !== newValue) {
      // 1. Optimistic Update (Update UI immediately)
      asset[key] = newValue;

      // 2. Return change for caller to handle
      return { id: asset.id, key: key, oldValue: originalValue, newValue: newValue };
    }

    return null;
  }

  cancel(columnManager: ColumnWidthManager, rowManager: RowHeightManager) {
    if (!this.editState) return;
    const { key, originalColumnWidth, row } = this.editState;
    columnManager.setWidth(key, originalColumnWidth);
    rowManager.resetHeight(row);
    this.isEditing = false;
    this.editState = null;
    this.inputValue = '';
  }

  getEditPosition(): { row: number; col: number } | null {
    if (!this.editState) return null;
    return { row: this.editState.row, col: this.editState.col };
  }

  isEditingCell(row: number, col: number): boolean {
    if (!this.editState) return false;
    return this.editState.row === row && this.editState.col === col;
  }
}