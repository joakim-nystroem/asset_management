import { columnWidthStore } from '$lib/data/uiStore.svelte';
import { assetStore } from '$lib/data/assetStore.svelte';
import { DEFAULT_WIDTH, DEFAULT_ROW_HEIGHT } from '$lib/grid/gridConfig';

export function getWidth(key: string): number {
  return columnWidthStore.widths.get(key) ?? DEFAULT_WIDTH;
}

export function computeVisualOverlay(
  start: { row: number; col: string },
  end: { row: number; col: string },
  visibleRange: { startIndex: number; endIndex: number },
  scrollTop: number,
) {
  // Column keys from first asset
  const keys = Object.keys(assetStore.displayedAssets[0] ?? {});
  const rowHeight = DEFAULT_ROW_HEIGHT;

  // Find asset position by ID
  const startRowIdx = assetStore.displayedAssets.findIndex((a: Record<string, any>) => a.id === start.row);
  // Find asset position by ID
  const endRowIdx = assetStore.displayedAssets.findIndex((a: Record<string, any>) => a.id === end.row);
  if (startRowIdx === -1 || endRowIdx === -1) return null;

  const startColIdx = keys.indexOf(start.col);
  const endColIdx = keys.indexOf(end.col);
  if (startColIdx === -1 || endColIdx === -1) return null;

  const minRow = Math.min(startRowIdx, endRowIdx);
  const maxRow = Math.max(startRowIdx, endRowIdx);
  const minCol = Math.min(startColIdx, endColIdx);
  const maxCol = Math.max(startColIdx, endColIdx);

  const clampedMinRow = Math.max(minRow, visibleRange.startIndex);
  const clampedMaxRow = Math.min(maxRow, visibleRange.endIndex - 1);
  if (clampedMinRow > clampedMaxRow) return null;

  let left = 0;
  for (let c = 0; c < minCol; c++) left += getWidth(keys[c]);
  let width = 0;
  for (let c = minCol; c <= maxCol; c++) width += getWidth(keys[c]);

  const top = clampedMinRow * rowHeight - scrollTop;
  const height = (clampedMaxRow - clampedMinRow + 1) * rowHeight;

  return {
    top, left, width, height,
    showTopBorder: minRow >= visibleRange.startIndex,
    showBottomBorder: maxRow < visibleRange.endIndex,
    showLeftBorder: true,
    showRightBorder: true,
  };
}

export function computeLocalPendingOverlays(
  edits: { row: number; col: string; isValid: boolean; value: string }[],
  visibleRange: { startIndex: number; endIndex: number },
  scrollTop: number,
) {
  if (edits.length === 0) return [];

  const assets = assetStore.displayedAssets;
  // Column keys from first asset
  const keys = Object.keys(assets[0] ?? {});
  const { startIndex, endIndex } = visibleRange;
  const rowHeight = DEFAULT_ROW_HEIGHT;

  const editMap = new Map<string, typeof edits[0]>();
  for (const edit of edits) {
    const rowIdx = assets.findIndex((a: Record<string, any>) => a.id === edit.row);
    if (rowIdx === -1) continue;
    const colIdx = keys.indexOf(edit.col);
    if (colIdx === -1) continue;
    editMap.set(`${rowIdx},${colIdx}`, edit);
  }

  const overlays: { top: number; left: number; width: number; height: number; isValid: boolean; value: string; borderTop: boolean; borderBottom: boolean; borderLeft: boolean; borderRight: boolean }[] = [];

  for (const [coord, edit] of editMap) {
    const [rowIdx, colIdx] = coord.split(',').map(Number);
    if (rowIdx < startIndex || rowIdx >= endIndex) continue;

    let left = 0;
    for (let c = 0; c < colIdx; c++) left += getWidth(keys[c]);
    const w = getWidth(keys[colIdx]);
    const top = rowIdx * rowHeight - scrollTop;

    const sameAbove = editMap.get(`${rowIdx - 1},${colIdx}`)?.isValid === edit.isValid && editMap.has(`${rowIdx - 1},${colIdx}`);
    const sameBelow = editMap.get(`${rowIdx + 1},${colIdx}`)?.isValid === edit.isValid && editMap.has(`${rowIdx + 1},${colIdx}`);
    const sameLeft = editMap.get(`${rowIdx},${colIdx - 1}`)?.isValid === edit.isValid && editMap.has(`${rowIdx},${colIdx - 1}`);
    const sameRight = editMap.get(`${rowIdx},${colIdx + 1}`)?.isValid === edit.isValid && editMap.has(`${rowIdx},${colIdx + 1}`);

    overlays.push({
      top, left, width: w, height: rowHeight,
      isValid: edit.isValid, value: edit.value,
      borderTop: !sameAbove, borderBottom: !sameBelow,
      borderLeft: !sameLeft, borderRight: !sameRight,
    });
  }
  return overlays;
}

export function computeRemotePendingOverlays(
  pendingCells: { assetId: number; key: string; color: string; firstname: string; lastname: string }[],
  visibleRange: { startIndex: number; endIndex: number },
  scrollTop: number,
) {
  if (pendingCells.length === 0) return [];

  const assets = assetStore.displayedAssets;
  // Column keys from first asset
  const keys = Object.keys(assets[0] ?? {});
  const { startIndex, endIndex } = visibleRange;
  const rowHeight = DEFAULT_ROW_HEIGHT;

  const overlays: { top: number; left: number; width: number; height: number; color: string; name: string }[] = [];

  for (const cell of pendingCells) {
    const rowIdx = assets.findIndex((a: Record<string, any>) => a.id === cell.assetId);
    if (rowIdx === -1 || rowIdx < startIndex || rowIdx >= endIndex) continue;
    const colIdx = keys.indexOf(cell.key);
    if (colIdx === -1) continue;

    let left = 0;
    for (let c = 0; c < colIdx; c++) left += getWidth(keys[c]);
    const w = getWidth(keys[colIdx]);
    const top = rowIdx * rowHeight - scrollTop;

    overlays.push({
      top, left, width: w, height: rowHeight,
      color: cell.color || '#6b7280',
      name: `${cell.firstname || ''} ${cell.lastname || ''}`.trim(),
    });
  }
  return overlays;
}
