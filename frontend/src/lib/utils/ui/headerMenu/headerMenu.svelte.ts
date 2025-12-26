// src/lib/utils/ui/headerMenu/headerMenu.svelte.ts

export class HeaderMenuState {
  activeKey = $state(''); 
  filterOpen = $state(false);
  filterSearchTerm = $state('');
  x = $state(0);
  y = $state(0);
  submenuDirection = $state<'left' | 'right'>('right');
  menuElement: HTMLElement | undefined;

  private triggerElement: HTMLElement | null = null;
  private savedFilterItems: string[] = [];

  toggle(e: MouseEvent, key: string, filterItems: string[] = []) {
    e.stopPropagation();

    if (this.activeKey === key) {
      this.close();
      return;
    }

    this.triggerElement = e.currentTarget as HTMLElement;
    this.savedFilterItems = filterItems;
    this.activeKey = key;
    this.filterOpen = false; 
    this.filterSearchTerm = '';

    if (this.menuElement) {
      this.menuElement.style.display = 'block';
    }

    // Calculate initial position
    this.reposition();
  }

  reposition() {
    if (!this.triggerElement || !this.activeKey) return;

    const rect = this.triggerElement.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const MAIN_MENU_WIDTH = 220;

    let calculatedX = rect.left;

    if (calculatedX + MAIN_MENU_WIDTH > windowWidth) {
      calculatedX = Math.max(0, windowWidth - MAIN_MENU_WIDTH - 8);
    }
    
    // Update State (keeps Svelte in sync for next render)
    this.x = calculatedX;
    this.y = rect.bottom;

    // --- DIRECT DOM UPDATE (Fixes the lag) ---
    if (this.menuElement) {
      this.menuElement.style.left = `${calculatedX}px`;
      this.menuElement.style.top = `${rect.bottom}px`;
    }

    // Recalculate Submenu Direction
    const maxItemLength = this.savedFilterItems.reduce((max, item) => Math.max(max, (item || '').length), 0);
    const estimatedSubmenuWidth = Math.max(200, maxItemLength * 8 + 40);
    const spaceOnRight = windowWidth - (this.x + MAIN_MENU_WIDTH);

    this.submenuDirection = spaceOnRight < estimatedSubmenuWidth ? 'left' : 'right';
  }
  
  // ... rest of the file (toggleFilter, close, handleOutsideClick)
  toggleFilter() {
    if (!this.filterOpen) {
      this.filterSearchTerm = '';
    }
    this.filterOpen = !this.filterOpen;
  }

  close() {
    this.activeKey = '';
    this.filterOpen = false;
    this.triggerElement = null;
  }

  handleOutsideClick(e: MouseEvent) {
    if (this.activeKey === '') return;
    const target = e.target as HTMLElement;
    if (target.closest('.header-interactive')) return;
    this.close();
  }
}