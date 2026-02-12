// src/lib/utils/data/searchManager.svelte.ts
import { SvelteMap } from "svelte/reactivity";

export type Filter = {
  key: string;
  value: string;
};

function createSearchManager() {
  // Search state
  let inputValue = $state('');

  // Filter state
  let selectedFilters = $state<Filter[]>([]);
  const filterOptions = new SvelteMap<string, any>();

  // Error state
  let error = $state('');

  function getFilterItems(key: string, assets: any[]): any[] {
    if (filterOptions.size > 0 && filterOptions.has(key)) {
      return filterOptions.get(key);
    }
    return getUniqueValues(assets, key);
  }

  function selectFilterItem(item: string, key: string, assets: any[]) {
    selectedFilters = toggleFilter(selectedFilters, key, item);
    if (!filterOptions.has(key)) {
      filterOptions.set(key, getFilterItems(key, assets));
    }
  }

  function removeFilter(filter: Filter) {
    selectedFilters = removeFilterHelper(selectedFilters, filter);
  }

  function clearAllFilters() {
    selectedFilters = [];
  }

  function cleanupFilterCache() {
    const activeFilterKeys = new Set(selectedFilters.map(f => f.key));
    for (const key of filterOptions.keys()) {
      if (!activeFilterKeys.has(key)) {
        filterOptions.delete(key);
      }
    }
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