import type { SvelteMap } from 'svelte/reactivity';
import type { VirtualScrollManager } from '$lib/grid/utils/virtualScrollManager.svelte.ts';

import { DEFAULT_WIDTH } from '$lib/grid/gridConfig';

/**
 * Compute the absolute pixel position of EditHandler within GridOverlays.
 *
 * GridOverlays div contains: header (32px) + rows at absolute positions.
 * EditHandler is absolutely positioned within GridOverlays' div.
 *
 * @param editRowId - Asset ID (from editingCtx.editRow)
 * @param assets - Current filteredAssets array (for ID → index conversion)
 */
export function computeEditorPosition(
  editRowId: number,
  editCol: string,
  columnWidths: SvelteMap<string, number>,
  keys: string[],
  assets: Record<string, any>[],
  virtualScroll: VirtualScrollManager
): { top: number; left: number; width: number; height: number } | null {
  const rowIndex = assets.findIndex((a) => a.id === editRowId);
  if (rowIndex === -1) return null;

  const colIdx = keys.indexOf(editCol);
  if (colIdx === -1) return null;

  const rowHeight = virtualScroll.rowHeight;

  // Y: header (32px) + row position
  const top = 32 + rowIndex * rowHeight;

  // X: sum of widths of all columns before editCol
  let left = 0;
  for (let i = 0; i < colIdx; i++) {
    left += columnWidths.get(keys[i]) ?? DEFAULT_WIDTH;
  }

  const width = columnWidths.get(editCol) ?? DEFAULT_WIDTH;
  const height = rowHeight;

  return { top, left, width, height };
}
