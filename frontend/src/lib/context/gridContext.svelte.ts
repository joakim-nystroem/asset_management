import { createContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import type { FilterPanelState } from '$lib/grid/components/filter-panel/filterPanel.svelte.ts';

// ─── Shared primitive types ───────────────────────────────────────────────────

export type GridCell = { row: number; col: number };

// ─── Domain context types ─────────────────────────────────────────────────────

// 1. Active cell editing trigger (which cell is being edited — UI state only)
export type EditingContext = {
  isEditing: boolean;
  isPasting: boolean;
  editRow: number;
  editCol: number;
};

// 2. Pending changes buffer (dirty edits between save and commit)
export type PendingContext = {
  edits: { row: number | string; col: string; original: string; value: string; isValid: boolean }[];
};

// 3. Undo/Redo stack
export type HistoryContext = {
  undoStack: any[];
  redoStack: any[];
  canUndo: boolean;
  canRedo: boolean;
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
  hasPasted: boolean;
  dirtyCells: Set<string>;
};

// 6. Copy/paste state
export type ClipboardContext = {
  copyStart: GridCell;
  copyEnd: GridCell;
  isCopying: boolean;
};

// 7. Row definitions
export type RowContext = {
  rowHeights: SvelteMap<number, number>;
};

// 9. Scroll state
export type ViewContext = {
  virtualScroll: any;
  scrollToRow: number | null;
  scrollToCol: { left: number; right: number } | null;
};

// 10. UI panel states (mutually exclusive) + trigger flags
export type UiContext = {
  filterPanel: FilterPanelState | null;
  headerMenu: any | null;
  contextMenu: any | null;
  commitRequested: boolean;
  commitCreateRequested: boolean;
  discardRequested: boolean;
};

// 11. Query state — view, search, and filters (replaces searchManager + activeView)
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