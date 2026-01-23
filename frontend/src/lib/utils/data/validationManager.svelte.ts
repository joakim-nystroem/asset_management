/**
 * Validation Manager
 *
 * Provides validation logic for cell values against constraint rules.
 * Validates values against allowed lists (e.g., locations, statuses, conditions).
 */

type Constraints = Record<string, string[]>;

// Export for use by other managers
export type ValidationConstraints = Constraints;

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
   * Check if a value is valid for a given field
   * @param key The field/column name
   * @param value The value to validate
   * @returns true if valid or no constraints exist, false if invalid
   */
  function isValidValue(key: string, value: any): boolean {
    // If no constraints for this field, consider it valid
    if (!constraints[key] || constraints[key].length === 0) {
      return true;
    }

    // Empty values are considered valid (optional fields)
    if (value === '' || value === null || value === undefined) {
      return true;
    }

    // Convert value to string for comparison
    const valueStr = String(value).trim();

    // Empty string after trim is valid
    if (valueStr === '') {
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
    getValidValues,
    hasConstraints,
  };
}

export type ValidationManager = ReturnType<typeof createValidationManager>;

// Export singleton instance
export const validationManager = createValidationManager();
