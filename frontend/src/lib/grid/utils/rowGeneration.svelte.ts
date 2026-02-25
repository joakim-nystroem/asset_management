import { getGridContext } from '$lib/context/gridContext.svelte.ts';

type NewRow = Record<string, unknown>;
type NextIdProvider = () => number;

export function createRowGenerationController() {
  const ctx = getGridContext();

  // Local state: new rows pending commit
  let newRows = $state<NewRow[]>([]);
  // Local state: invalid fields per row index
  let invalidFields = $state<Map<number, Set<string>>>(new Map());
  // Local state: next ID provider
  let nextIdProvider = $state<NextIdProvider | null>(null);

  function isValidValue(key: string, value: unknown): boolean {
    const valueStr = String(value ?? '').trim();
    const list = ctx.validationConstraints[key];
    if (!list || list.length === 0) return true;
    if (valueStr === '') return true;
    return list.some((v) => v.toLowerCase() === valueStr.toLowerCase());
  }

  /**
   * Set the provider function for generating next IDs.
   */
  function setNextIdProvider(provider: NextIdProvider) {
    nextIdProvider = provider;
  }

  /**
   * Get the next ID for a new row.
   */
  function getNextId(): number {
    if (!nextIdProvider) return 1;
    return nextIdProvider();
  }

  /**
   * Add new rows with a template.
   */
  function addNewRows(count: number, template: Record<string, unknown>): NewRow[] {
    const created: NewRow[] = [];

    for (let i = 0; i < count; i++) {
      const newRow: NewRow = {
        ...template,
        id: getNextId(),
      };
      newRows.push(newRow);
      created.push(newRow);
    }

    return created;
  }

  /**
   * Update a field in a new row.
   */
  function updateNewRowField(newRowIndex: number, key: string, value: unknown) {
    if (newRowIndex < 0 || newRowIndex >= newRows.length) {
      console.error('Invalid newRowIndex:', newRowIndex);
      return;
    }

    // Don't allow editing the ID field
    if (key === 'id') return;

    newRows[newRowIndex][key] = value;

    // Clear invalid state for this cell (optimistic — full revalidation on commit)
    const rowErrors = invalidFields.get(newRowIndex);
    if (rowErrors && rowErrors.has(key)) {
      rowErrors.delete(key);
      if (rowErrors.size === 0) {
        invalidFields.delete(newRowIndex);
      }
      invalidFields = new Map(invalidFields);
    }
  }

  /**
   * Delete a new row.
   */
  function deleteNewRow(newRowIndex: number) {
    if (newRowIndex < 0 || newRowIndex >= newRows.length) {
      console.error('Invalid newRowIndex:', newRowIndex);
      return;
    }

    newRows.splice(newRowIndex, 1);

    // Rebuild invalidFields map with updated indices
    const newInvalidFields = new Map<number, Set<string>>();
    invalidFields.forEach((fields, idx) => {
      if (idx < newRowIndex) {
        newInvalidFields.set(idx, fields);
      } else if (idx > newRowIndex) {
        newInvalidFields.set(idx - 1, fields);
      }
      // Skip idx === newRowIndex (the deleted row)
    });
    invalidFields = newInvalidFields;
  }

  /**
   * Validate all new rows against the current validation constraints.
   * Returns true if all rows are valid.
   */
  function validateAll(): boolean {
    invalidFields.clear();

    let allValid = true;

    newRows.forEach((row, rowIndex) => {
      const rowErrors = new Set<string>();

      Object.keys(row).forEach((key) => {
        if (key === 'id') return;
        const value = row[key];
        if (!isValidValue(key, value)) {
          rowErrors.add(key);
          allValid = false;
        }
      });

      if (rowErrors.size > 0) {
        invalidFields.set(rowIndex, rowErrors);
      }
    });

    // Trigger reactivity (Map mutations aren't tracked by $state)
    invalidFields = new Map(invalidFields);

    return allValid;
  }

  /**
   * Check if a specific field in a new row is invalid.
   */
  function isNewRowFieldInvalid(newRowIndex: number, key: string): boolean {
    const fieldErrors = invalidFields.get(newRowIndex);
    return fieldErrors ? fieldErrors.has(key) : false;
  }

  /**
   * Clear all new rows and validation errors.
   */
  function clearNewRows() {
    newRows = [];
    invalidFields = new Map();
  }

  /**
   * Clear validation errors without removing the rows.
   */
  function clearValidation() {
    invalidFields = new Map();
  }

  /**
   * Get all valid new rows (rows without validation errors).
   */
  function getValidNewRows(): NewRow[] {
    return newRows.filter((_, idx) => !invalidFields.has(idx));
  }

  /**
   * Get all invalid new rows with their indices.
   */
  function getInvalidNewRows(): Array<{ index: number; row: NewRow }> {
    return Array.from(invalidFields.keys()).map((idx) => ({
      index: idx,
      row: newRows[idx],
    }));
  }

  const newRowCount = $derived(newRows.length);
  const hasNewRows = $derived(newRows.length > 0);
  const hasInvalidNewRows = $derived(invalidFields.size > 0);
  const invalidNewRowCount = $derived(
    Array.from(invalidFields.values()).reduce((sum, fields) => sum + fields.size, 0),
  );

  return {
    get newRows() { return newRows; },
    get newRowCount() { return newRowCount; },
    get hasNewRows() { return hasNewRows; },
    get hasInvalidNewRows() { return hasInvalidNewRows; },
    get invalidNewRowCount() { return invalidNewRowCount; },

    setNextIdProvider,
    addNewRows,
    updateNewRowField,
    deleteNewRow,
    validateAll,
    clearNewRows,
    clearValidation,
    isNewRowFieldInvalid,
    getValidNewRows,
    getInvalidNewRows,
  };
}

export type RowGenerationController = ReturnType<typeof createRowGenerationController>;
