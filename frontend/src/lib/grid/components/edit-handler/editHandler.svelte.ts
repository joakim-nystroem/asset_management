import type { SvelteMap } from 'svelte/reactivity';

import { DEFAULT_WIDTH, DEFAULT_ROW_HEIGHT } from '$lib/grid/gridConfig';

/**
 * Compute the absolute pixel position of EditHandler within the scroll viewport.
 *
 * @param editRowId - Asset ID (from editingCtx.editRow)
 * @param assets - Current displayedAssets array (for ID → index conversion)
 */
export function computeEditorPosition(
  editRowId: number,
  editCol: string,
  columnWidths: SvelteMap<string, number>,
  keys: string[],
  assets: Record<string, any>[],
  rowHeight: number = DEFAULT_ROW_HEIGHT
): { top: number; left: number; width: number; height: number } | null {
  const rowIndex = assets.findIndex((a) => a.id === editRowId);
  if (rowIndex === -1) return null;

  const colIdx = keys.indexOf(editCol);
  if (colIdx === -1) return null;

  // Y: row position (header is outside scroll container)
  const top = rowIndex * rowHeight;

  // X: sum of widths of all columns before editCol
  let left = 0;
  for (let i = 0; i < colIdx; i++) {
    left += columnWidths.get(keys[i]) ?? DEFAULT_WIDTH;
  }

  const width = columnWidths.get(editCol) ?? DEFAULT_WIDTH;
  const height = rowHeight;

  return { top, left, width, height };
}
