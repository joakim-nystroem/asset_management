// Local interfaces to avoid cross-imports
interface ColumnManager {
  getWidth(key: string): number;
  setWidth(key: string, width: number): void;
}

interface RowManager {
  setHeight(rowIndex: number, height: number): void;
  resetHeight(rowIndex: number): void;
}

export type EditState = {
  row: number;
  col: number;
  key: string;
  originalValue: string;
  originalColumnWidth: number;
}

function createEditManager(deps?: { columnManager?: ColumnManager; rowManager?: RowManager }) {
  const { columnManager, rowManager } = deps || {};
  let isEditing = $state(false);
  let editState = $state<EditState | null>(null);
  let inputValue = $state('');

  function startEdit(
    row: number,
    col: number,
    key: string,
    currentValue: string,
    colMgr?: ColumnManager,
    rowMgr?: RowManager
  ) {
    const colManager = colMgr || columnManager;
    const rManager = rowMgr || rowManager;

    if (!colManager || !rManager) {
      throw new Error('editManager requires columnManager and rowManager');
    }

    const originalWidth = colManager.getWidth(key);

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
    colManager.setWidth(key, expandedWidth);
    rManager.setHeight(row, 32);
  }

  function updateRowHeight(textareaElement: HTMLTextAreaElement | null, rowMgr?: RowManager, colMgr?: ColumnManager) {
    if (!editState || !textareaElement) return;

    const rManager = rowMgr || rowManager;
    const colManager = colMgr || columnManager;

    if (!rManager || !colManager) {
      throw new Error('editManager requires columnManager and rowManager');
    }

    const currentColumnWidth = colManager.getWidth(editState.key);

    if (currentColumnWidth >= 300) {
      const contentHeight = textareaElement.scrollHeight;
      const paddingHeight = 16;
      const totalHeight = contentHeight + paddingHeight;
      const finalHeight = Math.max(32, totalHeight);
      rManager.setHeight(editState.row, finalHeight);
    } else {
      rManager.setHeight(editState.row, 32);
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
    colMgr?: ColumnManager,
    rowMgr?: RowManager
  ): Promise<{ id: any; key: string; oldValue: any; newValue: any; } | null> {
    if (!editState) return null;

    const colManager = colMgr || columnManager;
    const rManager = rowMgr || rowManager;

    if (!colManager || !rManager) {
      throw new Error('editManager requires columnManager and rowManager');
    }

    const { row, key, originalValue, originalColumnWidth } = editState;
    const newValue = inputValue.trim();

    const asset = assets[row];
    if (!asset) return null;

    colManager.setWidth(key, originalColumnWidth);
    rManager.resetHeight(row);

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

  function cancel(colMgr?: ColumnManager, rowMgr?: RowManager) {
    if (!editState) return;

    const colManager = colMgr || columnManager;
    const rManager = rowMgr || rowManager;

    if (!colManager || !rManager) {
      throw new Error('editManager requires columnManager and rowManager');
    }

    const { key, originalColumnWidth, row } = editState;
    colManager.setWidth(key, originalColumnWidth);
    rManager.resetHeight(row);
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

// Export factory function
export { createEditManager };

// Export singleton instance (without dependencies - will require them as method params)
export const editManager = createEditManager();