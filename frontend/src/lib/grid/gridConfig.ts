/** Default column width in pixels when no explicit width is set in ColumnWidthContext. */
export const DEFAULT_WIDTH = 150;
/** Default row height in pixels when no explicit height is set in RowHeightContext. */
export const DEFAULT_ROW_HEIGHT = 32;
/** Minimum column width in pixels during drag-to-resize. */
export const MIN_COLUMN_WIDTH = 50;
/** Columns that cannot be edited by users (system-managed). */
export const NON_EDITABLE_COLUMNS = new Set(['id', 'modified', 'modified_by']);

