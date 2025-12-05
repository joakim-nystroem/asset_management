// src/lib/components/ui/headerMenu/headerMenu.svelte.ts

export class HeaderMenuState {
  // The column currently open (e.g. 'manufacturer')
  activeKey = $state(''); 
  filterOpen = $state(false);

  filterSearchTerm = $state('');
  
  // Position of the menu
  x = $state(0);
  y = $state(0);

  toggle(e: MouseEvent, key: string) {
    e.stopPropagation();

    // If clicking the same key, close it
    if (this.activeKey === key) {
      this.close();
      return;
    }

    // Calculate Position
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    this.activeKey = key;
    this.filterOpen = false; // Reset sub-menu
    this.y = rect.bottom;
    this.x = rect.left;
  }

  toggleFilter() {
    if (!this.filterOpen) {
      this.filterSearchTerm = '';
    }
    this.filterOpen = !this.filterOpen;
  }

  close() {
    this.activeKey = '';
    this.filterOpen = false;
  }

  // Check if we should close based on a click target
  handleOutsideClick(e: MouseEvent) {
    if (this.activeKey === '') return;
    
    const target = e.target as HTMLElement;
    // If clicking inside a header button, don't close (let the button logic handle it)
    if (target.closest('.header-interactive')) return;
    
    this.close();
  }
}