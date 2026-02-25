import { getGridContext } from '$lib/context/gridContext.svelte.ts';

const DEFAULT_WIDTH = 150;
const MIN_WIDTH = 50;

function calculateContentWidth(text: string): number {
  const charWidth = 8;
  const padding = 16;
  const estimatedWidth = (text.length * charWidth) + padding;
  return Math.min(300, estimatedWidth);
}

export function createEditController() {
  const ctx = getGridContext();

  function startEdit(row: number, col: number, key: string, currentValue: string) {
    const originalWidth = ctx.columnWidths.get(key) ?? DEFAULT_WIDTH;

    ctx.editRow = row;
    ctx.editCol = col;
    ctx.editKey = key;
    ctx.editOriginalValue = currentValue;
    ctx.editOriginalColumnWidth = originalWidth;
    ctx.inputValue = currentValue;
    ctx.isEditing = true;

    const contentWidth = calculateContentWidth(currentValue);
    const expandedWidth = Math.min(300, Math.max(originalWidth, contentWidth));
    ctx.columnWidths.set(key, Math.max(MIN_WIDTH, expandedWidth));
    ctx.rowHeights.set(row, 32);
  }

  function updateRowHeight(textareaElement: HTMLTextAreaElement | null) {
    if (!ctx.isEditing || !textareaElement || ctx.editKey === null) return;
    const currentWidth = ctx.columnWidths.get(ctx.editKey) ?? DEFAULT_WIDTH;
    if (currentWidth >= 300) {
      const contentHeight = textareaElement.scrollHeight;
      const paddingHeight = 16;
      const totalHeight = contentHeight + paddingHeight;
      ctx.rowHeights.set(ctx.editRow, Math.max(32, totalHeight));
    } else {
      ctx.rowHeights.set(ctx.editRow, 32);
    }
  }

  async function save(assets: Record<string, unknown>[]): Promise<{
    id: unknown; key: string; oldValue: unknown; newValue: unknown;
  } | null> {
    if (!ctx.isEditing || ctx.editKey === null) return null;

    const { editRow, editKey, editOriginalValue, editOriginalColumnWidth } = ctx;
    const newValue = ctx.inputValue.trim();
    const asset = assets[editRow];
    if (!asset) return null;

    ctx.columnWidths.set(editKey, Math.max(MIN_WIDTH, editOriginalColumnWidth));
    ctx.rowHeights.delete(editRow);
    ctx.isEditing = false;
    ctx.editKey = null;
    ctx.editRow = -1;
    ctx.editCol = -1;
    ctx.inputValue = '';

    if (editOriginalValue !== newValue) {
      // Optimistic update: update UI immediately
      asset[editKey] = newValue;
      return { id: asset.id, key: editKey, oldValue: editOriginalValue, newValue };
    }
    return null;
  }

  function cancel() {
    if (!ctx.isEditing || ctx.editKey === null) return;
    ctx.columnWidths.set(ctx.editKey, Math.max(MIN_WIDTH, ctx.editOriginalColumnWidth));
    ctx.rowHeights.delete(ctx.editRow);
    ctx.isEditing = false;
    ctx.editKey = null;
    ctx.editRow = -1;
    ctx.editCol = -1;
    ctx.inputValue = '';
  }

  function getEditPosition(): { row: number; col: number } | null {
    if (!ctx.isEditing) return null;
    return { row: ctx.editRow, col: ctx.editCol };
  }

  function isEditingCell(row: number, col: number): boolean {
    return ctx.isEditing && ctx.editRow === row && ctx.editCol === col;
  }

  return { startEdit, updateRowHeight, save, cancel, getEditPosition, isEditingCell };
}

export type EditController = ReturnType<typeof createEditController>;
