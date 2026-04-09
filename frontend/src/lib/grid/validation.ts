// frontend/src/lib/grid/validation.ts
// Shared validation constraints and functions.
// Imported by EditHandler (cell-level validation) and Toolbar (commit-time validation).

import { assetStore } from '$lib/data/assetStore.svelte';

// --- Types ---

export type PendingEditValidation = {
  row: number;
  col: string;
  original: string;
  value: string;
  isValid: boolean;
  validationError: string | null;
};

export type DropdownConstraint = {
  type: 'dropdown';
  options: () => string[];
  required: boolean;
};

export type UniqueConstraint = {
  type: 'unique';
  maxChars?: number;
};

export type TextConstraint = {
  type: 'text';
  maxChars: number;
  required?: boolean;
};

export type ColumnConstraint = DropdownConstraint | UniqueConstraint | TextConstraint;

// --- Constraints ---
// Derived from DB schema: DESCRIBE asset_inventory

export const columnConstraints: Record<string, ColumnConstraint> = {
  // FK columns (resolved by name → id) — all NOT NULL
  location:           { type: 'dropdown', options: () => assetStore.locations.map((l: any) => l.location_name), required: true },
  status:             { type: 'dropdown', options: () => assetStore.statuses.map((s: any) => s.status_name), required: true },
  condition:          { type: 'dropdown', options: () => assetStore.conditions.map((c: any) => c.condition_name), required: true },
  department:         { type: 'dropdown', options: () => assetStore.departments.map((d: any) => d.department_name), required: true },
  // Unique columns — NOT NULL
  wbd_tag:            { type: 'unique', maxChars: 10 },
  serial_number:      { type: 'unique', maxChars: 30 },
  // Text columns — NOT NULL
  asset_type:         { type: 'text', maxChars: 20, required: true },
  manufacturer:       { type: 'text', maxChars: 40, required: true },
  model:              { type: 'text', maxChars: 40, required: true },
  bu_estate:          { type: 'text', maxChars: 20, required: true },
  node:               { type: 'text', maxChars: 30, required: true },
  asset_set_type:     { type: 'text', maxChars: 40, required: true },
  // Text columns — nullable
  shelf_cabinet_table: { type: 'text', maxChars: 30 },
  warranty_details:   { type: 'text', maxChars: 180 },
  comment:            { type: 'text', maxChars: 200 },
};

// --- Error messages ---

const errorMessages = {
  required: 'Value is required',
  invalidOption: 'Invalid value',
  duplicate: 'Must be unique',
  tooLong: (max: number) => `Max ${max} characters`,
};

// --- Validation ---

export function validateCell(
  assetId: number,
  colKey: string,
  value: string,
  pendingEdits: PendingEditValidation[],
): { isValid: boolean; error: string | null } {
  const constraint = columnConstraints[colKey];
  if (!constraint) return { isValid: true, error: null };

  // Max chars check (unique and text types)
  const maxChars = 'maxChars' in constraint ? constraint.maxChars : undefined;
  if (maxChars && value.length > maxChars) {
    return { isValid: false, error: errorMessages.tooLong(maxChars) };
  }

  if (constraint.type === 'dropdown') {
    if (!value && !constraint.required) return { isValid: true, error: null };
    if (!value && constraint.required) return { isValid: false, error: errorMessages.required };
    const valid = constraint.options().includes(value);
    return { isValid: valid, error: valid ? null : errorMessages.invalidOption };
  }

  if (constraint.type === 'unique') {
    if (!value) return { isValid: false, error: errorMessages.required };
    // Check against all base assets (excluding this asset) and pending edits
    const isDuplicateInAssets = assetStore.baseAssets.some(
      (a: Record<string, any>) => a.id !== assetId && String(a[colKey] ?? '') === value
    );
    if (isDuplicateInAssets) {
      // Check if the duplicate has a pending edit changing it away from this value
      const duplicateAsset = assetStore.baseAssets.find(
        (a: Record<string, any>) => a.id !== assetId && String(a[colKey] ?? '') === value
      );
      if (duplicateAsset) {
        const pendingForDuplicate = pendingEdits.find(
          (e) => e.row === duplicateAsset.id && e.col === colKey
        );
        if (!pendingForDuplicate || pendingForDuplicate.value === value) {
          return { isValid: false, error: errorMessages.duplicate };
        }
      }
    }
    // Check against other pending edits for the same column
    const isDuplicateInPending = pendingEdits.some(
      (e) => e.row !== assetId && e.col === colKey && e.value === value
    );
    if (isDuplicateInPending) return { isValid: false, error: errorMessages.duplicate };
    return { isValid: true, error: null };
  }

  if (constraint.type === 'text') {
    if (!value && constraint.required) return { isValid: false, error: errorMessages.required };
  }

  return { isValid: true, error: null };
}

/** Validate all constrained columns on a new row at commit time. */
export function validateNewRow(
  row: Record<string, any>,
  pendingEdits: PendingEditValidation[],
): { isValid: boolean; errors: string[] } {
  const rowErrors: string[] = [];
  const assetId = row.id as number;

  for (const [colKey, constraint] of Object.entries(columnConstraints)) {
    // Skip nullable text columns — they don't block commit
    if (constraint.type === 'text' && !constraint.required) continue;
    const value = String(row[colKey] ?? '');
    const result = validateCell(assetId, colKey, value, pendingEdits);
    if (!result.isValid && result.error) {
      rowErrors.push(`${colKey}: ${result.error}`);
    }
  }

  return {
    isValid: rowErrors.length === 0,
    errors: rowErrors,
  };
}
