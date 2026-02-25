// src/lib/utils/ui/headerMenu/headerMenu.svelte.ts

function createHeaderMenuState() {
  // State
  let activeKey = $state('');
  let filterOpen = $state(false);
  let filterSearchTerm = $state('');
  let x = $state(0);
  let y = $state(0);
  let submenuDirection = $state<'left' | 'right'>('right');
  let useRightPositioning = $state(false); 
  let menuElement: HTMLElement | undefined = $state(undefined);

  // Private internal state
  let triggerElement: HTMLElement | null = null;
  let savedFilterItems: string[] = [];
  let scrollContainer: HTMLElement | null = null;

  function toggle(e: MouseEvent, key: string, filterItems: string[] = [], isLastColumn: boolean = false) {
    e.stopPropagation();

    if (activeKey === key) {
      close();
      return;
    }

    triggerElement = e.currentTarget as HTMLElement;
    scrollContainer = triggerElement.closest('.overflow-auto');
    savedFilterItems = filterItems;
    activeKey = key;
    filterOpen = false;
    filterSearchTerm = '';

    // Set submenu direction AND positioning method based on column position
    submenuDirection = isLastColumn ? 'left' : 'right';
    useRightPositioning = isLastColumn;

    // Calculate position immediately
    reposition();
  }

  function reposition() {
    if (!triggerElement || !activeKey || !scrollContainer) return;

    const triggerRect = triggerElement.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();

    if (useRightPositioning) {
      const xRelativeToContainer = triggerRect.left - containerRect.left + scrollContainer.scrollLeft;
      x = xRelativeToContainer - 42;
    } else {
      // For other columns: align menu's left edge with trigger's left edge
      const xRelativeToContainer = triggerRect.left - containerRect.left + scrollContainer.scrollLeft;
      x = xRelativeToContainer;
    }

    // Y position is always from top
    const yRelativeToContainer = triggerRect.bottom - containerRect.top + scrollContainer.scrollTop;
    y = yRelativeToContainer;
  }

  function calculateSubmenuDirection() {
    if (menuElement) {
      const rect = menuElement.getBoundingClientRect();
      
      // Find the longest item in the filter list to estimate width
      const longestItem = savedFilterItems.reduce((a, b) => a.length > b.length ? a : b, '');
      const estimatedCharWidth = 8; // Average width of a character in pixels
      const paddingAndIcons = 48; // Combined width for padding, icons, etc.
      const calculatedWidth = (longestItem.length * estimatedCharWidth) + paddingAndIcons;
      
      // Use a minimum width, similar to 'min-w-48'
      const SUBMENU_WIDTH = Math.max(192, calculatedWidth);

      if (rect.right + SUBMENU_WIDTH > window.innerWidth) {
        submenuDirection = 'left';
      } else {
        submenuDirection = 'right';
      }
    }
  }

  function toggleFilter() {
    if (!filterOpen) {
      filterSearchTerm = '';
    }
    filterOpen = !filterOpen;
  }

  function close() {
    activeKey = '';
    filterOpen = false;
    triggerElement = null;
    scrollContainer = null;
    useRightPositioning = false;
  }

  function handleOutsideClick(e: MouseEvent) {
    if (activeKey === '') return;
    const target = e.target as HTMLElement;
    if (target.closest('.header-interactive')) return;
    close();
  }

  // Return public API
  return {
    // State accessors
    get activeKey() { return activeKey },
    get filterOpen() { return filterOpen },
    get filterSearchTerm() { return filterSearchTerm },
    set filterSearchTerm(val: string) { filterSearchTerm = val },
    get x() { return x },
    get y() { return y },
    get submenuDirection() { return submenuDirection },
    get useRightPositioning() { return useRightPositioning },
    get menuElement() { return menuElement },
    set menuElement(el: HTMLElement | undefined) { menuElement = el },

    // Actions
    toggle,
    reposition,
    toggleFilter,
    close,
    handleOutsideClick,
    calculateSubmenuDirection
  };
}

export type HeaderMenuState = ReturnType<typeof createHeaderMenuState>;

// Export factory function
export const createHeaderMenu = createHeaderMenuState;