// src/lib/utils/interaction/selectionManager.svelte.ts
import type { ColumnWidthManager } from '../core/columnManager.svelte';

export type GridCell = {
  row: number;
  col: number;
};

export type VisualSelection = {
  top: number;
  left: number;
  width: number;
  height: number;
  isVisible: boolean;
  showTopBorder: boolean;
  showBottomBorder: boolean;
  showLeftBorder: boolean;
  showRightBorder: boolean;
};

function createSelectionManager() {
  // Selection state
  let start = $state<GridCell>({ row: -1, col: -1 });
  let end = $state<GridCell>({ row: -1, col: -1 });
  let isSelecting = $state(false);
  
  // Copy overlay state
  let copyStart = $state<GridCell>({ row: -1, col: -1 });
  let copyEnd = $state<GridCell>({ row: -1, col: -1 });
  let isCopyVisible = $state(false);
  
  // Dirty cells tracking
  let dirtyCells = $state(new Set<string>());

  // Derived values
  const bounds = $derived.by(() => {
    if (start.row === -1 || end.row === -1) return null;
    return {
      minRow: Math.min(start.row, end.row),
      maxRow: Math.max(start.row, end.row),
      minCol: Math.min(start.col, end.col),
      maxCol: Math.max(start.col, end.col),
    };
  });

  const hasSelection = $derived(start.row !== -1);
  
  const primaryRange = $derived.by(() => {
    if (start.row === -1) return null;
    return { start, end };
  });

  const anchor = $derived(start.row !== -1 ? start : null);

  // Actions
  function setDirtyCells(cells: GridCell[]) {
    const newSet = new Set<string>();
    for (const cell of cells) {
      newSet.add(`${cell.row},${cell.col}`);
    }
    dirtyCells = newSet;
  }

  function clearDirtyCells() {
    dirtyCells = new Set<string>();
  }

  function handleMouseDown(row: number, col: number, e: MouseEvent) {
    if (e.button !== 0) return;

    isSelecting = true;

    if (e.shiftKey && start.row !== -1) {
      end = { row, col };
    } else {
      const isSingleCellSelected = 
        start.row === end.row && 
        start.col === end.col &&
        start.row !== -1;
      
      const clickingSameCell = start.row === row && start.col === col;
      
      if (isSingleCellSelected && clickingSameCell) {
        reset();
      } else {
        start = { row, col };
        end = { row, col };
      }
    }
  }

  function extendSelection(row: number, col: number) {
    if (isSelecting) {
      end = { row, col };
    }
  }

  function endSelection() {
    isSelecting = false;
  }

  function moveTo(row: number, col: number) {
    start = { row, col };
    end = { row, col };
  }

  function selectCell(row: number, col: number) {
    if (isCellSelected(row, col)) return;
    start = { row, col };
    end = { row, col };
  }

  function snapshotAsCopied() {
    if (start.row !== -1) {
      copyStart = { ...start };
      copyEnd = { ...end };
      isCopyVisible = true;
    }
  }

  function clearCopyOverlay() {
    isCopyVisible = false;
  }

  function reset() {
    start = { row: -1, col: -1 };
    end = { row: -1, col: -1 };
  }

  function resetAll() {
    reset();
    isCopyVisible = false;
  }

  function isCellSelected(row: number, col: number): boolean {
    if (start.row === -1) return false;

    const minR = Math.min(start.row, end.row);
    const maxR = Math.max(start.row, end.row);
    const minC = Math.min(start.col, end.col);
    const maxC = Math.max(start.col, end.col);
    
    return row >= minR && row <= maxR && col >= minC && col <= maxC;
  }

  function computeVisualOverlay(
    targetStart: GridCell,
    targetEnd: GridCell,
    visibleRange: { startIndex: number; endIndex: number },
    keys: string[],
    columnManager: ColumnWidthManager,
    rowHeight: number = 32
  ): VisualSelection | null {
    if (targetStart.row === -1 || targetEnd.row === -1) return null;

    const logicalMinRow = Math.min(targetStart.row, targetEnd.row);
    const logicalMaxRow = Math.max(targetStart.row, targetEnd.row);
    const logicalMinCol = Math.min(targetStart.col, targetEnd.col);
    const logicalMaxCol = Math.max(targetStart.col, targetEnd.col);

    const renderStartRow = Math.max(logicalMinRow, visibleRange.startIndex);
    const renderEndRow = Math.min(logicalMaxRow, visibleRange.endIndex - 1);

    if (renderStartRow > renderEndRow) return null;

    const relativeStartRow = renderStartRow - visibleRange.startIndex;
    const rowCount = renderEndRow - renderStartRow + 1;

    const top = relativeStartRow * rowHeight;
    const height = rowCount * rowHeight;

    let left = 0;
    let width = 0;

    for (let c = 0; c < keys.length; c++) {
      const colWidth = columnManager.getWidth(keys[c]);
      
      if (c < logicalMinCol) {
        left += colWidth;
      } else if (c >= logicalMinCol && c <= logicalMaxCol) {
        width += colWidth;
      } else if (c > logicalMaxCol) {
        break; 
      }
    }

    const showTopBorder = logicalMinRow >= visibleRange.startIndex;
    const showBottomBorder = logicalMaxRow < visibleRange.endIndex;

    return {
      top,
      left,
      width,
      height,
      isVisible: true,
      showTopBorder,
      showBottomBorder,
      showLeftBorder: true,
      showRightBorder: true
    };
  }

  function computeDirtyCellOverlays(
    visibleRange: { startIndex: number; endIndex: number },
    keys: string[],
    columnManager: ColumnWidthManager,
    rowHeight: number = 32
  ): VisualSelection[] {
    const overlays: VisualSelection[] = [];
    if (dirtyCells.size === 0) return overlays;

    const dirtyCoords = Array.from(dirtyCells).map(s => {
      const [row, col] = s.split(',').map(Number);
      return { row, col };
    });

    const dirtySet = new Set(dirtyCells);
    dirtyCoords.sort((a, b) => a.row - b.row || a.col - b.col);
    const groups: { minRow: number; minCol: number; maxRow: number; maxCol: number }[] = [];

    for (const coord of dirtyCoords) {
      const key = `${coord.row},${coord.col}`;
      if (!dirtySet.has(key)) continue;

      let { row: startRow, col: startCol } = coord;
      let maxRow = startRow, maxCol = startCol;

      while (dirtySet.has(`${startRow},${maxCol + 1}`)) maxCol++;

      let canExpandDown = true;
      while (canExpandDown) {
        for (let c = startCol; c <= maxCol; c++) {
          if (!dirtySet.has(`${maxRow + 1},${c}`)) {
            canExpandDown = false;
            break;
          }
        }
        if (canExpandDown) maxRow++;
      }
      
      groups.push({ minRow: startRow, minCol: startCol, maxRow, maxCol });

      for (let r = startRow; r <= maxRow; r++) {
        for (let c = startCol; c <= maxCol; c++) {
          dirtySet.delete(`${r},${c}`);
        }
      }
    }

    for (const group of groups) {
      const overlay = computeVisualOverlay(
        { row: group.minRow, col: group.minCol },
        { row: group.maxRow, col: group.maxCol },
        visibleRange,
        keys,
        columnManager,
        rowHeight
      );
      if (overlay) overlays.push(overlay);
    }

    return overlays;
  }

  // Return public API
  return {
    // State accessors
    get start() { return start },
    set start(val: GridCell) { start = val },
    get end() { return end },
    set end(val: GridCell) { end = val },
    get isSelecting() { return isSelecting },
    get copyStart() { return copyStart },
    get copyEnd() { return copyEnd },
    get isCopyVisible() { return isCopyVisible },
    get dirtyCells() { return dirtyCells },
    
    // Derived values (properties, not methods)
    get bounds() { return bounds },
    get hasSelection() { return hasSelection },
    get primaryRange() { return primaryRange },
    get anchor() { return anchor },
    
    // Actions
    setDirtyCells,
    clearDirtyCells,
    handleMouseDown,
    extendSelection,
    endSelection,
    moveTo,
    selectCell,
    snapshotAsCopied,
    clearCopyOverlay,
    reset,
    resetAll,
    isCellSelected,
    computeVisualOverlay,
    computeDirtyCellOverlays
  };
}

export type SelectionManager = ReturnType<typeof createSelectionManager>;

// Export as default instance (singleton pattern like realtime)
export const selection = createSelectionManager();