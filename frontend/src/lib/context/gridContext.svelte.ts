import { createContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';

export type GridCell = { row: number; col: number };

export type ValidationConstraints = Record<string, string[]>;

export type GridContext = {
  // Edit state (from editManager)
  isEditing: boolean;
  editKey: string | null;           // which column key is being edited
  editRow: number;                  // -1 when not editing
  editCol: number;                  // -1 when not editing
  editOriginalValue: string;
  editOriginalColumnWidth: number;
  inputValue: string;

  // Selection state (from selectionManager)
  selectionStart: GridCell;
  selectionEnd: GridCell;
  isSelecting: boolean;
  isHiddenAfterCopy: boolean;
  copyStart: GridCell;
  copyEnd: GridCell;
  isCopyVisible: boolean;
  dirtyCells: Set<string>;          // "row,col" strings

  // Change / validation state (from changeManager + validationManager)
  hasUnsavedChanges: boolean;
  hasInvalidChanges: boolean;
  validationConstraints: ValidationConstraints;

  // Column/row geometry (from columnManager + rowManager)
  columnWidths: SvelteMap<string, number>;
  rowHeights: SvelteMap<number, number>;  // rowIndex -> height
  resizingColumn: string | null;

  // Sort state (from sortManager)
  sortKey: string | null;
  sortDirection: 'asc' | 'desc' | null;

  // View state (from viewManager)
  activeView: string;

  // Column keys (from +page.svelte)
  keys: string[];

  // Phase 2 additions — page-level shared state
  filteredAssetsCount: number;    // length of filteredAssets; read by GridOverlays and ContextMenu to distinguish new vs existing rows
  virtualScroll: any;             // single shared virtualScroll instance; typed as any to avoid circular import — will be tightened in Plan 02-03 directory restructure
  scrollToRow: number | null;     // page sets to a row index when navigation needed; GridContainer observes via $effect, calls ensureVisible, resets to null
};

export const [getGridContext, setGridContext] = createContext<GridContext>();
