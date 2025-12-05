// $lib/utils/core/virtualScrollManager.svelte.ts

import type { ColumnWidthManager } from './columnManager.svelte';
import type { RowHeightManager } from './rowManager.svelte';

export class VirtualScrollManager {
  // Configuration
  rowHeight = 32; // Default height of each row (h-8 = 2rem = 32px)
  overscan = 15; // Extra rows to render above/below viewport for smooth scrolling
  
  // State
  scrollTop = $state(0);
  containerHeight = $state(0);
  
  // Computed visible range
  get visibleRange() {
    const startIndex = Math.max(0, Math.floor(this.scrollTop / this.rowHeight) - this.overscan);
    const visibleCount = Math.ceil(this.containerHeight / this.rowHeight);
    const endIndex = startIndex + visibleCount + (this.overscan * 2);
    
    return { startIndex, endIndex };
  }
  
  /**
   * Get the subset of data to actually render
   */
  getVisibleItems<T>(data: T[]): { items: T[]; startIndex: number; endIndex: number } {
    const { startIndex, endIndex } = this.visibleRange;
    const clampedEnd = Math.min(endIndex, data.length);
    
    return {
      items: data.slice(startIndex, clampedEnd),
      startIndex,
      endIndex: clampedEnd
    };
  }
  
  /**
   * Calculate total height of all rows (for scrollbar)
   * Now accounts for custom row heights
   */
  getTotalHeight(itemCount: number, RowHeightManager?: RowHeightManager): number {
    if (!RowHeightManager) {
      return itemCount * this.rowHeight;
    }
    return RowHeightManager.getTotalHeight(itemCount);
  }
  
  /**
   * Calculate offset for the visible window
   * Now accounts for custom row heights before the visible range
   */
  getOffsetY(RowHeightManager?: RowHeightManager): number {
    if (!RowHeightManager) {
      return this.visibleRange.startIndex * this.rowHeight;
    }
    return RowHeightManager.getOffsetY(this.visibleRange.startIndex);
  }
  
  /**
   * Handle scroll event
   */
  handleScroll(e: Event) {
    const target = e.target as HTMLElement;
    this.scrollTop = target.scrollTop;
  }
  
  /**
   * Handle container resize
   */
  updateContainerHeight(height: number) {
    this.containerHeight = height;
  }
  
  /**
   * Scroll to a specific row index
   * Now accounts for custom row heights
   */
  scrollToRow(index: number, container: HTMLElement | null, RowHeightManager?: RowHeightManager) {
    if (!container) return;
    
    let targetScrollTop: number;
    
    if (!RowHeightManager) {
      targetScrollTop = index * this.rowHeight;
    } else {
      targetScrollTop = RowHeightManager.getOffsetY(index);
    }
    
    container.scrollTop = targetScrollTop;
    this.scrollTop = targetScrollTop;
  }
  
  /**
   * Get the actual row index from a visible index
   */
  getActualIndex(visibleIndex: number): number {
    return this.visibleRange.startIndex + visibleIndex;
  }
  
  /**
   * Check if a row index is currently visible
   */
  isRowVisible(index: number): boolean {
    const { startIndex, endIndex } = this.visibleRange;
    return index >= startIndex && index < endIndex;
  }

  /**
   * Smartly scroll container so the target cell (row + col) is visible.
   * Now accounts for custom row heights
   */
  ensureVisible(
    rowIndex: number, 
    colIndex: number,
    container: HTMLElement | null,
    keys: string[],
    columnManager: ColumnWidthManager,
    RowHeightManager?: RowHeightManager
  ) {
    if (!container) return;

    // --- Vertical Scrolling ---
    const headerHeight = 32; // Matches h-8 header

    // 1. Calculate the Visual Position of the row
    let rowVisualTop: number;
    if (!RowHeightManager) {
      rowVisualTop = (rowIndex * this.rowHeight) + headerHeight;
    } else {
      rowVisualTop = RowHeightManager.getOffsetY(rowIndex) + headerHeight;
    }
    
    const rowHeight = RowHeightManager?.getHeight(rowIndex) ?? this.rowHeight;
    const rowVisualBottom = rowVisualTop + rowHeight;

    // 2. Calculate the Viewport boundaries
    const viewTop = container.scrollTop + headerHeight;
    const viewBottom = container.scrollTop + container.clientHeight;

    // 3. Scroll Logic (Vertical)
    if (rowVisualTop < viewTop) {
      container.scrollTop = rowVisualTop - headerHeight;
      this.scrollTop = container.scrollTop;
    } 
    else if (rowVisualBottom > viewBottom) {
      const scrollBuffer = 40; 
      container.scrollTop = rowVisualBottom - container.clientHeight + scrollBuffer;
      this.scrollTop = container.scrollTop;
    }

    // --- Horizontal Scrolling ---
    if (colIndex < 0 || colIndex >= keys.length) return;

    // 1. Calculate Horizontal Position
    let cellLeft = 0;
    for (let i = 0; i < colIndex; i++) {
        cellLeft += columnManager.getWidth(keys[i]);
    }
    const cellWidth = columnManager.getWidth(keys[colIndex]);
    const cellRight = cellLeft + cellWidth;

    // 2. Viewport Boundaries (Horizontal)
    const viewLeft = container.scrollLeft;
    const viewRight = container.scrollLeft + container.clientWidth;

    // 3. Scroll Logic (Horizontal)
    if (cellLeft < viewLeft) {
        // Target is hidden to the LEFT -> Scroll Left
        container.scrollLeft = cellLeft;
    } else if (cellRight > viewRight) {
        // Target is hidden to the RIGHT -> Scroll Right
        container.scrollLeft = cellRight - container.clientWidth; 
    }
  }
}