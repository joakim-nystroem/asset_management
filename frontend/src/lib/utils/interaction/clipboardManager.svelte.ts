// Local interfaces to avoid cross-imports
interface SelectionManager {
  bounds: { minRow: number; maxRow: number; minCol: number; maxCol: number } | null;
  snapshotAsCopied(): void;
}

export type HistoryAction = {
  id: number | string;
  key: string;
  oldValue: string;
  newValue: string;
};

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

function createClipboardManager(selectionManager: SelectionManager) {
  // Internal clipboard state
  let internal = $state<CopiedItem[]>([]);
  let lastCopiedText = $state('');

  // Actions
  async function copy(
    assets: any[],
    keys: string[]
  ) {
    // 1. Snapshot visual overlay
    selectionManager.snapshotAsCopied();

    // 2. Get selection bounds
    const bounds = selectionManager.bounds;
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

    internal = newClipboard;
    
    const textBlock = externalRows.join('\n');
    lastCopiedText = textBlock;

    // Copy to system clipboard (async)
    setTimeout(async () => {
      await copyToClipboard(textBlock);
    }, 0);
  }

  async function paste(
    target: { row: number; col: number } | null,
    assets: any[],
    keys: string[],
  ): Promise<{ rows: number; cols: number, changes: HistoryAction[] } | null> {
    if (!target) return null;
    
    const systemText = await readFromClipboard();
    if (systemText === null) return null;

    const useInternal = internal.length > 0 && systemText === lastCopiedText;
    const batchChanges: HistoryAction[] = [];

    let copiedBlock: string[][] = [];

    // Parse clipboard data into a 2D array (block)
    if (useInternal) {
      // Determine dimensions of the internal clipboard data
      let maxRelRow = 0;
      let maxRelCol = 0;
      for (const item of internal) {
        if (item.relRow > maxRelRow) maxRelRow = item.relRow;
        if (item.relCol > maxRelCol) maxRelCol = item.relCol;
      }

      // Initialize copiedBlock with correct dimensions
      for (let r = 0; r <= maxRelRow; r++) {
        copiedBlock.push(new Array(maxRelCol + 1).fill(''));
      }

      // Populate copiedBlock
      for (const item of internal) {
        copiedBlock[item.relRow][item.relCol] = item.value;
      }
    } else {
      const rows = systemText.split(/\r?\n/);
      // If the last line is empty string, it's a trailing newline, so remove it.
      if (rows.length > 0 && rows[rows.length - 1] === '') {
        rows.pop();
      }

      const rawCopiedBlock = rows.map(rowStr => rowStr.split('\t'));

      if (rawCopiedBlock.length > 0) {
          const isRectangular = rawCopiedBlock.every(row => row.length === rawCopiedBlock[0].length);
          if (isRectangular && rawCopiedBlock[0].length > 1) {
            const allRowsHaveTrailingEmpty = rawCopiedBlock.every(row => row[row.length-1] === '');
            if (allRowsHaveTrailingEmpty) {
                copiedBlock = rawCopiedBlock.map(row => {
                    row.pop();
                    return row;
                });
            } else {
                copiedBlock = rawCopiedBlock;
            }
          } else {
            copiedBlock = rawCopiedBlock;
          }
      } else {
          copiedBlock = rawCopiedBlock;
      }
    }

    if (copiedBlock.length === 0 || copiedBlock[0].length === 0) return null;

    const copiedBlockHeight = copiedBlock.length;
    const copiedBlockWidth = copiedBlock[0].length;

    const selectionBounds = selectionManager.bounds;
    const isSingleCellSelection = selectionBounds && 
      selectionBounds.minRow === selectionBounds.maxRow && 
      selectionBounds.minCol === selectionBounds.maxCol;
    const hasMultiCellSelection = selectionBounds && !isSingleCellSelection;

    let effectivePasteRows = 0;
    let effectivePasteCols = 0;

    if (hasMultiCellSelection) {
      // Distributed paste to multiple selected cells
      const pasteStartRow = selectionBounds.minRow;
      const pasteEndRow = selectionBounds.maxRow;
      const pasteStartCol = selectionBounds.minCol;
      const pasteEndCol = selectionBounds.maxCol;

      effectivePasteRows = pasteEndRow - pasteStartRow + 1;
      effectivePasteCols = pasteEndCol - pasteStartCol + 1;

      for (let r = pasteStartRow; r <= pasteEndRow; r++) {
        for (let c = pasteStartCol; c <= pasteEndCol; c++) {
          const relRowInBlock = (r - pasteStartRow) % copiedBlockHeight;
          const relColInBlock = (c - pasteStartCol) % copiedBlockWidth;
          const valueToPaste = copiedBlock[relRowInBlock][relColInBlock];
          
          const change = applyValue(r, c, valueToPaste, assets, keys);
          if (change) batchChanges.push(change);
        }
      }
    } else {
      // Old functionality: paste as a block starting from 'target'
      // Or if there's a single cell selection, 'target' is that cell
      const pasteStartRow = target.row;
      const pasteStartCol = target.col;

      effectivePasteRows = copiedBlockHeight;
      effectivePasteCols = copiedBlockWidth;

      for (let r = 0; r < copiedBlockHeight; r++) {
        for (let c = 0; c < copiedBlockWidth; c++) {
          const destRow = pasteStartRow + r;
          const destCol = pasteStartCol + c;
          const valueToPaste = copiedBlock[r][c];

          const change = applyValue(destRow, destCol, valueToPaste, assets, keys);
          if (change) batchChanges.push(change);
        }
      }
    }

    return { rows: effectivePasteRows, cols: effectivePasteCols, changes: batchChanges };
  }

  function applyValue(
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

  function clear() {
    internal = [];
    lastCopiedText = '';
  }

  // Derived
  const hasData = $derived(internal.length > 0);

  // Return public API
  return {
    get internal() { return internal },
    get lastCopiedText() { return lastCopiedText },
    get hasData() { return hasData },
    
    copy,
    paste,
    clear
  };
}

export type ClipboardManager = ReturnType<typeof createClipboardManager>;
export const createClipboard = createClipboardManager;