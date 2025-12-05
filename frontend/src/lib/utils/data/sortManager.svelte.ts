// src/lib/utils/sortManager.svelte.ts

export type SortDirection = 'asc' | 'desc';

/**
 * Sort data by a key and direction
 */
function sortData<T>(list: T[], key: keyof T, dir: SortDirection): T[] {
  const direction = dir === 'asc' ? 1 : -1;

  return [...list].sort((a, b) => {
    const valA = a[key];
    const valB = b[key];

    // Null handling: Push nulls to the end
    if (valA == null) return 1;
    if (valB == null) return -1;

    // Number sorting
    if (typeof valA === 'number' && typeof valB === 'number') {
      return (valA - valB) * direction;
    }

    // String/Default sorting
    return String(valA).localeCompare(String(valB)) * direction;
  });
}

export class SortManager {
  // State
  key = $state('');
  direction = $state<SortDirection>('asc');
  defaultKey = 'id'; // [UPDATED] Default sort key
  
  // Cache sorted results to avoid re-sorting
  private cache = new Map<string, any[]>();
  private lastDataRef: any[] = [];

  /**
   * Generate cache key for current sort state
   */
  private getCacheKey(key: string, dir: string): string {
    return `${key}-${dir}`;
  }

  /**
   * Update sort state and toggle if same column
   */
  update(columnKey: string, dir: SortDirection) {
    if (this.key === columnKey && this.direction === dir) {
      this.reset();
    } else {
      this.key = columnKey;
      this.direction = dir;
    }
  }

  reset() {
    this.key = '';
    this.direction = 'asc';
    this.cache.clear();
    this.lastDataRef = [];
  }

  /**
   * Apply sort synchronously with caching
   */
  apply(data: any[]): any[] {
    if (this.lastDataRef !== data) {
      this.cache.clear();
      this.lastDataRef = data;
    }

    // [UPDATED] Determine effective key (Active OR Default)
    const effectiveKey = this.key || this.defaultKey;
    const effectiveDir = this.key ? this.direction : 'asc'; // Default to ASC for default key

    if (!effectiveKey) return data;

    const cacheKey = this.getCacheKey(effectiveKey, effectiveDir);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const sorted = sortData(data, effectiveKey as any, effectiveDir);
    this.cache.set(cacheKey, sorted);
    
    return sorted;
  }

  /**
   * Apply sort asynchronously to avoid blocking UI
   */
  async applyAsync(data: any[]): Promise<any[]> {
    if (this.lastDataRef !== data) {
      this.cache.clear();
      this.lastDataRef = data;
    }

    // [UPDATED] Determine effective key (Active OR Default)
    const effectiveKey = this.key || this.defaultKey;
    const effectiveDir = this.key ? this.direction : 'asc'; 

    if (!effectiveKey) return data;

    const cacheKey = this.getCacheKey(effectiveKey, effectiveDir);
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const sorted = await new Promise<any[]>((resolve) => {
      setTimeout(() => {
        const result = sortData(data, effectiveKey as any, effectiveDir);
        resolve(result);
      }, 0);
    });

    this.cache.set(cacheKey, sorted);
    
    return sorted;
  }

  // ... rest of the class (invalidateCache, isActive, etc.) remains the same
  invalidateCache() {
    this.cache.clear();
    this.lastDataRef = [];
  }

  isActive(columnKey: string): boolean {
    return this.key === columnKey;
  }

  getState(columnKey: string): { active: boolean; direction: SortDirection } {
    return {
      active: this.key === columnKey,
      direction: this.direction
    };
  }
}