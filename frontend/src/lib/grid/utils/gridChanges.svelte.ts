import { getValidationContext, getChangeContext } from '$lib/context/gridContext.svelte.ts';

export type HistoryAction = {
  id: number | string;
  key: string;
  oldValue: string;
  newValue: string;
};

export function createChangeController() {
  const validCtx = getValidationContext();
  const changeCtx = getChangeContext();

  // Local state: dirty changes map (key = "{id},{key}" → net change from original)
  let dirtyChanges = $state(new Map<string, HistoryAction>());
  // Local state: set of cell keys with invalid values
  let invalidChanges = $state(new Set<string>());

  function isValidValue(key: string, value: string): boolean {
    const valueStr = String(value ?? '').trim();
    const list = validCtx.validationConstraints[key];
    if (!list || list.length === 0) return true;
    if (valueStr === '') return true;
    return list.some((v) => v.toLowerCase() === valueStr.toLowerCase());
  }

  /**
   * Updates the change map with a new action from the history.
   * Determines if the cell is now dirty or has been reverted to its original state.
   */
  function update(action: HistoryAction) {
    const cellKey = `${action.id},${action.key}`;
    const existingChange = dirtyChanges.get(cellKey);

    if (existingChange) {
      if (action.newValue === existingChange.oldValue) {
        // Reverted to original — remove from dirty map
        dirtyChanges.delete(cellKey);
        invalidChanges.delete(cellKey);
      } else {
        // New dirty value — update newValue in existing record
        existingChange.newValue = action.newValue;
        if (!isValidValue(action.key, action.newValue)) {
          invalidChanges.add(cellKey);
        } else {
          invalidChanges.delete(cellKey);
        }
      }
    } else {
      // First change for this cell
      if (action.oldValue !== action.newValue) {
        dirtyChanges.set(cellKey, { ...action });
        if (!isValidValue(action.key, action.newValue)) {
          invalidChanges.add(cellKey);
        }
      }
    }

    // Trigger reactivity
    dirtyChanges = new Map(dirtyChanges);
    invalidChanges = new Set(invalidChanges);

    // Sync to context
    changeCtx.hasUnsavedChanges = dirtyChanges.size > 0;
    changeCtx.hasInvalidChanges = invalidChanges.size > 0;
  }

  /**
   * Gets all actions that represent a net change.
   * Optionally filter out invalid changes.
   */
  function getAllChanges(includeInvalid: boolean = true): HistoryAction[] {
    const changes = Array.from(dirtyChanges.values());
    if (includeInvalid) return changes;
    return changes.filter((change) => {
      const cellKey = `${change.id},${change.key}`;
      return !invalidChanges.has(cellKey);
    });
  }

  /**
   * Get only valid changes (for commit).
   */
  function getValidChanges(): HistoryAction[] {
    return getAllChanges(false);
  }

  /**
   * Check if a specific cell has an invalid value.
   */
  function isInvalid(id: number | string, key: string): boolean {
    const cellKey = `${id},${key}`;
    return invalidChanges.has(cellKey);
  }

  /**
   * Get all invalid cell keys as {id, key} pairs.
   */
  function getInvalidCellKeys(): { id: string; key: string }[] {
    return Array.from(invalidChanges).map((cellKey) => {
      const commaIndex = cellKey.indexOf(',');
      return {
        id: cellKey.slice(0, commaIndex),
        key: cellKey.slice(commaIndex + 1),
      };
    });
  }

  /**
   * Clears all tracked changes.
   */
  function clear() {
    if (dirtyChanges.size === 0 && invalidChanges.size === 0) return;
    dirtyChanges = new Map();
    invalidChanges = new Set();
    changeCtx.hasUnsavedChanges = false;
    changeCtx.hasInvalidChanges = false;
  }

  /**
   * Clears only the valid changes, retaining any invalid ones for user correction.
   */
  function clearValidChanges() {
    if (invalidChanges.size === dirtyChanges.size) return; // All are invalid, nothing to clear
    const remainingDirty = new Map<string, HistoryAction>();
    for (const key of invalidChanges) {
      if (dirtyChanges.has(key)) {
        remainingDirty.set(key, dirtyChanges.get(key)!);
      }
    }
    dirtyChanges = remainingDirty;
    changeCtx.hasUnsavedChanges = dirtyChanges.size > 0;
    // invalidChanges remains the same — keeping invalid cells
  }

  const hasChanges = $derived(dirtyChanges.size > 0);
  const hasInvalidChanges = $derived(invalidChanges.size > 0);
  const validChangeCount = $derived(dirtyChanges.size - invalidChanges.size);

  return {
    get hasChanges() { return hasChanges; },
    get hasInvalidChanges() { return hasInvalidChanges; },
    get validChangeCount() { return validChangeCount; },

    update,
    getAllChanges,
    getValidChanges,
    getInvalidCellKeys,
    isInvalid,
    clear,
    clearValidChanges,
  };
}

export type ChangeController = ReturnType<typeof createChangeController>;
