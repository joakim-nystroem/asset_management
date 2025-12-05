// $lib/utils/core/rowHeightManager.svelte.ts
import { SvelteMap } from 'svelte/reactivity';

export class RowHeightManager {
  // Default height for all rows
  private defaultHeight = 32;
  
  // Store custom heights per row index - Using SvelteMap for granular reactivity
  private customHeights = new SvelteMap<number, number>();

  /**
   * Get height for a specific row
   */
  getHeight(rowIndex: number): number {
    return this.customHeights.get(rowIndex) ?? this.defaultHeight;
  }

  /**
   * Set custom height for a specific row
   */
  setHeight(rowIndex: number, height: number) {
    // Enforce minimum height
    const minHeight = 32;
    const clampedHeight = Math.max(minHeight, height);
    this.customHeights.set(rowIndex, clampedHeight);
  }

  /**
   * Reset a specific row height to default
   */
  resetHeight(rowIndex: number) {
    this.customHeights.delete(rowIndex);
  }

  /**
   * Calculate cumulative offset up to a target row index
   * Used for positioning the visible window correctly
   */
  getOffsetY(targetIndex: number): number {
    let offset = 0;
    for (let i = 0; i < targetIndex; i++) {
      offset += this.getHeight(i);
    }
    return offset;
  }

  /**
   * Calculate total height of all rows
   * Used for scrollbar sizing
   */
  getTotalHeight(itemCount: number): number {
    let total = 0;
    for (let i = 0; i < itemCount; i++) {
      total += this.getHeight(i);
    }
    return total;
  }

  /**
   * Check if a row has a custom height
   */
  hasCustomHeight(rowIndex: number): boolean {
    return this.customHeights.has(rowIndex);
  }

  /**
   * Reset all custom heights
   */
  resetAll() {
    this.customHeights.clear();
  }

  /**
   * Get all custom heights (for debugging or export)
   */
  getAllCustomHeights(): Record<number, number> {
    return Object.fromEntries(this.customHeights.entries());
  }

  /**
   * Get default height value
   */
  getDefaultHeight(): number {
    return this.defaultHeight;
  }
}