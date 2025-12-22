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

export class SelectionManager {
  // State: Logical Selection
  // 'start' is the anchor (where you clicked down)
  // 'end' is the focus (where you dragged to)
  start = $state<GridCell>({ row: -1, col: -1 });
  end = $state<GridCell>({ row: -1, col: -1 });
  
  isSelecting = $state(false);

  // Copied State (for the dashed box)
  copyStart = $state<GridCell>({ row: -1, col: -1 });
  copyEnd = $state<GridCell>({ row: -1, col: -1 });
  isCopyVisible = $state(false);

  // --- NEW: Dirty Cell State ---
  dirtyCells = $state(new Set<string>());

  setDirtyCells(cells: GridCell[]) {
    const newSet = new Set<string>();
    for (const cell of cells) {
      newSet.add(`${cell.row},${cell.col}`);
    }

    this.dirtyCells = newSet;
  }

  clearDirtyCells() {
    this.dirtyCells = new Set<string>();
  }

  computeDirtyCellOverlays(
    visibleRange: { startIndex: number; endIndex: number },
    keys: string[],
    columnManager: ColumnWidthManager,
    rowHeight: number = 32
  ): VisualSelection[] {
    const overlays: VisualSelection[] = [];
    if (this.dirtyCells.size === 0) {
        return overlays;
    }

    const dirtyCoords = Array.from(this.dirtyCells).map(s => {
        const [row, col] = s.split(',').map(Number);
        return { row, col };
    });

    const dirtySet = new Set(this.dirtyCells);
    dirtyCoords.sort((a, b) => a.row - b.row || a.col - b.col);
    const groups: { minRow: number; minCol: number; maxRow: number; maxCol: number }[] = [];

    for (const coord of dirtyCoords) {
        const key = `${coord.row},${coord.col}`;
        if (!dirtySet.has(key)) continue;

        let { row: startRow, col: startCol } = coord;
        let maxRow = startRow, maxCol = startCol;

        // Expand right as far as possible
        while (dirtySet.has(`${startRow},${maxCol + 1}`)) {
            maxCol++;
        }

        // Expand down as far as possible
        let canExpandDown = true;
        while (canExpandDown) {
            for (let c = startCol; c <= maxCol; c++) {
                if (!dirtySet.has(`${maxRow + 1},${c}`)) {
                    canExpandDown = false;
                    break;
                }
            }
            if (canExpandDown) {
                maxRow++;
            }
        }
        
        groups.push({ minRow: startRow, minCol: startCol, maxRow, maxCol });

        // Remove the cells of the found rectangle from the processing set
        for (let r = startRow; r <= maxRow; r++) {
            for (let c = startCol; c <= maxCol; c++) {
                dirtySet.delete(`${r},${c}`);
            }
        }
    }

    for (const group of groups) {
        const overlay = this.computeVisualOverlay(
            { row: group.minRow, col: group.minCol },
            { row: group.maxRow, col: group.maxCol },
            visibleRange,
            keys,
            columnManager,
            rowHeight
        );
        if (overlay) {
            overlays.push(overlay);
        }
    }

    return overlays;
  }

  /**
   * Handle Mouse Down on a cell
   */
  handleMouseDown(row: number, col: number, e: MouseEvent) {
    if (e.button !== 0) return;

    this.isSelecting = true;

    // Shift Key: Extend Selection from existing Anchor
    if (e.shiftKey && this.start.row !== -1) {
      this.end = { row, col };
    } 

    else {
      const isSingleCellSelected = this.start.row === this.end.row && 
                                    this.start.col === this.end.col &&
                                    this.start.row !== -1;
      
      const clickingSameCell = this.start.row === row && this.start.col === col;
      
      if (isSingleCellSelected && clickingSameCell) {
        // Deselect
        this.reset();
      } else {
        // Normal selection
        this.start = { row, col };
        this.end = { row, col };
      }
    }
  }

  /**
   * Handle Mouse Enter (Drag)
   */
  extendSelection(row: number, col: number) {
    if (this.isSelecting) {
      this.end = { row, col };
    }
  }

  endSelection() {
    this.isSelecting = false;
  }

  /**
   * Programmatic Move / Keyboard Navigation
   */
  moveTo(row: number, col: number) {
    this.start = { row, col };
    this.end = { row, col };
  }

  /**
   * Select specific cell (Context menu or programmatic)
   */
  selectCell(row: number, col: number) {
    // If cell is already inside the current rectangular selection, don't reset
    if (this.isCellSelected(row, col)) return;

    this.start = { row, col };
    this.end = { row, col };
  }

  /**
   * Snapshot current selection for the dashed "Copy" border
   */
  snapshotAsCopied() {
    if (this.start.row !== -1) {
      this.copyStart = { ...this.start };
      this.copyEnd = { ...this.end };
      this.isCopyVisible = true;
    }
  }

  clearCopyOverlay() {
    this.isCopyVisible = false;
  }

  reset() {
    this.start = { row: -1, col: -1 };
    this.end = { row: -1, col: -1 };
  }

  resetAll() {
    this.reset();
    this.isCopyVisible = false;
  }

  /**
   * Get the bounding box of the selection (Logical)
   */
  getBounds() {
    if (this.start.row === -1 || this.end.row === -1) return null;

    return {
      minRow: Math.min(this.start.row, this.end.row),
      maxRow: Math.max(this.start.row, this.end.row),
      minCol: Math.min(this.start.col, this.end.col),
      maxCol: Math.max(this.start.col, this.end.col),
    };
  }

  getPrimaryRange() {
    if (this.start.row === -1) return null;
    return { start: this.start, end: this.end };
  }

  hasSelection() {
    return this.start.row !== -1;
  }

  getAnchor(): GridCell | null {
    return this.start.row !== -1 ? this.start : null;
  }

  isCellSelected(row: number, col: number): boolean {
    if (this.start.row === -1) return false;

    const minR = Math.min(this.start.row, this.end.row);
    const maxR = Math.max(this.start.row, this.end.row);
    const minC = Math.min(this.start.col, this.end.col);
    const maxC = Math.max(this.start.col, this.end.col);
    
    return row >= minR && row <= maxR && col >= minC && col <= maxC;
  }

  /**
   * PURE MATH: Calculate the style/position of an overlay based on state
   * strictly using data indices and column widths, no DOM querying.
   */
  computeVisualOverlay(
    targetStart: GridCell,
    targetEnd: GridCell,
    visibleRange: { startIndex: number; endIndex: number },
    keys: string[],
    columnManager: ColumnWidthManager,
    rowHeight: number = 32
  ): VisualSelection | null {
    if (targetStart.row === -1 || targetEnd.row === -1) return null;

    // 1. Determine Logical Bounds
    const logicalMinRow = Math.min(targetStart.row, targetEnd.row);
    const logicalMaxRow = Math.max(targetStart.row, targetEnd.row);
    const logicalMinCol = Math.min(targetStart.col, targetEnd.col);
    const logicalMaxCol = Math.max(targetStart.col, targetEnd.col);

    // 2. Determine Intersection with Visible Viewport
    // The rendered container starts at visibleRange.startIndex.
    // The indices inside the container are relative to that start.
    
    // Rows
    const renderStartRow = Math.max(logicalMinRow, visibleRange.startIndex);
    const renderEndRow = Math.min(logicalMaxRow, visibleRange.endIndex - 1);

    // If completely out of view
    if (renderStartRow > renderEndRow) {
      return null;
    }

    // 3. Calculate Vertical Geometry (Relative to the transformed container)
    // The container is transformed translateY(visibleRange.startIndex * rowHeight)
    // So row `visibleRange.startIndex` is at 0px inside the container.
    const relativeStartRow = renderStartRow - visibleRange.startIndex;
    const rowCount = renderEndRow - renderStartRow + 1;

    const top = relativeStartRow * rowHeight;
    const height = rowCount * rowHeight;

    // 4. Calculate Horizontal Geometry
    let left = 0;
    let width = 0;

    // We assume columns are not virtualized for x-axis summation (or are cheap enough loop)
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

    // 5. Border Logic (Clipping)
    // If the logical start is visible, show top border. Otherwise hidden.
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
      showLeftBorder: true,  // Always true unless implementing column virtualization
      showRightBorder: true
    };
  }
}