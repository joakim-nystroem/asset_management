/**
 * Row Generation Manager
 *
 * Manages creation, editing, validation, and deletion of new rows.
 * New rows are stored separately from the main asset array until committed.
 */

import { validationManager } from '$lib/utils/data/validationManager.svelte';

type NewRow = Record<string, any>;
type NextIdProvider = () => number;

function createRowGenerationManager() {
  let newRows = $state<NewRow[]>([]);
  let invalidFields = $state<Map<number, Set<string>>>(new Map());
  let nextIdProvider = $state<NextIdProvider | null>(null);

  /**
   * Set the provider function for generating next IDs
   * @param provider Function that returns the next ID to use
   */
  function setNextIdProvider(provider: NextIdProvider) {
    nextIdProvider = provider;
  }

  /**
   * Get the next ID for a new row
   * @returns The next ID number
   */
  function getNextId(): number {
    if (!nextIdProvider) {
      return 1;
    }
    return nextIdProvider();
  }

  /**
   * Add new rows with a template
   * @param count Number of rows to add
   * @param template Template object with default values for all columns (except ID)
   * @returns The array of newly created rows
   */
  function addNewRows(count: number, template: Record<string, any>): NewRow[] {
    const created: NewRow[] = [];

    for (let i = 0; i < count; i++) {
      const newRow: NewRow = {
        ...template,
        id: getNextId(),
      };
      const newRowIndex = newRows.length;
      newRows.push(newRow);
      created.push(newRow);

      // Eagerly validate the new empty row
      const rowErrors = new Set<string>();
      Object.keys(newRow).forEach((key) => {
        if (key === 'id') return;
        if (!validationManager.isValidValue(key, newRow[key])) {
          rowErrors.add(key);
        }
      });
      if (rowErrors.size > 0) {
        invalidFields.set(newRowIndex, rowErrors);
      }
    }
    // Trigger reactivity for invalidFields map
    invalidFields = new Map(invalidFields);

    return created;
  }

  /**
   * Update a field in a new row
   * @param newRowIndex Index in the newRows array
   * @param key Field name
   * @param value New value (can be any value, validation happens on commit)
   */
  function updateNewRowField(newRowIndex: number, key: string, value: any) {
    if (newRowIndex < 0 || newRowIndex >= newRows.length) {
      console.error('Invalid newRowIndex:', newRowIndex);
      return;
    }

    // Don't allow editing the ID field
    if (key === 'id') {
      console.warn('Cannot edit ID field');
      return;
    }

    // Update the field value
    newRows[newRowIndex][key] = value;

    // Re-validate the field and update invalid status
    const rowErrors = invalidFields.get(newRowIndex) || new Set<string>();
    const isValid = validationManager.isValidValue(key, value);

    if (isValid) {
      rowErrors.delete(key);
    } else {
      rowErrors.add(key);
    }

    if (rowErrors.size === 0) {
      invalidFields.delete(newRowIndex);
    } else {
      invalidFields.set(newRowIndex, rowErrors);
    }
    // Trigger reactivity
    invalidFields = new Map(invalidFields);
  }

  /**
   * Delete a new row
   * @param newRowIndex Index in the newRows array
   */
  function deleteNewRow(newRowIndex: number) {
    if (newRowIndex < 0 || newRowIndex >= newRows.length) {
      console.error('Invalid newRowIndex:', newRowIndex);
      return;
    }

    // Remove the row
    newRows.splice(newRowIndex, 1);

    // Rebuild the invalidFields map with updated indices
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
   * Validate all new rows against the current validation rules
   * @returns true if all rows are valid, false if any have invalid fields
   */
  function validateAll(): boolean {
    // Clear previous validation errors
    invalidFields.clear();

    let allValid = true;

    newRows.forEach((row, rowIndex) => {
      const rowErrors = new Set<string>();

      // Check each field in the row
      Object.keys(row).forEach((key) => {
        // Skip ID field (always valid)
        if (key === 'id') return;

        const value = row[key];

        // Validate using validationManager
        if (!validationManager.isValidValue(key, value)) {
          rowErrors.add(key);
          allValid = false;
        }
      });

      // Store errors for this row if any
      if (rowErrors.size > 0) {
        invalidFields.set(rowIndex, rowErrors);
      }
    });

    return allValid;
  }

  /**
   * Check if a specific field in a new row is invalid
   * @param newRowIndex Index in the newRows array
   * @param key Field name
   * @returns true if the field is invalid
   */
  function isNewRowFieldInvalid(newRowIndex: number, key: string): boolean {
    const fieldErrors = invalidFields.get(newRowIndex);
    return fieldErrors ? fieldErrors.has(key) : false;
  }

  /**
   * Clear all new rows and validation errors
   */
  function clearNewRows() {
    newRows = [];
    invalidFields.clear();
  }

  /**
   * Clear validation errors without removing the rows
   */
  function clearValidation() {
    invalidFields.clear();
  }

  /**
   * Get all valid new rows (rows without validation errors)
   * @returns Array of valid new rows
   */
  function getValidNewRows(): NewRow[] {
    return newRows.filter((_, idx) => !invalidFields.has(idx));
  }

  /**
   * Get all invalid new rows (rows with validation errors)
   * @returns Array of invalid new rows with their indices
   */
  function getInvalidNewRows(): Array<{ index: number; row: NewRow }> {
    return Array.from(invalidFields.keys()).map((idx) => ({
      index: idx,
      row: newRows[idx],
    }));
  }

  // Computed properties
  const newRowCount = $derived(newRows.length);
  const hasNewRows = $derived(newRows.length > 0);
  const hasInvalidNewRows = $derived(invalidFields.size > 0);
  const invalidNewRowCount = $derived(invalidFields.size);

  return {
    // State
    get newRows() {
      return newRows;
    },
    get newRowCount() {
      return newRowCount;
    },
    get hasNewRows() {
      return hasNewRows;
    },
    get hasInvalidNewRows() {
      return hasInvalidNewRows;
    },
    get invalidNewRowCount() {
      return invalidNewRowCount;
    },

    // Methods
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

export type RowGenerationManager = ReturnType<typeof createRowGenerationManager>;

// Export singleton instance
export const rowGenerationManager = createRowGenerationManager();
