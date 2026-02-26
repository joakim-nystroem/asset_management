import { getColumnContext } from '$lib/context/gridContext.svelte.ts';

const DEFAULT_WIDTH = 150;
const MIN_WIDTH = 50;

export function createColumnController() {
  const colCtx = getColumnContext();  // safe: called during component init

  // Resize tracking (transient, local to this controller instance)
  let startX = $state(0);
  let startWidth = $state(0);

  function getWidth(key: string): number {
    return colCtx.columnWidths.get(key) ?? DEFAULT_WIDTH;
  }

  function setWidth(key: string, width: number) {
    colCtx.columnWidths.set(key, Math.max(MIN_WIDTH, width));
  }

  function resetWidth(key: string) {
    colCtx.columnWidths.delete(key);
  }

  function startResize(key: string, clientX: number) {
    colCtx.resizingColumn = key;
    startX = clientX;
    startWidth = getWidth(key);
  }

  function updateResize(currentX: number) {
    if (!colCtx.resizingColumn) return;
    setWidth(colCtx.resizingColumn, startWidth + (currentX - startX));
  }

  function endResize() {
    colCtx.resizingColumn = null;
  }

  function resetAll() {
    colCtx.columnWidths.clear();
  }

  function loadFromStorage(storageKey: string) {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        for (const [key, value] of Object.entries(parsed)) {
          colCtx.columnWidths.set(key, Number(value));
        }
      }
    } catch (err) {
      console.error('Failed to load column widths:', err);
    }
  }

  function saveToStorage(storageKey: string) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(colCtx.columnWidths)));
    } catch (err) {
      console.error('Failed to save column widths:', err);
    }
  }

  function getAllWidths(): Record<string, number> {
    return Object.fromEntries(colCtx.columnWidths.entries());
  }

  return {
    get resizingColumn() { return colCtx.resizingColumn; },
    getWidth,
    setWidth,
    resetWidth,
    startResize,
    updateResize,
    endResize,
    resetAll,
    loadFromStorage,
    saveToStorage,
    getAllWidths,
  };
}

export type ColumnController = ReturnType<typeof createColumnController>;
