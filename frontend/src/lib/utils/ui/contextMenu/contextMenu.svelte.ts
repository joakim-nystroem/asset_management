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
    
    // Estimate menu width
    const estimatedWidth = 150; 
    const windowWidth = window.innerWidth;

    if (e.clientX + estimatedWidth > windowWidth) {
      this.x = e.clientX - estimatedWidth;
    } else {
      this.x = e.clientX;
    }

    this.y = e.clientY;
    this.row = row;
    this.col = col;
    this.value = value; // NEW
    this.key = key;     // NEW
  }

  close() {
    this.visible = false;
  }
}