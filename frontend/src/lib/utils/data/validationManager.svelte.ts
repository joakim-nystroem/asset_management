/**
 * Validation Manager
 *
 * Provides validation logic for cell values against constraint rules.
 * Validates values against allowed lists (e.g., locations, statuses, conditions)
 * and required field validation (non-nullable columns).
 */

type Constraints = Record<string, string[]>;

// Export for use by other managers
export type ValidationConstraints = Constraints;

// Required fields based on database schema (Null = NO)
// These fields cannot be empty when creating new rows
const REQUIRED_FIELDS = new Set([
  'asset_type',
  'manufacturer',
  'model',
  'serial_number',
  'wbd_tag',
  'asset_set_type',
  'bu_estate',
  'department',
  'location',      // location_id in DB
  'node',
  'status',        // status_id in DB
  'condition',     // condition_id in DB
]);

function createValidationManager() {
  let constraints = $state<Constraints>({});

  /**
   * Set validation constraints for specific fields
   * @param newConstraints Object mapping field names to arrays of valid values
   */
  function setConstraints(newConstraints: Constraints) {
    constraints = { ...newConstraints };
  }

  /**
   * Check if a field is required (non-nullable in database)
   * @param key The field/column name
   * @returns true if the field is required
   */
  function isRequired(key: string): boolean {
    return REQUIRED_FIELDS.has(key);
  }

  /**
   * Check if a value is valid for a given field
   * @param key The field/column name
   * @param value The value to validate
   * @param checkRequired Whether to enforce required field validation (default: true)
   * @returns true if valid, false if invalid
   */
  function isValidValue(key: string, value: any, checkRequired: boolean = true): boolean {
    const valueStr = value === null || value === undefined ? '' : String(value).trim();
    const isEmpty = valueStr === '';

    // Check required field constraint
    if (checkRequired && isEmpty && REQUIRED_FIELDS.has(key)) {
      return false;
    }

    // If no list constraints for this field, consider it valid
    if (!constraints[key] || constraints[key].length === 0) {
      return true;
    }

    // Empty values pass list constraint check (required check is separate above)
    if (isEmpty) {
      return true;
    }

    // Check if value exists in constraint list (case-insensitive)
    return constraints[key].some(
      (allowedValue) => allowedValue.toLowerCase() === valueStr.toLowerCase()
    );
  }

  /**
   * Get the list of valid values for a field
   * @param key The field/column name
   * @returns Array of valid values, or empty array if no constraints
   */
  function getValidValues(key: string): string[] {
    return constraints[key] || [];
  }

  /**
   * Check if a field has constraints
   * @param key The field/column name
   * @returns true if the field has validation constraints
   */
  function hasConstraints(key: string): boolean {
    return Boolean(constraints[key] && constraints[key].length > 0);
  }

  return {
    get constraints() {
      return constraints;
    },
    setConstraints,
    isValidValue,
    isRequired,
    getValidValues,
    hasConstraints,
  };
}

export type ValidationManager = ReturnType<typeof createValidationManager>;

// Export singleton instance
export const validationManager = createValidationManager();
