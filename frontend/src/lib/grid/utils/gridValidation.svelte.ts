import { getValidationContext } from '$lib/context/gridContext.svelte.ts';

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

export type ValidationConstraints = Record<string, string[]>;

export function createValidationController() {
  const validCtx = getValidationContext();  // safe: called during component init

  function setConstraints(newConstraints: Partial<ValidationConstraints>) {
    validCtx.validationConstraints = { ...validCtx.validationConstraints, ...(newConstraints as ValidationConstraints) };
  }

  function isRequired(key: string): boolean {
    return REQUIRED_FIELDS.has(key);
  }

  function isValidValue(key: string, value: unknown, checkRequired = true): boolean {
    const valueStr = value === null || value === undefined ? '' : String(value).trim();
    const isEmpty = valueStr === '';

    // Check required field constraint
    if (checkRequired && isEmpty && REQUIRED_FIELDS.has(key)) return false;

    // If no list constraints for this field, consider it valid
    const list = validCtx.validationConstraints[key];
    if (!list || list.length === 0) return true;

    // Empty values pass list constraint check (required check is separate above)
    if (isEmpty) return true;

    // Check if value exists in constraint list (case-insensitive)
    return list.some(v => v.toLowerCase() === valueStr.toLowerCase());
  }

  function getValidValues(key: string): string[] {
    return validCtx.validationConstraints[key] ?? [];
  }

  function hasConstraints(key: string): boolean {
    return Boolean(validCtx.validationConstraints[key]?.length);
  }

  return {
    get constraints() {
      return validCtx.validationConstraints;
    },
    setConstraints,
    isRequired,
    isValidValue,
    getValidValues,
    hasConstraints,
  };
}

export type ValidationController = ReturnType<typeof createValidationController>;
