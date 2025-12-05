// $lib/utils/columnWidthManager.svelte.ts
import { SvelteMap } from 'svelte/reactivity';

export class ColumnWidthManager {
  // Default width for all columns
  private defaultWidth = 150;
  
  // Store widths per column key - Using SvelteMap for granular reactivity
  private widths = new SvelteMap<string, number>();
  
  // Currently resizing column
  resizingColumn = $state<string | null>(null);
  startX = $state(0);
  startWidth = $state(0);

  /**
   * Get width for a specific column
   */
  getWidth(key: string): number {
    return this.widths.get(key) ?? this.defaultWidth;
  }

  /**
   * Set width for a specific column
   */
  setWidth(key: string, width: number) {
    // Enforce minimum width
    const minWidth = 50;
    const clampedWidth = Math.max(minWidth, width);
    this.widths.set(key, clampedWidth);
  }

  /**
   * Reset a specific column width to default
   */
  resetWidth(key: string) {
    this.widths.delete(key);
  }

  /**
   * Start resizing a column
   */
  startResize(key: string, startX: number) {
    console.log(`[ColumnManager] Start resize: ${key} at X=${startX}`);
    this.resizingColumn = key;
    this.startX = startX;
    this.startWidth = this.getWidth(key);
  }

  /**
   * Update width during resize
   */
  updateResize(currentX: number) {
    if (!this.resizingColumn) return;
    
    const delta = currentX - this.startX;
    const newWidth = this.startWidth + delta;
    
    console.log(`[ColumnManager] Resizing ${this.resizingColumn}: delta=${delta}, newWidth=${newWidth}`);
    this.setWidth(this.resizingColumn, newWidth);
  }

  /**
   * End resize
   */
  endResize() {
    if (this.resizingColumn) {
        console.log(`[ColumnManager] End resize: ${this.resizingColumn}`);
    }
    this.resizingColumn = null;
  }

  /**
   * Reset all widths to default
   */
  resetAll() {
    this.widths.clear();
  }

  /**
   * Load widths from localStorage
   */
  loadFromStorage(storageKey: string) {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Re-populate SvelteMap
        for (const [key, value] of Object.entries(parsed)) {
            this.widths.set(key, Number(value));
        }
      }
    } catch (err) {
      console.error('Failed to load column widths:', err);
    }
  }

  /**
   * Save widths to localStorage
   */
  saveToStorage(storageKey: string) {
    try {
      // Convert SvelteMap to standard object for JSON
      const obj = Object.fromEntries(this.widths.entries());
      localStorage.setItem(storageKey, JSON.stringify(obj));
    } catch (err) {
      console.error('Failed to save column widths:', err);
    }
  }

  /**
   * Get all widths as an object (for debugging or export)
   */
  getAllWidths(): Record<string, number> {
    return Object.fromEntries(this.widths.entries());
  }
}