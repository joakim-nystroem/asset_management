import type { SelectionManager } from './selectionManager.svelte';
import type { HistoryManager, HistoryAction } from './historyManager.svelte'; 

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
  }
}

async function readFromClipboard(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  } catch (err) {
    console.error('Failed to read from clipboard:', err);
    return null;
  }
}

export type CopiedItem = {
  relRow: number;
  relCol: number;
  value: string;
};

export class ClipboardManager {
  internal = $state<CopiedItem[]>([]);
  private lastCopiedText = '';

  async copy(
    selectionManager: SelectionManager,
    assets: any[],
    keys: string[]
  ) {
    // 1. Snapshot visual overlay
    selectionManager.snapshotAsCopied();

    // 2. Get selection bounds
    const bounds = selectionManager.getBounds();
    if (!bounds) return;

    // 3. Capture data
    const newClipboard: CopiedItem[] = [];
    const externalRows: string[] = [];

    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      const rowStrings: string[] = [];

      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        const key = keys[c];
        const value = String(assets[r][key] ?? '');

        // A. Internal Memory (Relative Position)
        newClipboard.push({
          relRow: r - bounds.minRow,
          relCol: c - bounds.minCol,
          value: value
        });

        // B. External String (For Excel/Notepad)
        rowStrings.push(value);
      }

      // Join columns with Tab (\t)
      externalRows.push(rowStrings.join('\t'));
    }

    this.internal = newClipboard;
    
    const textBlock = externalRows.join('\n');
    this.lastCopiedText = textBlock;

    // Copy to system clipboard (async)
    setTimeout(async () => {
      await copyToClipboard(textBlock);
    }, 0);
  }

  /**
   * Paste from clipboard using Batch Recording
   */
  async paste(
    target: { row: number; col: number } | null,
    assets: any[],
    keys: string[],
    historyManager: HistoryManager
  ): Promise<{ rows: number; cols: number } | null> {
    if (!target) return null;
    
    const systemText = await readFromClipboard();
    if (systemText === null) return null;

    // Determine if we can use internal high-fidelity clipboard or must parse text
    const useInternal = this.internal.length > 0 && systemText === this.lastCopiedText;
    
    // Collection for batch history
    const batchChanges: HistoryAction[] = [];
    
    // Track paste dimensions
    let maxRelRow = 0;
    let maxRelCol = 0;

    if (useInternal) {
      for (const item of this.internal) {
        const destRow = target.row + item.relRow;
        const destCol = target.col + item.relCol;
        
        // Track dimensions
        if (item.relRow > maxRelRow) maxRelRow = item.relRow;
        if (item.relCol > maxRelCol) maxRelCol = item.relCol;

        // Apply value and collect change record
        const change = this.applyValue(destRow, destCol, item.value, assets, keys);
        if (change) batchChanges.push(change);
      }
    } else {
      const rows = systemText.split(/\r?\n/);
      rows.forEach((rowStr, rIdx) => {
        if (!rowStr) return;
        
        // Track row dimension
        if (rIdx > maxRelRow) maxRelRow = rIdx;

        const cells = rowStr.split('\t');
        cells.forEach((cellValue, cIdx) => {
          // Track col dimension
          if (cIdx > maxRelCol) maxRelCol = cIdx;

          const destRow = target.row + rIdx;
          const destCol = target.col + cIdx;
          
          // Apply value and collect change record
          const change = this.applyValue(destRow, destCol, cellValue, assets, keys);
          if (change) batchChanges.push(change);
        });
      });
    }

    // Commit all changes as a single history event
    if (batchChanges.length > 0) {
      historyManager.recordBatch(batchChanges);
      console.log(`Pasted ${batchChanges.length} cells.`);
    }

    return { rows: maxRelRow + 1, cols: maxRelCol + 1 };
  }

  private applyValue(
    row: number, 
    col: number, 
    value: string, 
    assets: any[], 
    keys: string[]
  ): HistoryAction | null {
    if (row >= 0 && row < assets.length && col >= 0 && col < keys.length) {
      const asset = assets[row];
      const key = keys[col];
      const oldValue = String(asset[key] ?? '');
      
      if (oldValue !== value) {
        asset[key] = value;
        return { id: asset.id, key, oldValue, newValue: value };
      }
    }
    return null;
  }

  clear() {
    this.internal = [];
    this.lastCopiedText = '';
  }

  hasData() {
    return this.internal.length > 0;
  }
}