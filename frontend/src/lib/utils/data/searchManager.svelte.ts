// src/lib/utils/data/searchManager.svelte.ts
import { SvelteMap } from "svelte/reactivity";

export type Filter = {
  key: string;
  value: string;
};

export class SearchManager {
  // Search state
  term = $state('');
  inputValue = $state('');
  
  // Filter state
  selectedFilters = $state<Filter[]>([]);
  filterOptions: SvelteMap<string, any> = new SvelteMap();
  
  // Error state
  error = $state('');

  /**
   * Perform search directly against the Go API
   */
  async search(baseData: any[]): Promise<any[]> {
    try {
      const params = new URLSearchParams();

      if (this.term) {
        params.set('q', this.term);
      }
    
      if (this.selectedFilters.length > 0) {
        this.selectedFilters.forEach(f => {
          params.append('filter', `${f.key}:${f.value}`);
        });
      }

      // If no search term and no filters, return base data
      if (!this.term && this.selectedFilters.length === 0) {
        this.error = '';
        return [...baseData];
      }

      // DIRECT CALL: Browser -> Go API
      const response = await fetch(`./api/search?${params.toString()}`);
      
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      this.error = '';
      
      // Handle case where API returns null for empty list
      return result.assets || [];

    } catch (err) {
      this.error = err instanceof Error ? err.message : 'An unknown error occurred.';
      console.error('Search failed:', this.error);
      return [];
    }
  }

  // ... rest of the file (executeSearch, clearSearch, etc.) remains unchanged
  executeSearch() {
    this.term = this.inputValue;
  }

  clearSearch() {
    this.term = '';
    this.inputValue = '';
  }

  getFilterItems(key: string, assets: any[]): any[] {
    if (this.filterOptions.size > 0 && this.filterOptions.has(key)) {
      return this.filterOptions.get(key);
    }
    return getUniqueValues(assets, key);
  }

  selectFilterItem(item: string, key: string, assets: any[]) {
    this.selectedFilters = toggleFilter(this.selectedFilters, key, item);
    if (!this.filterOptions.has(key)) {
      this.filterOptions.set(key, this.getFilterItems(key, assets));
    }
  }

  removeFilter(filter: Filter) {
    this.selectedFilters = removeFilter(this.selectedFilters, filter);
  }

  clearAllFilters() {
    this.selectedFilters = [];
  }

  cleanupFilterCache() {
    const activeFilterKeys = new Set(this.selectedFilters.map(f => f.key));
    for (const key of this.filterOptions.keys()) {
      if (!activeFilterKeys.has(key)) {
        this.filterOptions.delete(key);
      }
    }
  }

  isFilterSelected(key: string, value: string): boolean {
    return this.selectedFilters.some(f => f.key === key && f.value === value);
  }

  getFilterCount(): number {
    return this.selectedFilters.length;
  }
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

function removeFilter(currentFilters: Filter[], filterToRemove: Filter): Filter[] {
  return currentFilters.filter(item => item !== filterToRemove);
}