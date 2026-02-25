
export class FilterPanelState {
  isOpen = $state(false);

  toggle() {
    this.isOpen = !this.isOpen;
  }

  open() {
    this.isOpen = true;
  }

  close() {
    this.isOpen = false;
  }

  handleOutsideClick(e: MouseEvent, panelElement: HTMLElement | null) {
    if (panelElement && !panelElement.contains(e.target as Node)) {
      this.close();
    }
  }
}
// ---------------------------------------------------------------------------
