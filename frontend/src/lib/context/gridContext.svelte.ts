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
  editValue: string;
};

// 2. Pending changes buffer (dirty edits between save and commit)
export type PendingContext = {
  edits: { row: number; col: string; original: string; value: string; isValid: boolean; validationError: string | null }[];
};

// 3. Undo/Redo stack
export type HistoryAction = {
  id: number;
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
};

// 5. Grid selection state
export type SelectionContext = {
  selectionStart: GridCell;
  selectionEnd: GridCell;
  isSelecting: boolean;
  hideSelection: boolean;
  pasteRange: { start: GridCell; end: GridCell } | null;
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

// 8. Scroll navigation signals — one-shot commands consumed by VirtualScrollManager owner (e.g. GridContainer).
// Lives in context because writers (Toolbar, EventListener) and consumers are siblings under GridContextProvider.
export type ScrollSignalContext = {
  scrollToRow: number | null;
  scrollToCol: { left: number; right: number } | null;
  isAutoScrolling: boolean;
};

// 9. UI panel states (mutually exclusive) + trigger flags
export type UiContext = {
  filterPanel: { visible: boolean };
  headerMenu: { visible: boolean; activeKey: string };
  contextMenu: { visible: boolean; x: number; y: number; row: number; col: string; value: string };
  suggestionMenu: { visible: boolean };
};

export function resetEditing(ctx: EditingContext) {
  ctx.isEditing = false;
  ctx.editRow = -1;
  ctx.editCol = '';
  ctx.editValue = '';
}

export function setOpenPanel(uiCtx: UiContext, panel?: 'contextMenu' | 'headerMenu' | 'filterPanel' | 'suggestionMenu') {
  if (panel !== 'contextMenu' && uiCtx.contextMenu.visible) uiCtx.contextMenu.visible = false;
  if (panel !== 'headerMenu' && uiCtx.headerMenu.visible) { uiCtx.headerMenu.activeKey = ''; uiCtx.headerMenu.visible = false; }
  if (panel !== 'filterPanel' && uiCtx.filterPanel.visible) uiCtx.filterPanel.visible = false;
  if (panel !== 'suggestionMenu' && uiCtx.suggestionMenu.visible) uiCtx.suggestionMenu.visible = false;
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

// ─── Domain context pairs ─────────────────────────────────────────────────────

export const [getEditingContext, setEditingContext] = createContext<EditingContext>();
export const [getPendingContext, setPendingContext] = createContext<PendingContext>();
export const [getHistoryContext, setHistoryContext] = createContext<HistoryContext>();
export const [getNewRowContext, setNewRowContext] = createContext<NewRowContext>();
export const [getSelectionContext, setSelectionContext] = createContext<SelectionContext>();
export const [getClipboardContext, setClipboardContext] = createContext<ClipboardContext>();
export const [getRowContext, setRowContext] = createContext<RowContext>();
export const [getScrollSignalContext, setScrollSignalContext] = createContext<ScrollSignalContext>();
export const [getUiContext, setUiContext] = createContext<UiContext>();
export const [getColumnWidthContext, setColumnWidthContext] = createContext<ColumnWidthContext>();
export const [getSortContext, setSortContext] = createContext<SortContext>();