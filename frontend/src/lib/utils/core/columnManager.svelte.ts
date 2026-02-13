// $lib/utils/columnWidthManager.svelte.ts
import { SvelteMap } from 'svelte/reactivity';

function createColumnWidthManager() {
  // Default width for all columns
  const defaultWidth = 150;

  // Store widths per column key - Using SvelteMap for granular reactivity
  const widths = new SvelteMap<string, number>();

  // Currently resizing column
  let resizingColumn = $state<string | null>(null);
  let startX = $state(0);
  let startWidth = $state(0);

  /**
   * Get width for a specific column
   */
  function getWidth(key: string): number {
    return widths.get(key) ?? defaultWidth;
  }

  /**
   * Set width for a specific column
   */
  function setWidth(key: string, width: number) {
    // Enforce minimum width
    const minWidth = 50;
    const clampedWidth = Math.max(minWidth, width);
    widths.set(key, clampedWidth);
  }

  /**
   * Reset a specific column width to default
   */
  function resetWidth(key: string) {
    widths.delete(key);
  }

  /**
   * Start resizing a column
   */
  function startResize(key: string, clientX: number) {
    resizingColumn = key;
    startX = clientX;
    startWidth = getWidth(key);
  }

  /**
   * Update width during resize
   */
  function updateResize(currentX: number) {
    if (!resizingColumn) return;

    const delta = currentX - startX;
    const newWidth = startWidth + delta;

    setWidth(resizingColumn, newWidth);
  }

  /**
   * End resize
   */
  function endResize() {
    resizingColumn = null;
  }

  /**
   * Reset all widths to default
   */
  function resetAll() {
    widths.clear();
  }

  /**
   * Load widths from localStorage
   */
  function loadFromStorage(storageKey: string) {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Re-populate SvelteMap
        for (const [key, value] of Object.entries(parsed)) {
          widths.set(key, Number(value));
        }
      }
    } catch (err) {
      console.error('Failed to load column widths:', err);
    }
  }

  /**
   * Save widths to localStorage
   */
  function saveToStorage(storageKey: string) {
    try {
      // Convert SvelteMap to standard object for JSON
      const obj = Object.fromEntries(widths.entries());
      localStorage.setItem(storageKey, JSON.stringify(obj));
    } catch (err) {
      console.error('Failed to save column widths:', err);
    }
  }

  /**
   * Get all widths as an object (for debugging or export)
   */
  function getAllWidths(): Record<string, number> {
    return Object.fromEntries(widths.entries());
  }

  return {
    get resizingColumn() { return resizingColumn },

    getWidth,
    setWidth,
    resetWidth,
    startResize,
    updateResize,
    endResize,
    resetAll,
    loadFromStorage,
    saveToStorage,
    getAllWidths
  };
}

export type ColumnWidthManager = ReturnType<typeof createColumnWidthManager>;

// Export singleton instance
export const columnManager = createColumnWidthManager();