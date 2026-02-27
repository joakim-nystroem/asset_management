import { createContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import type { FilterPanelState } from '$lib/grid/components/filter-panel/filterPanel.svelte.ts';
import type { SafeUser } from '$lib/types';
import type { createEditDropdown } from '$lib/grid/components/edit-dropdown/editDropdown.svelte.ts';
import type { createAutocomplete } from '$lib/grid/components/suggestion-menu/autocomplete.svelte.ts';
import type { Filter } from '$lib/data/searchManager.svelte';
import type { ChangeController } from '$lib/grid/utils/gridChanges.svelte.ts';
import type { HistoryController } from '$lib/grid/utils/gridHistory.svelte.ts';
import type { RowGenerationController } from '$lib/grid/utils/rowGeneration.svelte.ts';

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
  // Action callbacks (set by EventListener)
  commit?: () => Promise<void>;
  discard?: () => void;
  addRows?: () => Promise<void>;
  addNewRow?: () => Promise<void>;
  navigateError?: (direction: 'next' | 'prev') => void;
  viewChange?: (viewName: string) => void;
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
  // URL helpers (set by EventListener)
  getCurrentUrlState?: () => { q: string; filters: Filter[]; view: string };
  updateSearchUrl?: (params: { q?: string; filters?: Filter[]; view?: string }) => void;
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

// ─── Controller instance contexts ─────────────────────────────────────────────
// These hold the actual controller instances (with their local $state),
// allowing sibling components to share the same instance rather than each
// creating independent instances via the factory functions.

export const [getChangeControllerContext, setChangeControllerContext] = createContext<ChangeController>();
export const [getHistoryControllerContext, setHistoryControllerContext] = createContext<HistoryController>();
export const [getRowGenControllerContext, setRowGenControllerContext] = createContext<RowGenerationController>();

