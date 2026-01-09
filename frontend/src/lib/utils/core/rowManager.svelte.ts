// $lib/utils/core/rowHeightManager.svelte.ts
import { SvelteMap } from 'svelte/reactivity';

function createRowHeightManager() {
  // Default height for all rows
  const defaultHeight = 32;

  // Store custom heights per row index - Using SvelteMap for granular reactivity
  const customHeights = new SvelteMap<number, number>();

  /**
   * Get height for a specific row
   */
  function getHeight(rowIndex: number): number {
    return customHeights.get(rowIndex) ?? defaultHeight;
  }

  /**
   * Set custom height for a specific row
   */
  function setHeight(rowIndex: number, height: number) {
    // Enforce minimum height
    const minHeight = 32;
    const clampedHeight = Math.max(minHeight, height);
    customHeights.set(rowIndex, clampedHeight);
  }

  /**
   * Reset a specific row height to default
   */
  function resetHeight(rowIndex: number) {
    customHeights.delete(rowIndex);
  }

  /**
   * Calculate cumulative offset up to a target row index
   * Used for positioning the visible window correctly
   */
  function getOffsetY(targetIndex: number): number {
    let offset = 0;
    for (let i = 0; i < targetIndex; i++) {
      offset += getHeight(i);
    }
    return offset;
  }

  /**
   * Calculate total height of all rows
   * Used for scrollbar sizing
   */
  function getTotalHeight(itemCount: number): number {
    let total = 0;
    for (let i = 0; i < itemCount; i++) {
      total += getHeight(i);
    }
    return total;
  }

  /**
   * Check if a row has a custom height
   */
  function hasCustomHeight(rowIndex: number): boolean {
    return customHeights.has(rowIndex);
  }

  /**
   * Reset all custom heights
   */
  function resetAll() {
    customHeights.clear();
  }

  /**
   * Get all custom heights (for debugging or export)
   */
  function getAllCustomHeights(): Record<number, number> {
    return Object.fromEntries(customHeights.entries());
  }

  /**
   * Get default height value
   */
  function getDefaultHeight(): number {
    return defaultHeight;
  }

  return {
    getHeight,
    setHeight,
    resetHeight,
    getOffsetY,
    getTotalHeight,
    hasCustomHeight,
    resetAll,
    getAllCustomHeights,
    getDefaultHeight
  };
}

export type RowHeightManager = ReturnType<typeof createRowHeightManager>;

// Export singleton instance
export const rowManager = createRowHeightManager();