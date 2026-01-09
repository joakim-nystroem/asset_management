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

function createSortManager() {
  // State
  let key = $state('');
  let direction = $state<SortDirection>('asc');
  const defaultKey = 'id'; // Default sort key

  // Cache sorted results to avoid re-sorting
  let cache = new Map<string, any[]>();
  let lastDataRef: any[] = [];

  /**
   * Generate cache key for current sort state
   */
  function getCacheKey(sortKey: string, dir: string): string {
    return `${sortKey}-${dir}`;
  }

  /**
   * Update sort state and toggle if same column
   */
  function update(columnKey: string, dir: SortDirection) {
    if (key === columnKey && direction === dir) {
      reset();
    } else {
      key = columnKey;
      direction = dir;
    }
  }

  function reset() {
    key = '';
    direction = 'asc';
    cache.clear();
    lastDataRef = [];
  }

  /**
   * Apply sort synchronously with caching
   */
  function apply(data: any[]): any[] {
    if (lastDataRef !== data) {
      cache.clear();
      lastDataRef = data;
    }

    // Determine effective key (Active OR Default)
    const effectiveKey = key || defaultKey;
    const effectiveDir = key ? direction : 'asc'; // Default to ASC for default key

    if (!effectiveKey) return data;

    const cacheKey = getCacheKey(effectiveKey, effectiveDir);

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    const sorted = sortData(data, effectiveKey as any, effectiveDir);
    cache.set(cacheKey, sorted);

    return sorted;
  }

  /**
   * Apply sort asynchronously to avoid blocking UI
   */
  async function applyAsync(data: any[]): Promise<any[]> {
    if (lastDataRef !== data) {
      cache.clear();
      lastDataRef = data;
    }

    // Determine effective key (Active OR Default)
    const effectiveKey = key || defaultKey;
    const effectiveDir = key ? direction : 'asc';

    if (!effectiveKey) return data;

    const cacheKey = getCacheKey(effectiveKey, effectiveDir);

    if (cache.has(cacheKey)) {
      return cache.get(cacheKey)!;
    }

    const sorted = await new Promise<any[]>((resolve) => {
      setTimeout(() => {
        const result = sortData(data, effectiveKey as any, effectiveDir);
        resolve(result);
      }, 0);
    });

    cache.set(cacheKey, sorted);

    return sorted;
  }

  function invalidateCache() {
    cache.clear();
    lastDataRef = [];
  }

  function isActive(columnKey: string): boolean {
    return key === columnKey;
  }

  function getState(columnKey: string): { active: boolean; direction: SortDirection } {
    return {
      active: key === columnKey,
      direction: direction
    };
  }

  return {
    get key() { return key },
    get direction() { return direction },

    update,
    reset,
    apply,
    applyAsync,
    invalidateCache,
    isActive,
    getState
  };
}

export type SortManager = ReturnType<typeof createSortManager>;

// Export singleton instance
export const sortManager = createSortManager();