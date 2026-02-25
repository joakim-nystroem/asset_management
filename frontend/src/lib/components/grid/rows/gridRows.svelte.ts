import { getGridContext } from '$lib/context/gridContext.svelte.ts';

const DEFAULT_ROW_HEIGHT = 32;

export function createRowController() {
  const ctx = getGridContext();  // safe: called during component init

  function getHeight(rowIndex: number): number {
    return ctx.rowHeights.get(rowIndex) ?? DEFAULT_ROW_HEIGHT;
  }

  function setHeight(rowIndex: number, height: number) {
    ctx.rowHeights.set(rowIndex, Math.max(DEFAULT_ROW_HEIGHT, height));
  }

  function resetHeight(rowIndex: number) {
    ctx.rowHeights.delete(rowIndex);
  }

  function resetAll() {
    ctx.rowHeights.clear();
  }

  /**
   * Calculate cumulative offset up to a target row index.
   * Used for positioning the visible window correctly.
   */
  function getOffsetY(targetIndex: number): number {
    let offset = 0;
    for (let i = 0; i < targetIndex; i++) {
      offset += getHeight(i);
    }
    return offset;
  }

  /**
   * Calculate total height of all rows.
   * Used for scrollbar sizing.
   */
  function getTotalHeight(itemCount: number): number {
    let total = 0;
    for (let i = 0; i < itemCount; i++) {
      total += getHeight(i);
    }
    return total;
  }

  /**
   * Check if a row has a custom height.
   */
  function hasCustomHeight(rowIndex: number): boolean {
    return ctx.rowHeights.has(rowIndex);
  }

  /**
   * Get all custom heights (for debugging or export).
   */
  function getAllCustomHeights(): Record<number, number> {
    return Object.fromEntries(ctx.rowHeights.entries());
  }

  /**
   * Get default height value.
   */
  function getDefaultHeight(): number {
    return DEFAULT_ROW_HEIGHT;
  }

  return {
    getHeight,
    setHeight,
    resetHeight,
    resetAll,
    getOffsetY,
    getTotalHeight,
    hasCustomHeight,
    getAllCustomHeights,
    getDefaultHeight,
  };
}

export type RowController = ReturnType<typeof createRowController>;
