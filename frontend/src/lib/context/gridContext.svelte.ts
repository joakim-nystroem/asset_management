import { createContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
// ─── Shared primitive types ───────────────────────────────────────────────────

export type GridCell = { row: number; col: string };

// ─── Domain context types ─────────────────────────────────────────────────────

// 1. Active cell editing trigger (which cell is being edited — UI state only)
export type EditingContext = {
  isEditing: boolean;
  isPasting: boolean;
  isUndoing: boolean;
  isRedoing: boolean;
  editRow: number;
  editCol: string;
};

// 2. Pending changes buffer (dirty edits between save and commit)
export type PendingContext = {
  edits: { row: number | string; col: string; original: string; value: string; isValid: boolean }[];
};

// 3. Undo/Redo stack
export type HistoryAction = {
  id: number | string;
  key: string;
  oldValue: string;
  newValue: string;
};

export type HistoryContext = {
  undoStack: HistoryAction[][];
  redoStack: HistoryAction[][];
};

// 4. Pending new rows
export type NewRowContext = {
  newRows: any[];
  hasNewRows: boolean;
  isValid: boolean;
};

// 5. Grid selection state
export type SelectionContext = {
  selectionStart: GridCell;
  selectionEnd: GridCell;
  isSelecting: boolean;
  hideSelection: boolean;
};

// 6. Copy/paste state
export type ClipboardContext = {
  copyStart: GridCell;
  copyEnd: GridCell;
  isCopying: boolean;
  /** Structured mini-grid from internal copy (rows × cols, top-left is [0][0]) */
  grid: string[][];
};

// 7. Row definitions
export type RowContext = {
  rowHeights: SvelteMap<number, number>;
};

// 8. Scroll state
export type ViewContext = {
  virtualScroll: any;
  scrollToRow: number | null;
  scrollToCol: { left: number; right: number } | null;
  scrollTop: number;
  scrollLeft: number;
};

// 9. UI panel states (mutually exclusive) + trigger flags
export type UiContext = {
  filterPanel: { visible: boolean };
  headerMenu: { visible: boolean; activeKey: string };
  contextMenu: { visible: boolean; x: number; y: number; row: number; col: string; value: string };
  commitRequested: boolean;
  commitCreateRequested: boolean;
  discardRequested: boolean;
};

export function setOpenPanel(uiCtx: UiContext, panel?: 'contextMenu' | 'headerMenu' | 'filterPanel') {
  if (panel !== 'contextMenu' && uiCtx.contextMenu.visible) uiCtx.contextMenu.visible = false;
  if (panel !== 'headerMenu' && uiCtx.headerMenu.visible) { uiCtx.headerMenu.activeKey = ''; uiCtx.headerMenu.visible = false; }
  if (panel !== 'filterPanel' && uiCtx.filterPanel.visible) uiCtx.filterPanel.visible = false;
}

// 11. Column width overrides (drag-resize)
export type ColumnWidthContext = {
  widths: import('svelte/reactivity').SvelteMap<string, number>;
};

// 12. Sort state (client-side reorder, cleared on search/filter/view change)
export type SortContext = {
  key: string | null;
  direction: 'asc' | 'desc';
};

// 10. Query state — view, search, and filters (replaces searchManager + activeView)
export type QueryContext = {
  view: string;
  q: string;
  filters: { key: string; value: string }[];
};

// ─── Domain context pairs ─────────────────────────────────────────────────────

export const [getEditingContext, setEditingContext] = createContext<EditingContext>();
export const [getPendingContext, setPendingContext] = createContext<PendingContext>();
export const [getHistoryContext, setHistoryContext] = createContext<HistoryContext>();
export const [getNewRowContext, setNewRowContext] = createContext<NewRowContext>();
export const [getSelectionContext, setSelectionContext] = createContext<SelectionContext>();
export const [getClipboardContext, setClipboardContext] = createContext<ClipboardContext>();
export const [getRowContext, setRowContext] = createContext<RowContext>();
export const [getViewContext, setViewContext] = createContext<ViewContext>();
export const [getUiContext, setUiContext] = createContext<UiContext>();
export const [getQueryContext, setQueryContext] = createContext<QueryContext>();
export const [getColumnWidthContext, setColumnWidthContext] = createContext<ColumnWidthContext>();
export const [getSortContext, setSortContext] = createContext<SortContext>();