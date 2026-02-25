import { getGridContext } from '$lib/context/gridContext.svelte.ts';

const DEFAULT_WIDTH = 150;
const MIN_WIDTH = 50;

export function createColumnController() {
  const ctx = getGridContext();  // safe: called during component init

  // Resize tracking (transient, local to this controller instance)
  let startX = $state(0);
  let startWidth = $state(0);

  function getWidth(key: string): number {
    return ctx.columnWidths.get(key) ?? DEFAULT_WIDTH;
  }

  function setWidth(key: string, width: number) {
    ctx.columnWidths.set(key, Math.max(MIN_WIDTH, width));
  }

  function resetWidth(key: string) {
    ctx.columnWidths.delete(key);
  }

  function startResize(key: string, clientX: number) {
    ctx.resizingColumn = key;
    startX = clientX;
    startWidth = getWidth(key);
  }

  function updateResize(currentX: number) {
    if (!ctx.resizingColumn) return;
    setWidth(ctx.resizingColumn, startWidth + (currentX - startX));
  }

  function endResize() {
    ctx.resizingColumn = null;
  }

  function resetAll() {
    ctx.columnWidths.clear();
  }

  function loadFromStorage(storageKey: string) {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        for (const [key, value] of Object.entries(parsed)) {
          ctx.columnWidths.set(key, Number(value));
        }
      }
    } catch (err) {
      console.error('Failed to load column widths:', err);
    }
  }

  function saveToStorage(storageKey: string) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(ctx.columnWidths)));
    } catch (err) {
      console.error('Failed to save column widths:', err);
    }
  }

  function getAllWidths(): Record<string, number> {
    return Object.fromEntries(ctx.columnWidths.entries());
  }

  return {
    get resizingColumn() { return ctx.resizingColumn; },
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
