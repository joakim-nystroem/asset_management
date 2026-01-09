import type { SelectionManager } from './selectionManager.svelte';
import type { ColumnWidthManager } from '../core/columnManager.svelte';
import type { ContextMenuState } from '../ui/contextMenu/contextMenu.svelte.ts';
import type { HeaderMenuState } from '../ui/headerMenu/headerMenu.svelte.ts';

export type GridCell = { row: number; col: number };

export type InteractionCallbacks = {
  onCopy: () => void | Promise<void>;
  onPaste: () => void | Promise<void>;
  onUndo: () => void;
  onRedo: () => void;
  onEscape: () => void;
  onEdit: () => void;
  onScrollIntoView: (row: number, col: number) => void;
  getGridSize: () => { rows: number; cols: number };
};

export function createInteractionHandler(
  state: {
    selection: SelectionManager;
    columnManager: ColumnWidthManager;
    contextMenu: ContextMenuState;
    headerMenu: HeaderMenuState;
  },
  callbacks: InteractionCallbacks
) {
  // --- Keyboard Logic ---
  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable;

    if (isInput) return;

    // Escape - Clear everything
    if (e.key === 'Escape') {
      callbacks.onEscape();
      return;
    }

    if (e.key === 'F2') {
        e.preventDefault();
        callbacks.onEdit();
        return;
      }

    // Ctrl/Cmd shortcuts
    if (e.metaKey || e.ctrlKey) {
      const key = e.key.toLowerCase();

      if (key === 'z') {
        e.preventDefault();
        callbacks.onUndo();
        return;
      }

      if (key === 'y') {
        e.preventDefault();
        callbacks.onRedo();
        return;
      }

      if (key === 'c') {
        e.preventDefault();
        callbacks.onCopy();
        return;
      }

      if (key === 'v') {
        e.preventDefault();
        callbacks.onPaste();
        return;
      }
    }

    // Arrow key navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault(); // Prevent page scroll

      const { rows, cols } = callbacks.getGridSize();
      const { selection } = state;
      
      // FIX: Changed from selection.getPrimaryRange() to selection.primaryRange
      // primaryRange is a getter property, not a method
      const primary = selection.primaryRange;
      if (!primary) return;

      // Handle Ctrl + Arrow (Jump/Extend to Edge)
      if (e.metaKey || e.ctrlKey) {
        let targetRow = primary.end.row;
        let targetCol = primary.end.col;

        switch (e.key) {
          case 'ArrowUp': 
            targetRow = 0;
            break;
          case 'ArrowDown': 
            targetRow = rows - 1;
            break;
          case 'ArrowLeft': 
            targetCol = 0; 
            break;
          case 'ArrowRight': 
            targetCol = cols - 1;
            break;
        }

        if (e.shiftKey) {
            // Update the end of the last range directly (Extend to Edge)
            selection.end = { row: targetRow, col: targetCol };
        } else {
            // Move entire selection (Jump to Edge)
            selection.moveTo(targetRow, targetCol);
        }
        
        callbacks.onScrollIntoView(targetRow, targetCol);
        return;
      }

      // Standard Arrow Navigation
      if (e.shiftKey) {
        // Shift + Arrow: Extend active selection range
        const next = getKeyboardNavigation(e, primary.end, rows, cols);

        if (next) {
          selection.end = next;
          callbacks.onScrollIntoView(next.row, next.col);
        }
      } else {
        // Arrow only: Move selection (reset to single cell)
        const current = primary.start; 
        const next = getKeyboardNavigation(e, current, rows, cols);

        if (next) {
          selection.moveTo(next.row, next.col);
          callbacks.onScrollIntoView(next.row, next.col);
        }
      }
    }
  }

  // --- Mouse Logic ---

  function handleWindowClick(e: MouseEvent) {
    if (state.contextMenu.visible) {
        state.contextMenu.close();
    }
    state.headerMenu.handleOutsideClick(e);
  }

  function handleWindowMouseMove(e: MouseEvent) {
    if (state.columnManager.resizingColumn) {
      e.preventDefault();
      state.columnManager.updateResize(e.clientX);
    }
  }

  function handleWindowMouseUp() {
    if (state.columnManager.resizingColumn) {
      state.columnManager.endResize();
      document.body.style.cursor = ''; 
    }
    state.selection.endSelection();
  }

  // --- Mounter (for $effect) ---
  return function mount(window: Window) {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleWindowClick);
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleWindowClick);
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  };
}

// Helper: Arrow Navigation Calculation
function getKeyboardNavigation(
  e: KeyboardEvent,
  current: GridCell,
  rowCount: number,
  colCount: number
): GridCell | null {
  const { row, col } = current;

  switch (e.key) {
    case 'ArrowUp':
      return row > 0 ? { row: row - 1, col } : null;
    case 'ArrowDown':
      return row < rowCount - 1 ? { row: row + 1, col } : null;
    case 'ArrowLeft':
      return col > 0 ? { row, col: col - 1 } : null;
    case 'ArrowRight':
      return col < colCount - 1 ? { row, col: col + 1 } : null;
    default:
      return null;
  }
}