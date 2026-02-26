// src/lib/grid/utils/gridSelection.svelte.ts
//
// Co-located selection controller — replaces utils/interaction/selectionManager.svelte.ts.
// State lives in domain contexts (cross-component: GridRow, GridOverlays, GridHeader, InventoryGrid
// all need selection state). The controller provides the methods; the state fields are in context.

import { getSelectionContext, getClipboardContext } from '$lib/context/gridContext.svelte.ts';

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

export function createSelectionController() {
  const selCtx = getSelectionContext();
  const clipCtx = getClipboardContext();

  // --- Actions ---

  function setDirtyCells(cells: GridCell[]) {
    const newSet = new Set<string>();
    for (const cell of cells) {
      newSet.add(`${cell.row},${cell.col}`);
    }
    selCtx.dirtyCells = newSet;
  }

  function clearDirtyCells() {
    selCtx.dirtyCells = new Set<string>();
  }

  function handleMouseDown(row: number, col: number, e: MouseEvent) {
    if (e.button !== 0) return;

    selCtx.isHiddenAfterCopy = false;
    selCtx.isSelecting = true;

    if (e.shiftKey && selCtx.selectionStart.row !== -1) {
      selCtx.selectionEnd = { row, col };
    } else {
      const isSingleCellSelected =
        selCtx.selectionStart.row === selCtx.selectionEnd.row &&
        selCtx.selectionStart.col === selCtx.selectionEnd.col &&
        selCtx.selectionStart.row !== -1;

      const clickingSameCell =
        selCtx.selectionStart.row === row && selCtx.selectionStart.col === col;

      if (isSingleCellSelected && clickingSameCell) {
        reset();
      } else {
        selCtx.selectionStart = { row, col };
        selCtx.selectionEnd = { row, col };
      }
    }
  }

  function extendSelection(row: number, col: number) {
    if (selCtx.isSelecting) {
      selCtx.isHiddenAfterCopy = false;
      selCtx.selectionEnd = { row, col };
    }
  }

  function endSelection() {
    selCtx.isSelecting = false;
  }

  function moveTo(row: number, col: number) {
    selCtx.isHiddenAfterCopy = false;
    selCtx.selectionStart = { row, col };
    selCtx.selectionEnd = { row, col };
  }

  function selectCell(row: number, col: number) {
    if (isCellSelected(row, col)) return;
    selCtx.isHiddenAfterCopy = false;
    selCtx.selectionStart = { row, col };
    selCtx.selectionEnd = { row, col };
  }

  function snapshotAsCopied() {
    if (selCtx.selectionStart.row !== -1) {
      clipCtx.copyStart = { ...selCtx.selectionStart };
      clipCtx.copyEnd = { ...selCtx.selectionEnd };
      clipCtx.isCopyVisible = true;
      selCtx.isHiddenAfterCopy = true;
    }
  }

  function clearCopyOverlay() {
    clipCtx.isCopyVisible = false;
  }

  function reset() {
    selCtx.selectionStart = { row: -1, col: -1 };
    selCtx.selectionEnd = { row: -1, col: -1 };
  }

  function resetAll() {
    reset();
    clipCtx.isCopyVisible = false;
    selCtx.isHiddenAfterCopy = false;
  }

  function isCellSelected(row: number, col: number): boolean {
    if (selCtx.selectionStart.row === -1) return false;

    const minR = Math.min(selCtx.selectionStart.row, selCtx.selectionEnd.row);
    const maxR = Math.max(selCtx.selectionStart.row, selCtx.selectionEnd.row);
    const minC = Math.min(selCtx.selectionStart.col, selCtx.selectionEnd.col);
    const maxC = Math.max(selCtx.selectionStart.col, selCtx.selectionEnd.col);

    return row >= minR && row <= maxR && col >= minC && col <= maxC;
  }

  // --- Overlay computation (pure functions, no state writes) ---

  function computeVisualOverlay(
    targetStart: GridCell,
    targetEnd: GridCell,
    visibleRange: { startIndex: number; endIndex: number },
    keys: string[],
    getWidth: (key: string) => number,
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
      const colWidth = getWidth(keys[c]);

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
      showRightBorder: true,
    };
  }

  function computeDirtyCellOverlays(
    visibleRange: { startIndex: number; endIndex: number },
    keys: string[],
    getWidth: (key: string) => number,
    rowHeight: number = 32,
    isCellInvalid?: (row: number, col: number) => boolean
  ): VisualSelection[] {
    const overlays: VisualSelection[] = [];
    if (selCtx.dirtyCells.size === 0) return overlays;

    const dirtyCoords = Array.from(selCtx.dirtyCells).map((s) => {
      const [row, col] = s.split(',').map(Number);
      return { row, col };
    });

    const dirtySet = new Set(selCtx.dirtyCells);
    dirtyCoords.sort((a, b) => a.row - b.row || a.col - b.col);
    const groups: {
      minRow: number;
      minCol: number;
      maxRow: number;
      maxCol: number;
    }[] = [];

    for (const coord of dirtyCoords) {
      const key = `${coord.row},${coord.col}`;
      if (!dirtySet.has(key)) continue;

      const { row: startRow, col: startCol } = coord;

      // Determine the validity of the "seed" cell for this group.
      // If no callback is provided, treat all as "same" (fallback to old behavior).
      const isStartInvalid = isCellInvalid
        ? isCellInvalid(startRow, startCol)
        : false;

      let maxRow = startRow;
      let maxCol = startCol;

      // Expand Right — check that next cell is dirty AND has the same validity status
      while (
        dirtySet.has(`${startRow},${maxCol + 1}`) &&
        (!isCellInvalid ||
          isCellInvalid(startRow, maxCol + 1) === isStartInvalid)
      ) {
        maxCol++;
      }

      // Expand Down — each row must be fully covered and have matching validity
      let canExpandDown = true;
      while (canExpandDown) {
        for (let c = startCol; c <= maxCol; c++) {
          const nextRow = maxRow + 1;
          if (
            !dirtySet.has(`${nextRow},${c}`) ||
            (isCellInvalid && isCellInvalid(nextRow, c) !== isStartInvalid)
          ) {
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
        getWidth,
        rowHeight
      );
      if (overlay) overlays.push(overlay);
    }

    return overlays;
  }

  // --- Public API ---
  return {
    // State accessors (read from context)
    get start() {
      return selCtx.selectionStart;
    },
    set start(val: GridCell) {
      selCtx.selectionStart = val;
    },
    get end() {
      return selCtx.selectionEnd;
    },
    set end(val: GridCell) {
      selCtx.selectionEnd = val;
    },
    get isSelecting() {
      return selCtx.isSelecting;
    },
    get isSelectionVisible() {
      return selCtx.selectionStart.row !== -1 && !selCtx.isHiddenAfterCopy;
    },
    get copyStart() {
      return clipCtx.copyStart;
    },
    get copyEnd() {
      return clipCtx.copyEnd;
    },
    get isCopyVisible() {
      return clipCtx.isCopyVisible;
    },
    get dirtyCells() {
      return selCtx.dirtyCells;
    },

    // Derived values
    get bounds() {
      if (selCtx.selectionStart.row === -1 || selCtx.selectionEnd.row === -1)
        return null;
      return {
        minRow: Math.min(selCtx.selectionStart.row, selCtx.selectionEnd.row),
        maxRow: Math.max(selCtx.selectionStart.row, selCtx.selectionEnd.row),
        minCol: Math.min(selCtx.selectionStart.col, selCtx.selectionEnd.col),
        maxCol: Math.max(selCtx.selectionStart.col, selCtx.selectionEnd.col),
      };
    },
    get hasSelection() {
      return selCtx.selectionStart.row !== -1;
    },
    get primaryRange() {
      if (selCtx.selectionStart.row === -1) return null;
      return { start: selCtx.selectionStart, end: selCtx.selectionEnd };
    },
    get anchor() {
      return selCtx.selectionStart.row !== -1 ? selCtx.selectionStart : null;
    },

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
    computeDirtyCellOverlays,
  };
}

export type SelectionController = ReturnType<typeof createSelectionController>;
