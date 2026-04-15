import type { SvelteMap } from 'svelte/reactivity';

import { DEFAULT_WIDTH, DEFAULT_ROW_HEIGHT } from '$lib/grid/gridConfig';

/** Minimum width before text wraps in the edit box. Columns wider than this use their own width. */
export const MIN_EDIT_WIDTH = 280;

/** Horizontal padding inside the textarea (px-1.5 = 6px each side + 2px border each side) */
const EDITOR_H_PADDING = 16;

// Offscreen canvas for text width measurement (matches grid cell font: text-xs 12px)
let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureCtx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d')!;
    measureCtx.font = '12px system-ui, -apple-system, sans-serif';
  }
  return measureCtx;
}

/** Measure pixel width of text using offscreen canvas. */
export function measureTextWidth(text: string): number {
  return getMeasureCtx().measureText(text).width;
}

/**
 * Compute dynamic editor dimensions based on text content.
 * Width grows with text up to wrapWidth, then text wraps and height grows.
 */
export function computeEditorDimensions(
  text: string,
  colWidth: number,
): { width: number; height: number } {
  const wrapWidth = Math.max(MIN_EDIT_WIDTH, colWidth);
  const textWidth = measureTextWidth(text);
  // Content area = box width minus padding (where text actually wraps)
  const contentWidth = wrapWidth - EDITOR_H_PADDING;

  if (textWidth <= contentWidth) {
    // Text fits — editor width = text width + padding (at least column width)
    return { width: Math.max(colWidth, textWidth + EDITOR_H_PADDING), height: DEFAULT_ROW_HEIGHT };
  }

  // First wrap → expand to 2 rows. After that, grow every 2 lines (2 text lines fit per row height)
  const lines = Math.ceil(textWidth / contentWidth);
  // lines=1 → 1 row, lines=2 → 2 rows, lines=3 → 2 rows, lines=4 → 3 rows, lines=5 → 3 rows...
  const rows = 1 + Math.ceil((lines - 1) / 2);
  return { width: wrapWidth, height: rows * DEFAULT_ROW_HEIGHT };
}

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
