export class ContextMenuState {
  visible = $state(false);
  x = $state(0);
  y = $state(0);
  row = $state(-1);
  col = $state(-1);
  value = $state(''); // NEW: Store the cell value
  key = $state('');   // NEW: Store the column key

  open(e: MouseEvent, row: number, col: number, value: string, key: string) {
    e.preventDefault();
    this.visible = true;

    // Estimate menu dimensions
    const estimatedWidth = 150;
    const estimatedHeight = 200; // Approximate height with all menu items
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Horizontal positioning
    if (e.clientX + estimatedWidth > windowWidth) {
      this.x = e.clientX - estimatedWidth;
    } else {
      this.x = e.clientX;
    }

    // Vertical positioning - grow upward if near bottom
    if (e.clientY + estimatedHeight > windowHeight) {
      this.y = e.clientY - estimatedHeight;
    } else {
      this.y = e.clientY;
    }

    this.row = row;
    this.col = col;
    this.value = value; // NEW
    this.key = key;     // NEW
  }

  close() {
    this.visible = false;
  }
}