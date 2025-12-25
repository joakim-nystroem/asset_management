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
  // State: Logical Selection
  const state = $state({
    start: { row: -1, col: -1 } as GridCell,
    end: { row: -1, col: -1 } as GridCell,
    isSelecting: false,
    
    // Copied State (for the dashed box)
    copyStart: { row: -1, col: -1 } as GridCell,
    copyEnd: { row: -1, col: -1 } as GridCell,
    isCopyVisible: false,
    
    // Dirty Cell State
    dirtyCells: new Set<string>()
  });

  // Derived values
  const bounds = $derived.by(() => {
    if (state.start.row === -1 || state.end.row === -1) return null;
    return {
      minRow: Math.min(state.start.row, state.end.row),
      maxRow: Math.max(state.start.row, state.end.row),
      minCol: Math.min(state.start.col, state.end.col),
      maxCol: Math.max(state.start.col, state.end.col),
    };
  });

  const hasSelection = $derived(state.start.row !== -1);
  
  const primaryRange = $derived.by(() => {
    if (state.start.row === -1) return null;
    return { start: state.start, end: state.end };
  });

  const anchor = $derived(state.start.row !== -1 ? state.start : null);

  // Actions
  function setDirtyCells(cells: GridCell[]) {
    const newSet = new Set<string>();
    for (const cell of cells) {
      newSet.add(`${cell.row},${cell.col}`);
    }
    state.dirtyCells = newSet;
  }

  function clearDirtyCells() {
    state.dirtyCells = new Set<string>();
  }

  function handleMouseDown(row: number, col: number, e: MouseEvent) {
    if (e.button !== 0) return;

    state.isSelecting = true;

    if (e.shiftKey && state.start.row !== -1) {
      state.end = { row, col };
    } else {
      const isSingleCellSelected = 
        state.start.row === state.end.row && 
        state.start.col === state.end.col &&
        state.start.row !== -1;
      
      const clickingSameCell = state.start.row === row && state.start.col === col;
      
      if (isSingleCellSelected && clickingSameCell) {
        reset();
      } else {
        state.start = { row, col };
        state.end = { row, col };
      }
    }
  }

  function extendSelection(row: number, col: number) {
    if (state.isSelecting) {
      state.end = { row, col };
    }
  }

  function endSelection() {
    state.isSelecting = false;
  }

  function moveTo(row: number, col: number) {
    state.start = { row, col };
    state.end = { row, col };
  }

  function selectCell(row: number, col: number) {
    if (isCellSelected(row, col)) return;
    state.start = { row, col };
    state.end = { row, col };
  }

  function snapshotAsCopied() {
    if (state.start.row !== -1) {
      state.copyStart = { ...state.start };
      state.copyEnd = { ...state.end };
      state.isCopyVisible = true;
    }
  }

  function clearCopyOverlay() {
    state.isCopyVisible = false;
  }

  function reset() {
    state.start = { row: -1, col: -1 };
    state.end = { row: -1, col: -1 };
  }

  function resetAll() {
    reset();
    state.isCopyVisible = false;
  }

  function isCellSelected(row: number, col: number): boolean {
    if (state.start.row === -1) return false;

    const minR = Math.min(state.start.row, state.end.row);
    const maxR = Math.max(state.start.row, state.end.row);
    const minC = Math.min(state.start.col, state.end.col);
    const maxC = Math.max(state.start.col, state.end.col);
    
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
    if (state.dirtyCells.size === 0) return overlays;

    const dirtyCoords = Array.from(state.dirtyCells).map(s => {
      const [row, col] = s.split(',').map(Number);
      return { row, col };
    });

    const dirtySet = new Set(state.dirtyCells);
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
    get start() { return state.start },
    set start(val: GridCell) { state.start = val },
    get end() { return state.end },
    set end(val: GridCell) { state.end = val },
    get isSelecting() { return state.isSelecting },
    get copyStart() { return state.copyStart },
    get copyEnd() { return state.copyEnd },
    get isCopyVisible() { return state.isCopyVisible },
    get dirtyCells() { return state.dirtyCells },
    
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