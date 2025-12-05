import { x as attr, y as ensure_array_like, z as attr_style, F as stringify } from "../../chunks/index.js";
import "clsx";
import { e as escape_html } from "../../chunks/context.js";
class ContextMenuState {
  visible = false;
  x = 0;
  y = 0;
  row = -1;
  col = -1;
  open(e, row, col) {
    e.preventDefault();
    this.visible = true;
    this.x = e.clientX;
    this.y = e.clientY;
    this.row = row;
    this.col = col;
  }
  close() {
    this.visible = false;
  }
}
class HeaderMenuState {
  // The column currently open (e.g. 'manufacturer')
  activeKey = "";
  // Is the filter sub-menu open?
  filterOpen = false;
  // Position of the menu
  x = 0;
  y = 0;
  toggle(e, key) {
    e.stopPropagation();
    if (this.activeKey === key) {
      this.close();
      return;
    }
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    this.activeKey = key;
    this.filterOpen = false;
    this.y = rect.bottom;
    this.x = rect.left;
  }
  toggleFilter() {
    this.filterOpen = !this.filterOpen;
  }
  close() {
    this.activeKey = "";
    this.filterOpen = false;
  }
  // Check if we should close based on a click target
  handleOutsideClick(e) {
    if (this.activeKey === "") return;
    const target = e.target;
    if (target.closest(".header-interactive")) return;
    this.close();
  }
}
class SelectionManager {
  // Selection state
  start = { row: -1, col: -1 };
  end = { row: -1, col: -1 };
  isSelecting = false;
  // Visual overlays
  selectionOverlay = { top: 0, left: 0, width: 0, height: 0, visible: false };
  copyOverlay = { top: 0, left: 0, width: 0, height: 0, visible: false };
  /**
   * Calculate overlay rectangle geometry from start/end cells
   */
  calculateOverlayRect(start, end) {
    if (start.row === -1 || end.row === -1) {
      return { top: 0, left: 0, width: 0, height: 0, visible: false };
    }
    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);
    const startEl = document.querySelector(`div[data-row="${minRow}"][data-col="${minCol}"]`);
    const endEl = document.querySelector(`div[data-row="${maxRow}"][data-col="${maxCol}"]`);
    if (!startEl || !endEl) {
      return { top: 0, left: 0, width: 0, height: 0, visible: false };
    }
    return {
      top: startEl.offsetTop,
      left: startEl.offsetLeft,
      width: endEl.offsetLeft + endEl.offsetWidth - startEl.offsetLeft,
      height: endEl.offsetTop + endEl.offsetHeight - startEl.offsetTop,
      visible: true
    };
  }
  /**
   * Update the selection overlay based on current start/end
   */
  updateOverlay() {
    this.selectionOverlay = this.calculateOverlayRect(this.start, this.end);
  }
  /**
   * Start a new selection (mouse down)
   */
  startSelection(row, col) {
    if (this.start.row === row && this.start.col === col && this.end.row === row && this.end.col === col) {
      this.reset();
      this.isSelecting = false;
      return;
    }
    this.isSelecting = true;
    this.start = { row, col };
    this.end = { row, col };
    this.updateOverlay();
  }
  /**
   * Extend selection (mouse drag)
   */
  extendSelection(row, col) {
    if (this.isSelecting) {
      this.end = { row, col };
      this.updateOverlay();
    }
  }
  /**
   * End selection (mouse up)
   */
  endSelection() {
    this.isSelecting = false;
  }
  /**
   * Move selection anchor (keyboard navigation)
   */
  moveTo(row, col) {
    this.start = { row, col };
    this.end = { row, col };
    this.updateOverlay();
  }
  /**
   * Set a specific cell as selected (e.g., from context menu)
   */
  selectCell(row, col) {
    this.start = { row, col };
    this.end = { row, col };
    this.updateOverlay();
  }
  /**
   * Snapshot current selection as "copied" overlay
   */
  snapshotAsCopied() {
    const rect = this.calculateOverlayRect(this.start, this.end);
    if (rect.visible) {
      this.copyOverlay = rect;
    }
  }
  /**
   * Clear the copied overlay
   */
  clearCopyOverlay() {
    this.copyOverlay = { top: 0, left: 0, width: 0, height: 0, visible: false };
  }
  /**
   * Reset selection state (but preserve copy overlay)
   */
  reset() {
    this.start = { row: -1, col: -1 };
    this.end = { row: -1, col: -1 };
    this.selectionOverlay.visible = false;
  }
  /**
   * Reset everything including copy overlay
   */
  resetAll() {
    this.reset();
    this.copyOverlay.visible = false;
  }
  /**
   * Get normalized bounds of current selection (top-left to bottom-right)
   */
  getBounds() {
    if (this.start.row === -1 || this.end.row === -1) {
      return null;
    }
    return {
      minRow: Math.min(this.start.row, this.end.row),
      maxRow: Math.max(this.start.row, this.end.row),
      minCol: Math.min(this.start.col, this.end.col),
      maxCol: Math.max(this.start.col, this.end.col)
    };
  }
  /**
   * Check if a specific cell is within the copy overlay bounds
   */
  isCellInCopyOverlay(row, col) {
    if (!this.copyOverlay.visible) return false;
    const el = document.querySelector(`div[data-row="${row}"][data-col="${col}"]`);
    if (!el) return false;
    const cellTop = el.offsetTop;
    const cellLeft = el.offsetLeft;
    const cellRight = cellLeft + el.offsetWidth;
    const cellBottom = cellTop + el.offsetHeight;
    const copyTop = this.copyOverlay.top;
    const copyLeft = this.copyOverlay.left;
    const copyRight = copyLeft + this.copyOverlay.width;
    const copyBottom = copyTop + this.copyOverlay.height;
    return cellLeft >= copyLeft && cellRight <= copyRight && cellTop >= copyTop && cellBottom <= copyBottom;
  }
  /**
   * Check if selection and copy overlay completely overlap (same region)
   */
  selectionMatchesCopy() {
    if (!this.selectionOverlay.visible || !this.copyOverlay.visible) return false;
    return this.selectionOverlay.top === this.copyOverlay.top && this.selectionOverlay.left === this.copyOverlay.left && this.selectionOverlay.width === this.copyOverlay.width && this.selectionOverlay.height === this.copyOverlay.height;
  }
  hasSelection() {
    return this.start.row !== -1 && this.end.row !== -1;
  }
  /**
   * Get the anchor cell (starting point) for operations
   */
  getAnchor() {
    return this.start.row !== -1 ? this.start : null;
  }
}
const SvelteMap = globalThis.Map;
function getUniqueValues(data, key) {
  const values = data.map((item) => item[key]).filter((val) => val != null && val !== "");
  return [...new Set(values)].sort().map(String);
}
function toggleFilter(currentFilters, key, value) {
  const exists = currentFilters.some((f) => f.key === key && f.value === value);
  if (exists) {
    return currentFilters.filter((f) => !(f.key === key && f.value === value));
  } else {
    return [...currentFilters, { key, value }];
  }
}
function removeFilter(currentFilters, filterToRemove) {
  return currentFilters.filter((item) => item !== filterToRemove);
}
class SearchManager {
  // Search state
  term = "";
  inputValue = "";
  // Filter state
  selectedFilters = [];
  filterOptions = new SvelteMap();
  // Error state
  error = "";
  /**
   * Perform search with current term and filters
   */
  async search(baseData) {
    try {
      const params = new URLSearchParams();
      if (this.term) params.set("q", this.term);
      if (this.selectedFilters.length > 0) {
        this.selectedFilters.forEach((f) => {
          params.append("filter", `${f.key}:${f.value}`);
        });
      }
      if (!this.term && this.selectedFilters.length === 0) {
        this.error = "";
        return [...baseData];
      }
      const response = await fetch(`./api/search?${params.toString()}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to fetch assets");
      }
      const result = await response.json();
      this.error = "";
      return result.assets;
    } catch (err) {
      this.error = err instanceof Error ? err.message : "An unknown error occurred.";
      console.error("Database query failed:", this.error);
      return [];
    }
  }
  /**
   * Execute search using input value
   */
  executeSearch() {
    this.term = this.inputValue;
  }
  /**
   * Clear search term
   */
  clearSearch() {
    this.term = "";
    this.inputValue = "";
  }
  /**
   * Get unique filter values for a specific key
   */
  getFilterItems(key, assets) {
    if (this.filterOptions.size > 0 && this.filterOptions.has(key)) {
      return this.filterOptions.get(key);
    }
    return getUniqueValues(assets, key);
  }
  /**
   * Toggle a filter value for a specific key
   */
  selectFilterItem(item, key, assets) {
    this.selectedFilters = toggleFilter(this.selectedFilters, key, item);
    if (!this.filterOptions.has(key)) {
      this.filterOptions.set(key, this.getFilterItems(key, assets));
    }
  }
  /**
   * Remove a specific filter
   */
  removeFilter(filter) {
    this.selectedFilters = removeFilter(this.selectedFilters, filter);
  }
  /**
   * Clear all filters
   */
  clearAllFilters() {
    this.selectedFilters = [];
  }
  /**
   * Clean up filter cache based on active filters
   */
  cleanupFilterCache() {
    const activeFilterKeys = new Set(this.selectedFilters.map((f) => f.key));
    for (const key of this.filterOptions.keys()) {
      if (!activeFilterKeys.has(key)) {
        this.filterOptions.delete(key);
      }
    }
  }
  /**
   * Check if a filter is currently selected
   */
  isFilterSelected(key, value) {
    return this.selectedFilters.some((f) => f.key === key && f.value === value);
  }
  /**
   * Get count of active filters
   */
  getFilterCount() {
    return this.selectedFilters.length;
  }
}
function sortData(list, key, dir) {
  const direction = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    const valA = a[key];
    const valB = b[key];
    if (valA == null) return 1;
    if (valB == null) return -1;
    if (typeof valA === "number" && typeof valB === "number") {
      return (valA - valB) * direction;
    }
    return String(valA).localeCompare(String(valB)) * direction;
  });
}
class SortManager {
  // State
  key = "";
  direction = "asc";
  // Cache sorted results to avoid re-sorting
  cache = /* @__PURE__ */ new Map();
  originalOrder = [];
  /**
   * Generate cache key for current sort state
   */
  getCacheKey() {
    return `${this.key}-${this.direction}`;
  }
  /**
   * Update sort state
   */
  update(columnKey, dir) {
    if (this.key === columnKey && this.direction === dir) {
      this.key = "id";
      this.direction = "asc";
    } else {
      this.key = columnKey;
      this.direction = dir;
    }
  }
  /**
   * Clear sort state (e.g. on new search)
   */
  reset() {
    this.key = "";
    this.direction = "asc";
    this.cache.clear();
    this.originalOrder = [];
  }
  /**
   * Apply sort asynchronously with caching
   */
  async applyAsync(data) {
    if (this.originalOrder.length === 0 || this.originalOrder !== data) {
      this.originalOrder = data;
      this.cache.clear();
    }
    if (!this.key) return data;
    const cacheKey = this.getCacheKey();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    const sorted = await new Promise((resolve) => {
      setTimeout(
        () => {
          const result = sortData(data, this.key, this.direction);
          resolve(result);
        },
        0
      );
    });
    this.cache.set(cacheKey, sorted);
    return sorted;
  }
  /**
   * Synchronous apply (for compatibility)
   */
  apply(data) {
    if (!this.key) return data;
    const cacheKey = this.getCacheKey();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    const sorted = sortData(data, this.key, this.direction);
    this.cache.set(cacheKey, sorted);
    return sorted;
  }
  /**
   * Clear cache when data changes
   */
  invalidateCache() {
    this.cache.clear();
    this.originalOrder = [];
  }
}
class VirtualScrollManager {
  // Configuration
  rowHeight = 32;
  // Height of each row in pixels (h-8 = 2rem = 32px)
  overscan = 15;
  // Extra rows to render above/below viewport for smooth scrolling (increased from 5)
  // State
  scrollTop = 0;
  containerHeight = 0;
  // Computed visible range
  get visibleRange() {
    const startIndex = Math.max(0, Math.floor(this.scrollTop / this.rowHeight) - this.overscan);
    const visibleCount = Math.ceil(this.containerHeight / this.rowHeight);
    const endIndex = startIndex + visibleCount + this.overscan * 2;
    return { startIndex, endIndex };
  }
  /**
   * Get the subset of data to actually render
   */
  getVisibleItems(data) {
    const { startIndex, endIndex } = this.visibleRange;
    const clampedEnd = Math.min(endIndex, data.length);
    return {
      items: data.slice(startIndex, clampedEnd),
      startIndex,
      endIndex: clampedEnd
    };
  }
  /**
   * Calculate total height of all rows (for scrollbar)
   */
  getTotalHeight(itemCount) {
    return itemCount * this.rowHeight;
  }
  /**
   * Calculate offset for the visible window
   */
  getOffsetY() {
    return this.visibleRange.startIndex * this.rowHeight;
  }
  /**
   * Handle scroll event
   */
  handleScroll(e) {
    const target = e.target;
    this.scrollTop = target.scrollTop;
  }
  /**
   * Handle container resize
   */
  updateContainerHeight(height) {
    this.containerHeight = height;
  }
  /**
   * Scroll to a specific row index
   */
  scrollToRow(index, container) {
    if (!container) return;
    const targetScrollTop = index * this.rowHeight;
    container.scrollTop = targetScrollTop;
    this.scrollTop = targetScrollTop;
  }
  /**
   * Get the actual row index from a visible index
   */
  getActualIndex(visibleIndex) {
    return this.visibleRange.startIndex + visibleIndex;
  }
  /**
   * Check if a row index is currently visible
   */
  isRowVisible(index) {
    const { startIndex, endIndex } = this.visibleRange;
    return index >= startIndex && index < endIndex;
  }
}
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const contextMenu = new ContextMenuState();
    const headerMenu = new HeaderMenuState();
    const selection = new SelectionManager();
    const search = new SearchManager();
    const sort = new SortManager();
    const virtualScroll = new VirtualScrollManager();
    let { data } = $$props;
    let assets = data.assets;
    let keys = data.assets.length > 0 ? Object.keys(data.assets[0]) : [];
    const visibleData = virtualScroll.getVisibleItems(assets);
    $$renderer2.push(`<div class="flex flex-row gap-4 items-center mb-2"><h2 class="text-lg font-bold whitespace-nowrap">Asset Master</h2> <div class="flex gap-4 items-center"><input${attr(
      "value",
      // Measure container height on mount/resize
      // Reactive dependencies
      // Cleanup cache when assets change
      search.inputValue
    )} class="bg-white dark:bg-neutral-100 dark:text-neutral-700 p-1 border border-neutral-300 dark:border-none focus:outline-none" placeholder="Search this list..."/> <button class="cursor-pointer bg-blue-500 hover:bg-blue-600 px-2 py-1 text-neutral-100">Search</button></div> <div class="flex flex-row w-full justify-between items-center"><div class="flex flex-row text-xs gap-2"><!--[-->`);
    const each_array = ensure_array_like(search.selectedFilters);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let filter = each_array[$$index];
      $$renderer2.push(`<div class="p-1 border rounded-md border-neutral-700 dark:border-neutral-300 space-x-2 flex items-center"><span class="cursor-default">${escape_html((filter.key.charAt(0).toUpperCase() + filter.key.slice(1)).replaceAll("_", " "))}: ${escape_html(filter.value)}</span> <button class="text-neutral-500 dark:text-neutral-300 text-base hover:dark:text-red-400 hover:text-red-600 hover:cursor-pointer">✕</button></div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="flex gap-2 items-center">`);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (search.getFilterCount() > 0) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<button class="cursor-pointer bg-red-600 hover:bg-red-700 px-2 py-1 text-neutral-100">Clear</button>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div></div></div> `);
    if (assets.length > 0) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="rounded-lg border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-auto h-[calc(100dvh-9.3rem)] shadow-md relative select-none"><div class="w-max min-w-full bg-white dark:bg-slate-800 text-left relative"${attr_style(`height: ${stringify(virtualScroll.getTotalHeight(assets.length))}px;`)}><div class="sticky top-0 z-20 flex border-b border-neutral-200 dark:border-slate-600 bg-neutral-50 dark:bg-slate-700"><!--[-->`);
      const each_array_1 = ensure_array_like(keys);
      for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
        let key = each_array_1[$$index_1];
        $$renderer2.push(`<div class="header-interactive relative group border-r border-neutral-200 dark:border-slate-600 last:border-r-0" style="width: 150px; min-width: 150px;"><button class="w-full h-full px-2 py-2 text-xs font-medium text-neutral-900 dark:text-neutral-100 uppercase hover:bg-neutral-100 dark:hover:bg-slate-600 text-left flex items-center justify-between focus:outline-none focus:bg-neutral-200 dark:focus:bg-slate-500 cursor-pointer"><span class="truncate">${escape_html(key.replaceAll("_", " "))}</span> <span class="ml-1">`);
        if (sort.key === key) {
          $$renderer2.push("<!--[-->");
          $$renderer2.push(`<span>${escape_html(sort.direction === "asc" ? "▲" : "▼")}</span>`);
        } else {
          $$renderer2.push("<!--[!-->");
          $$renderer2.push(`<span class="invisible group-hover:visible text-neutral-400">▾</span>`);
        }
        $$renderer2.push(`<!--]--></span></button></div>`);
      }
      $$renderer2.push(`<!--]--></div> <div class="absolute w-full"${attr_style(`transform: translateY(${stringify(virtualScroll.getOffsetY())}px);`)}>`);
      if (selection.copyOverlay.visible) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="absolute pointer-events-none z-20 border-2 border-dotted border-blue-600 dark:border-blue-500"${attr_style(` top: ${stringify(selection.copyOverlay.top)}px; left: ${stringify(selection.copyOverlay.left)}px; width: ${stringify(selection.copyOverlay.width)}px; height: ${stringify(selection.copyOverlay.height)}px; `)}></div>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (selection.selectionOverlay.visible && !selection.selectionMatchesCopy()) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="absolute pointer-events-none z-10 border-2 border-blue-600 dark:border-blue-500 bg-blue-100/10 dark:bg-blue-500/10"${attr_style(` top: ${stringify(selection.selectionOverlay.top)}px; left: ${stringify(selection.selectionOverlay.left)}px; width: ${stringify(selection.selectionOverlay.width)}px; height: ${stringify(selection.selectionOverlay.height)}px; `)}></div>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> <!--[-->`);
      const each_array_2 = ensure_array_like(visibleData.items);
      for (let i = 0, $$length = each_array_2.length; i < $$length; i++) {
        let asset = each_array_2[i];
        const actualIndex = visibleData.startIndex + i;
        $$renderer2.push(`<div class="flex border-b border-neutral-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors"><!--[-->`);
        const each_array_3 = ensure_array_like(keys);
        for (let j = 0, $$length2 = each_array_3.length; j < $$length2; j++) {
          let key = each_array_3[j];
          $$renderer2.push(`<div${attr("data-row", actualIndex)}${attr("data-col", j)} class="h-8 px-2 flex items-center text-xs whitespace-nowrap overflow-hidden text-ellipsis cursor-cell text-neutral-700 dark:text-neutral-200 hover:bg-blue-100 dark:hover:bg-slate-600 border-r border-neutral-200 dark:border-slate-700 last:border-r-0" style="width: 150px; min-width: 150px;">${escape_html(asset[key])}</div>`);
        }
        $$renderer2.push(`<!--]--></div>`);
      }
      $$renderer2.push(`<!--]--></div></div></div> <p class="mt-2 ml-1 text-sm text-neutral-600 dark:text-neutral-300">Showing ${escape_html(assets.length)} items.</p>`);
    } else {
      $$renderer2.push("<!--[!-->");
      if (search.error) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<p class="text-red-500">Error: ${escape_html(search.error)}</p>`);
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`<p>Query successful, but no data was returned.</p>`);
      }
      $$renderer2.push(`<!--]-->`);
    }
    $$renderer2.push(`<!--]--> `);
    if (headerMenu.activeKey) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="fixed z-50 bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 rounded shadow-xl py-1 text-sm text-neutral-900 dark:text-neutral-100 min-w-48 font-normal normal-case cursor-default text-left flex flex-col"${attr_style(`top: ${stringify(headerMenu.y)}px; left: ${stringify(headerMenu.x)}px;`)}><button class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group w-full"><div class="w-4 flex justify-center text-blue-600 dark:text-blue-400 font-bold">`);
      if (sort.key === headerMenu.activeKey && sort.direction === "asc") {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`✓`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></div> <span>Sort A to Z</span></button> <button class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group w-full"><div class="w-4 flex justify-center text-blue-600 dark:text-blue-400 font-bold">`);
      if (sort.key === headerMenu.activeKey && sort.direction === "desc") {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`✓`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></div> <span>Sort Z to A</span></button> <div class="border-b border-neutral-200 dark:border-slate-700 my-1"></div> <div class="relative w-full"><button class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center justify-between group w-full"><div class="flex items-center gap-2"><div class="w-4"></div> <span>Filter By</span></div> <span class="text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400">›</span></button> `);
      if (headerMenu.filterOpen) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<div class="absolute z-50 top-0 left-full ml-1 bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 rounded shadow-xl py-1 text-sm min-w-48"><div class="max-h-48 overflow-y-auto no-scrollbar">`);
        const each_array_4 = ensure_array_like(search.getFilterItems(headerMenu.activeKey, assets));
        if (each_array_4.length !== 0) {
          $$renderer2.push("<!--[-->");
          for (let $$index_4 = 0, $$length = each_array_4.length; $$index_4 < $$length; $$index_4++) {
            let item = each_array_4[$$index_4];
            $$renderer2.push(`<button class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group w-full"><div class="w-4 flex justify-center text-blue-600 dark:text-blue-400 font-bold">`);
            if (search.isFilterSelected(headerMenu.activeKey, item)) {
              $$renderer2.push("<!--[-->");
              $$renderer2.push(`✓`);
            } else {
              $$renderer2.push("<!--[!-->");
            }
            $$renderer2.push(`<!--]--></div> <div class="truncate">${escape_html(item)}</div></button>`);
          }
        } else {
          $$renderer2.push("<!--[!-->");
          $$renderer2.push(`<div class="px-3 py-1.5 text-neutral-500">No items found.</div>`);
        }
        $$renderer2.push(`<!--]--></div></div>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></div></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (contextMenu.visible) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="fixed z-[60] bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-700 rounded shadow-xl py-1 text-sm text-neutral-900 dark:text-neutral-100 min-w-32 cursor-default text-left flex flex-col"${attr_style(`top: ${stringify(contextMenu.y)}px; left: ${stringify(contextMenu.x)}px;`)}><button class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group"><svg class="w-4 h-4 text-neutral-500 dark:text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg> <span>Edit</span></button> <div class="border-b border-neutral-200 dark:border-slate-700 my-1"></div> <button class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group"><svg class="w-4 h-4 text-neutral-500 dark:text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> <span>Copy</span></button> <button class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-slate-700 text-left flex items-center gap-2 group"><svg class="w-4 h-4 text-neutral-500 dark:text-neutral-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 
        0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg> <span>Paste</span></button></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
export {
  _page as default
};
