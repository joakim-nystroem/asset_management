import { SvelteMap } from 'svelte/reactivity';

// ─── Types ───────────────────────────────────────────────────

export type GridCell = { row: number; col: string };

export type HistoryAction = {
  id: number;
  key: string;
  oldValue: string;
  newValue: string;
};

export type PendingEdit = {
  row: number;
  col: string;
  original: string;
  value: string;
  isValid: boolean;
  validationError: string | null;
};

// ─── Stores ──────────────────────────────────────────────────

export const editingStore = $state({
  isEditing: false,
  isPasting: false,
  isUndoing: false,
  isRedoing: false,
  editRow: -1,
  editCol: '',
  editValue: '',
});

export const pendingStore = $state({
  edits: [] as PendingEdit[],
});

export const historyStore = $state({
  undoStack: [] as HistoryAction[][],
  redoStack: [] as HistoryAction[][],
});

export const selectionStore = $state({
  selectionStart: { row: -1, col: '' } as GridCell,
  selectionEnd: { row: -1, col: '' } as GridCell,
  isSelecting: false,
  hideSelection: false,
  pasteRange: null as { start: GridCell; end: GridCell } | null,
});

export const clipboardStore = $state({
  copyStart: { row: -1, col: '' } as GridCell,
  copyEnd: { row: -1, col: '' } as GridCell,
  isCopying: false,
  grid: [] as string[][],
});

