// src/lib/utils/data/searchManager.svelte.ts

export type Filter = {
  key: string;
  value: string;
};

function createSearchManager() {
  // Search state
  let inputValue = $state('');

  // Filter state
  let selectedFilters = $state<Filter[]>([]);

  // Error state
  let error = $state('');

  function getFilterItems(key: string, assets: any[], baseAssets?: any[]): any[] {
    if (!baseAssets || baseAssets.length === 0) {
      return getUniqueValues(assets, key);
    }

    // Always compute from baseAssets filtered by OTHER columns' filters only
    // This avoids flicker from async filteredAssets updates
    const otherFilters = selectedFilters.filter(f => f.key !== key);

    if (otherFilters.length === 0) {
      return getUniqueValues(baseAssets, key);
    }

    // Group other filters by key
    const filtersByKey = new Map<string, Set<string>>();
    for (const f of otherFilters) {
      if (!filtersByKey.has(f.key)) filtersByKey.set(f.key, new Set());
      filtersByKey.get(f.key)!.add(f.value);
    }

    // Apply other columns' filters to base data client-side
    const filtered = baseAssets.filter(item => {
      for (const [filterKey, values] of filtersByKey) {
        if (!values.has(String(item[filterKey] ?? ''))) return false;
      }
      return true;
    });

    return getUniqueValues(filtered, key);
  }

  function selectFilterItem(item: string, key: string, assets: any[]) {
    selectedFilters = toggleFilter(selectedFilters, key, item);
  }

  function removeFilter(filter: Filter) {
    selectedFilters = removeFilterHelper(selectedFilters, filter);
  }

  function clearAllFilters() {
    selectedFilters = [];
  }

  function cleanupFilterCache() {
    // No-op: caching removed in favor of baseAssets approach
  }

  function isFilterSelected(key: string, value: string): boolean {
    return selectedFilters.some(f => f.key === key && f.value === value);
  }

  function getFilterCount(): number {
    return selectedFilters.length;
  }

  function setSelectedFilters(value: Filter[]) {
    selectedFilters = value;
  }

  return {
    get inputValue() { return inputValue },
    set inputValue(value: string) { inputValue = value },
    get selectedFilters() { return selectedFilters },
    set selectedFilters(value: Filter[]) { selectedFilters = value },
    get error() { return error },

    getFilterItems,
    selectFilterItem,
    removeFilter,
    clearAllFilters,
    cleanupFilterCache,
    isFilterSelected,
    getFilterCount,
    setSelectedFilters
  };
}

// --- Internal Helper Functions ---
function getUniqueValues<T>(data: T[], key: keyof T): string[] {
  const values = data
    .map((item) => item[key])
    .filter((val) => val != null && val !== ''); 

  return [...new Set(values)].sort().map(String);
}

function toggleFilter(currentFilters: Filter[], key: string, value: string): Filter[] {
  const exists = currentFilters.some(f => f.key === key && f.value === value);
  if (exists) {
    return currentFilters.filter(f => !(f.key === key && f.value === value));
  } else {
    return [...currentFilters, { key, value }];
  }
}

function removeFilterHelper(currentFilters: Filter[], filterToRemove: Filter): Filter[] {
  return currentFilters.filter(f => f.key !== filterToRemove.key || f.value !== filterToRemove.value);
}

export type SearchManager = ReturnType<typeof createSearchManager>;

// Export singleton instance
export const searchManager = createSearchManager();