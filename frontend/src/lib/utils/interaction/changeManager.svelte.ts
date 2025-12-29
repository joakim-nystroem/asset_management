import type { HistoryAction } from './historyManager.svelte';

export type ValidationConstraints = {
  location: string[];
  status: string[];
  condition: string[];
};

/**
 * Manages the state of *net changes* to be committed.
 * Now includes validation tracking for constrained columns.
 */
function createChangeManager() {
  // The key is a string "{id},{key}" for a unique cell identifier.
  // The value is the action representing the *net change* from the original value.
  let dirtyChanges = $state(new Map<string, HistoryAction>());
  
  // Track invalid changes separately
  let invalidChanges = $state(new Set<string>());
  
  // Validation constraints
  let constraints = $state<ValidationConstraints>({
    location: [],
    status: [],
    condition: []
  });

  /**
   * Set validation constraints for lookup columns
   */
  function setConstraints(newConstraints: Partial<ValidationConstraints>) {
    // Update constraints
    constraints = { ...constraints, ...newConstraints };
    
    // Re-validate all current dirty changes against new constraints
    for (const [key, action] of dirtyChanges) {
      if (!isValidValue(action.key, action.newValue)) {
        invalidChanges.add(key);
      } else {
        invalidChanges.delete(key);
      }
    }
    
    // Force reactivity update
    invalidChanges = new Set(invalidChanges);
  }

  /**
   * Check if a value is valid for a given column
   */
  function isValidValue(key: string, value: any): boolean {
    // Check if this column has constraints
    if (key === 'location' && constraints.location.length > 0) {
      return constraints.location.includes(value);
    }
    if (key === 'status' && constraints.status.length > 0) {
      return constraints.status.includes(value);
    }
    if (key === 'condition' && constraints.condition.length > 0) {
      return constraints.condition.includes(value);
    }
    
    // No constraints or not a constrained column
    return true;
  }

  /**
   * Updates the change map with a new action from the history.
   * It determines if the cell is now dirty or has been reverted to its original state.
   * @param action The latest action performed on a cell.
   */
  function update(action: HistoryAction) {
    const key = `${action.id},${action.key}`;
    const existingChange = dirtyChanges.get(key);

    if (existingChange) {
      // This cell was already dirty. Check if the new action reverts it.
      if (action.newValue === existingChange.oldValue) {
        // It has been reverted to its original value. Remove it from the dirty map.
        dirtyChanges.delete(key);
        invalidChanges.delete(key);
      } else {
        // It's just a new dirty value. Update the newValue in the existing record.
        existingChange.newValue = action.newValue;
        
        // Re-validate
        if (!isValidValue(action.key, action.newValue)) {
          invalidChanges.add(key);
        } else {
          invalidChanges.delete(key);
        }
      }
    } else {
      // This is the first time this cell has been changed.
      // The action's `oldValue` is the original value.
      // We only add it if the new value is actually different.
      if (action.oldValue !== action.newValue) {
        dirtyChanges.set(key, { ...action });
        
        // Validate the new value
        if (!isValidValue(action.key, action.newValue)) {
          invalidChanges.add(key);
        }
      }
    }
    
    // Trigger reactivity
    dirtyChanges = new Map(dirtyChanges);
    invalidChanges = new Set(invalidChanges);
  }

  /**
   * Gets all actions that represent a net change.
   * Optionally filter out invalid changes.
   */
  function getAllChanges(includeInvalid: boolean = true): HistoryAction[] {
    const changes = Array.from(dirtyChanges.values());
    
    if (includeInvalid) {
      return changes;
    }
    
    // Filter out invalid changes
    return changes.filter(change => {
      const key = `${change.id},${change.key}`;
      return !invalidChanges.has(key);
    });
  }

  /**
   * Get only valid changes (for commit)
   */
  function getValidChanges(): HistoryAction[] {
    return getAllChanges(false);
  }

  /**
   * Check if a specific cell has an invalid value
   */
  function isInvalid(id: number | string, key: string): boolean {
    const cellKey = `${id},${key}`;
    return invalidChanges.has(cellKey);
  }

  /**
   * Clears all tracked changes.
   */
  function clear() {
    if (dirtyChanges.size === 0 && invalidChanges.size === 0) return;
    dirtyChanges = new Map();
    invalidChanges = new Set();
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
    // invalidChanges remains the same as we are keeping them
  }

  /**
   * A getter to easily check if there are any pending changes.
   */
  const hasChanges = $derived(dirtyChanges.size > 0);
  const hasInvalidChanges = $derived(invalidChanges.size > 0);
  const validChangeCount = $derived(dirtyChanges.size - invalidChanges.size);

  return {
    get hasChanges() { return hasChanges },
    get hasInvalidChanges() { return hasInvalidChanges },
    get validChangeCount() { return validChangeCount },
    
    update,
    getAllChanges,
    getValidChanges,
    isInvalid,
    clear,
    clearValidChanges,
    setConstraints
  };
}

export const changeManager = createChangeManager();