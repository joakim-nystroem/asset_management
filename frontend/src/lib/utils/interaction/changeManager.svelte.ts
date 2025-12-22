import type { HistoryAction } from './historyManager.svelte';

/**
 * Manages the state of *net changes* to be committed.
 * This is separate from the HistoryManager, which tracks every single action.
 */
class ChangeManager {
    // The key is a string "{id},{key}" for a unique cell identifier.
    // The value is the action representing the *net change* from the original value.
    dirtyChanges = $state(new Map<string, HistoryAction>());

    /**
     * Updates the change map with a new action from the history.
     * It determines if the cell is now dirty or has been reverted to its original state.
     * @param action The latest action performed on a cell.
     */
    update(action: HistoryAction) {
        const key = `${action.id},${action.key}`;
        const existingChange = this.dirtyChanges.get(key);

        if (existingChange) {
            // This cell was already dirty. Check if the new action reverts it.
            if (action.newValue === existingChange.oldValue) {
                // It has been reverted to its original value. Remove it from the dirty map.
                this.dirtyChanges.delete(key);
            } else {
                // It's just a new dirty value. Update the newValue in the existing record.
                existingChange.newValue = action.newValue;
            }
        } else {
            // This is the first time this cell has been changed.
            // The action's `oldValue` is the original value.
            // We only add it if the new value is actually different.
            if (action.oldValue !== action.newValue) {
                this.dirtyChanges.set(key, { ...action });
            }
        }
        // Trigger reactivity
        this.dirtyChanges = new Map(this.dirtyChanges);
    }

    /**
     * Gets all actions that represent a net change.
     */
    getAllChanges(): HistoryAction[] {
        return Array.from(this.dirtyChanges.values());
    }

    /**
     * Clears all tracked changes.
     */
    clear() {
        if (this.dirtyChanges.size === 0) return;
        this.dirtyChanges = new Map();
    }

    /**
     * A getter to easily check if there are any pending changes.
     */
    get hasChanges() {
        return this.dirtyChanges.size > 0;
    }
}

export const changeManager = new ChangeManager();