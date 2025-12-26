import type { ColumnWidthManager } from './columnManager.svelte';
import type { RowHeightManager } from './rowManager.svelte';

function createVirtualScrollManager() {
  // Configuration
  const rowHeight = 32;
  const overscan = 15;

  // Reactive scroll state
  let scrollTop = $state(0);
  let containerHeight = $state(0);

  // Derived: Visible range
  const visibleRange = $derived.by(() => {
    const startIndex = Math.max(
      0, 
      Math.floor(scrollTop / rowHeight) - overscan
    );
    const visibleCount = Math.ceil(containerHeight / rowHeight);
    const endIndex = startIndex + visibleCount + (overscan * 2);
    
    return { startIndex, endIndex };
  });

  // Actions
  function getVisibleItems<T>(data: T[]) {
    const { startIndex, endIndex } = visibleRange;
    const clampedEnd = Math.min(endIndex, data.length);
    
    return {
      items: data.slice(startIndex, clampedEnd),
      startIndex,
      endIndex: clampedEnd
    };
  }

  function getTotalHeight(itemCount: number, rowHeightManager?: RowHeightManager): number {
    if (!rowHeightManager) {
      return itemCount * rowHeight;
    }
    return rowHeightManager.getTotalHeight(itemCount);
  }

  function getOffsetY(rowHeightManager?: RowHeightManager): number {
    if (!rowHeightManager) {
      return visibleRange.startIndex * rowHeight;
    }
    return rowHeightManager.getOffsetY(visibleRange.startIndex);
  }

  function handleScroll(e: Event) {
    const target = e.target as HTMLElement;
    scrollTop = target.scrollTop;
  }

  function updateContainerHeight(height: number) {
    containerHeight = height;
  }

  function scrollToRow(
    index: number, 
    container: HTMLElement | null, 
    rowHeightManager?: RowHeightManager
  ) {
    if (!container) return;
    
    let targetScrollTop: number;
    
    if (!rowHeightManager) {
      targetScrollTop = index * rowHeight;
    } else {
      targetScrollTop = rowHeightManager.getOffsetY(index);
    }
    
    container.scrollTop = targetScrollTop;
    scrollTop = targetScrollTop;
  }

  function getActualIndex(visibleIndex: number): number {
    return visibleRange.startIndex + visibleIndex;
  }

  function isRowVisible(index: number): boolean {
    const { startIndex, endIndex } = visibleRange;
    return index >= startIndex && index < endIndex;
  }

  function ensureVisible(
    rowIndex: number, 
    colIndex: number,
    container: HTMLElement | null,
    keys: string[],
    columnManager: ColumnWidthManager,
    rowHeightManager?: RowHeightManager
  ) {
    if (!container) return;

    // --- Vertical Scrolling ---
    const headerHeight = 32;

    // 1. Calculate the Visual Position of the row
    let rowVisualTop: number;
    if (!rowHeightManager) {
      rowVisualTop = (rowIndex * rowHeight) + headerHeight;
    } else {
      rowVisualTop = rowHeightManager.getOffsetY(rowIndex) + headerHeight;
    }
    
    const currentRowHeight = rowHeightManager?.getHeight(rowIndex) ?? rowHeight;
    const rowVisualBottom = rowVisualTop + currentRowHeight;

    // 2. Calculate the Viewport boundaries
    const viewTop = container.scrollTop + headerHeight;
    const viewBottom = container.scrollTop + container.clientHeight;

    // 3. Scroll Logic (Vertical)
    if (rowVisualTop < viewTop) {
      container.scrollTop = rowVisualTop - headerHeight;
      scrollTop = container.scrollTop;
    } 
    else if (rowVisualBottom > viewBottom) {
      const scrollBuffer = 40; 
      container.scrollTop = rowVisualBottom - container.clientHeight + scrollBuffer;
      scrollTop = container.scrollTop;
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
      container.scrollLeft = cellLeft;
    } else if (cellRight > viewRight) {
      container.scrollLeft = cellRight - container.clientWidth; 
    }
  }

  // Return public API
  return {
    // Config accessors (read-only for now)
    get rowHeight() { return rowHeight },
    get overscan() { return overscan },
    
    // State accessors
    get scrollTop() { return scrollTop },
    get containerHeight() { return containerHeight },
    
    // Derived values
    get visibleRange() { return visibleRange },
    
    // Actions
    getVisibleItems,
    getTotalHeight,
    getOffsetY,
    handleScroll,
    updateContainerHeight,
    scrollToRow,
    getActualIndex,
    isRowVisible,
    ensureVisible
  };
}

export type VirtualScrollManager = ReturnType<typeof createVirtualScrollManager>;

// Export factory function for creating instances
export const createVirtualScroll = createVirtualScrollManager;