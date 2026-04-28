// frontend/src/lib/grid/components/suggestion-menu/suggestionMenu.svelte.ts
// Pure helper functions for the suggestion menu. No state.

import { assetStore } from '$lib/data/assetStore.svelte';
import { columnConstraints } from '$lib/grid/validation';

const NO_SUGGEST_COLUMNS = new Set(['comment', 'under_warranty_until', 'warranty_details']);

/** Check if a column uses a constrained dropdown. */
export function isConstrained(editCol: string): boolean {
  return columnConstraints[editCol]?.type === 'dropdown';
}

/** Get the full options list for a column. */
export function getOptionsForColumn(editCol: string): string[] {
  const constraint = columnConstraints[editCol];

  if (constraint?.type === 'dropdown') {
    return constraint.options();
  }

  if (NO_SUGGEST_COLUMNS.has(editCol)) return [];

  // Free text: unique values across all assets (filters shouldn't shrink suggestions)
  const uniqueValues = new Set<string>();
  for (const asset of assetStore.baseAssets) {
    const value = String(asset[editCol] ?? '').trim();
    if (value) uniqueValues.add(value);
  }
  return Array.from(uniqueValues).sort();
}

/** Filter options based on input text. */
export function filterOptions(
  allOptions: string[],
  text: string,
  constrained: boolean,
): string[] {
  if (!text || !text.trim()) {
    return constrained ? allOptions : [];
  }

  const lower = text.toLowerCase().trim();

  if (constrained) {
    return allOptions.filter(opt => opt.toLowerCase().includes(lower));
  }

  // Free text: exclude exact match, prioritize starts-with
  return allOptions
    .filter(opt =>
      opt.toLowerCase().includes(lower) &&
      opt.toLowerCase() !== lower
    )
    .sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(lower);
      const bStarts = b.toLowerCase().startsWith(lower);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    });
}

/** Get tab-cycle matches from the original typed text. */
export function getTabMatches(allOptions: string[], tabAnchor: string): string[] {
  if (!tabAnchor) return allOptions;
  const lower = tabAnchor.toLowerCase();
  return allOptions
    .filter(opt => opt.toLowerCase().includes(lower))
    .sort((a, b) => {
      const aStarts = a.toLowerCase().startsWith(lower);
      const bStarts = b.toLowerCase().startsWith(lower);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.localeCompare(b);
    });
}

/** Check if a value is in the full options list. */
export function isValidOption(editCol: string, value: string): boolean {
  const options = getOptionsForColumn(editCol);
  return options.includes(value);
}
