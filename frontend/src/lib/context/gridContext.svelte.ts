import { createContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import type { FilterPanelState } from '$lib/grid/components/filter-panel/filterPanel.svelte.ts';
import type { SafeUser } from '$lib/types';
import type { createEditDropdown } from '$lib/grid/components/edit-dropdown/editDropdown.svelte.ts';
import type { createAutocomplete } from '$lib/grid/components/suggestion-menu/autocomplete.svelte.ts';

// ─── Shared primitive types ───────────────────────────────────────────────────

export type GridCell = { row: number; col: number };

export type ValidationConstraints = Record<string, string[]>;

// ─── Domain context types ─────────────────────────────────────────────────────

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

export type SelectionContext = {
  selectionStart: GridCell;
  selectionEnd: GridCell;
  isSelecting: boolean;
  isHiddenAfterCopy: boolean;
  dirtyCells: Set<string>;
};

export type ClipboardContext = {
  copyStart: GridCell;
  copyEnd: GridCell;
  isCopyVisible: boolean;
};

export type ColumnContext = {
  keys: string[];
  columnWidths: SvelteMap<string, number>;
  resizingColumn: string | null;
};

export type RowContext = {
  rowHeights: SvelteMap<number, number>;
};

export type SortContext = {
  sortKey: string | null;
  sortDirection: 'asc' | 'desc' | null;
};

export type ValidationContext = {
  validationConstraints: ValidationConstraints;
};

export type ChangeContext = {
  hasUnsavedChanges: boolean;
  hasInvalidChanges: boolean;
};

export type DataContext = {
  assets: Record<string, any>[];
  baseAssets: Record<string, any>[];
  filteredAssetsCount: number;
  user: SafeUser | null;
};

export type ViewContext = {
  activeView: string;
  virtualScroll: any;
  scrollToRow: number | null;
};

export type UiContext = {
  filterPanel: FilterPanelState | null;
  headerMenu: any | null;
  contextMenu: any | null;
  handleFilterSelect: ((item: string, key: string) => void) | null;
  applySort: ((key: string, dir: 'asc' | 'desc') => void) | null;
};

// ─── Domain context pairs ─────────────────────────────────────────────────────

export const [getEditingContext, setEditingContext] = createContext<EditingContext>();
export const [getSelectionContext, setSelectionContext] = createContext<SelectionContext>();
export const [getClipboardContext, setClipboardContext] = createContext<ClipboardContext>();
export const [getColumnContext, setColumnContext] = createContext<ColumnContext>();
export const [getRowContext, setRowContext] = createContext<RowContext>();
export const [getSortContext, setSortContext] = createContext<SortContext>();
export const [getValidationContext, setValidationContext] = createContext<ValidationContext>();
export const [getChangeContext, setChangeContext] = createContext<ChangeContext>();
export const [getDataContext, setDataContext] = createContext<DataContext>();
export const [getViewContext, setViewContext] = createContext<ViewContext>();
export const [getUiContext, setUiContext] = createContext<UiContext>();

// ─── Monolithic context (DEPRECATED — remove after all consumers migrate) ─────
// Kept for backward compatibility while components migrate to domain contexts.

export type GridContext = {
  // Edit state
  isEditing: boolean;
  editKey: string | null;
  editRow: number;
  editCol: number;
  editOriginalValue: string;
  editOriginalColumnWidth: number;
  inputValue: string;

  // Selection state
  selectionStart: GridCell;
  selectionEnd: GridCell;
  isSelecting: boolean;
  isHiddenAfterCopy: boolean;
  copyStart: GridCell;
  copyEnd: GridCell;
  isCopyVisible: boolean;
  dirtyCells: Set<string>;

  // Change / validation state
  hasUnsavedChanges: boolean;
  hasInvalidChanges: boolean;
  validationConstraints: ValidationConstraints;

  // Column/row geometry
  columnWidths: SvelteMap<string, number>;
  rowHeights: SvelteMap<number, number>;
  resizingColumn: string | null;

  // Sort state
  sortKey: string | null;
  sortDirection: 'asc' | 'desc' | null;

  // View state
  activeView: string;

  // Column keys
  keys: string[];

  // Phase 2 additions
  filteredAssetsCount: number;
  virtualScroll: any;
  scrollToRow: number | null;

  // Context-channel fields
  assets: Record<string, any>[];
  filterPanel: FilterPanelState | null;
  pageActions: {
    onSaveEdit: (value: string) => void;
    onCancelEdit: () => void;
    onEditAction: (action: string, row: number, col: number) => void;
    onCopy: () => void | Promise<void>;
    onPaste: () => void | Promise<void>;
    onUndo: () => void;
    onRedo: () => void;
    onEscape: () => void;
    onDeleteNewRow: () => void;
    user: SafeUser | null;
  } | null;
  editDropdown: ReturnType<typeof createEditDropdown> | null;
  autocomplete: ReturnType<typeof createAutocomplete> | null;

  // Header/sort state
  headerMenu: any | null;
  baseAssets: Record<string, any>[];
  applySort: ((key: string, dir: 'asc' | 'desc') => void) | null;
  handleFilterSelect: ((item: string, key: string) => void) | null;
  contextMenu: any | null;
};

export const [getGridContext, setGridContext] = createContext<GridContext>();
