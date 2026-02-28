import { createContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import type { FilterPanelState } from '$lib/grid/components/filter-panel/filterPanel.svelte.ts';
import type { createEditDropdown } from '$lib/grid/components/edit-dropdown/editDropdown.svelte.ts';
import type { createAutocomplete } from '$lib/grid/components/suggestion-menu/autocomplete.svelte.ts';

// ─── Shared primitive types ───────────────────────────────────────────────────

export type GridCell = { row: number; col: number };

// ─── Domain context types ─────────────────────────────────────────────────────

// 1. Active cell editing state (UI state for the Floating Editor)
export type EditingContext = {
  isEditing: boolean;
  editKey: string | null;
  editRow: number;
  editCol: number;
  editOriginalValue: string;
  editOriginalColumnWidth: number;
  inputValue: string;
  editDropdown: ReturnType<typeof createEditDropdown> | null;
  autocomplete: ReturnType<typeof createAutocomplete> | null;
};

// 2. Uncommitted changes and validation results
export type EditContext = {
  edits: any[]; 
  hasUnsavedChanges: boolean;
  isValid: boolean;
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
  isHiddenAfterCopy: boolean;
  dirtyCells: Set<string>;
};

// 6. Copy/paste state
export type ClipboardContext = {
  copyStart: GridCell;
  copyEnd: GridCell;
  isCopyVisible: boolean;
};

// 7. Column definitions
export type ColumnContext = {
  keys: string[];
  columnWidths: SvelteMap<string, number>;
  resizingColumn: string | null;
};

// 8. Row definitions
export type RowContext = {
  rowHeights: SvelteMap<number, number>;
};

// 9. View and scroll state
export type ViewContext = {
  activeView: string;
  virtualScroll: any;
  scrollToRow: number | null;
};

// 10. UI trigger flags and menus
export type UiContext = {
  // Ephemeral UI State
  filterPanel: FilterPanelState | null;
  headerMenu: any | null;
  contextMenu: any | null;
  
  // Ephemeral Trigger Flags for EventListener
  commitRequested: boolean;
  commitCreateRequested: boolean;
  discardRequested: boolean;
  searchRequested: boolean;
};

// ─── Domain context pairs ─────────────────────────────────────────────────────

export const [getEditingContext, setEditingContext] = createContext<EditingContext>();
export const [getEditContext, setEditContext] = createContext<EditContext>();
export const [getHistoryContext, setHistoryContext] = createContext<HistoryContext>();
export const [getNewRowContext, setNewRowContext] = createContext<NewRowContext>();
export const [getSelectionContext, setSelectionContext] = createContext<SelectionContext>();
export const [getClipboardContext, setClipboardContext] = createContext<ClipboardContext>();
export const [getColumnContext, setColumnContext] = createContext<ColumnContext>();
export const [getRowContext, setRowContext] = createContext<RowContext>();
export const [getViewContext, setViewContext] = createContext<ViewContext>();
export const [getUiContext, setUiContext] = createContext<UiContext>();