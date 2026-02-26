import type { RowController } from '$lib/grid/utils/gridRows.svelte.ts';
import type { ColumnController } from '$lib/grid/utils/gridColumns.svelte.ts';
import type { VirtualScrollManager } from '$lib/grid/utils/virtualScrollManager.svelte.ts';

/**
 * Compute the absolute pixel position of FloatingEditor within the translated virtual-chunk.
 *
 * FloatingEditor is mounted INSIDE the chunk whose translateY = virtualScroll.getOffsetY(rows).
 * To position relative to the chunk's top edge we subtract the chunk origin from the row's
 * absolute offset.
 *
 * @param editRow       - The row index being edited
 * @param editCol       - The column index being edited
 * @param editKey       - The column key being edited
 * @param keys          - All column keys in order
 * @param rows          - RowController instance
 * @param columns       - ColumnController instance
 * @param virtualScroll - VirtualScrollManager instance (from ctx.virtualScroll)
 */
export function computeEditorPosition(
  editRow: number,
  editCol: number,
  editKey: string,
  keys: string[],
  rows: RowController,
  columns: ColumnController,
  virtualScroll: VirtualScrollManager
): { top: number; left: number; width: number; height: number } {
  // Y: row absolute offset minus the chunk's translateY origin
  // virtualScroll.getOffsetY(rows) returns rows.getOffsetY(visibleRange.startIndex)
  const chunkOriginY = virtualScroll.getOffsetY(rows);
  const rowAbsoluteY = rows.getOffsetY(editRow);
  const top = rowAbsoluteY - chunkOriginY;

  // X: sum of widths of all columns before editCol
  let left = 0;
  for (let i = 0; i < editCol; i++) {
    left += columns.getWidth(keys[i]);
  }

  const width = columns.getWidth(editKey);
  const height = rows.getHeight(editRow);

  return { top, left, width, height };
}
