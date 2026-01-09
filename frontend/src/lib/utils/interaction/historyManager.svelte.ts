// src/lib/utils/history.svelte.ts

export type HistoryAction = {
  id: number | string;
  key: string;
  oldValue: string;
  newValue: string;
};

function createHistoryManager() {
  // Stacks now hold ARRAYS of actions (batches)
  let undoStack = $state<HistoryAction[][]>([]);
  let redoStack = $state<HistoryAction[][]>([]);

  /**
   * Record a single change (wraps it in a batch of 1)
   */
  function record(id: number | string, key: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;
    undoStack.push([{ id, key, oldValue, newValue }]);
    redoStack = [];
  }

  /**
   * Record multiple changes as a single history event
   */
  function recordBatch(actions: HistoryAction[]) {
    if (actions.length === 0) return;
    undoStack.push(actions);
    redoStack = [];
  }

  function revert(actions: HistoryAction[], assets: any[]) {
    // Revert all actions in the batch (in reverse order for safety)
    for (let i = actions.length - 1; i >= 0; i--) {
      const action = actions[i];
      const item = assets.find(a => a.id === action.id);
      if (item) {
        item[action.key] = action.oldValue;
      }
    }
  }

  function undo(assets: any[]): HistoryAction[] | undefined {
    const batch = undoStack.pop();
    if (!batch) return;

    revert(batch, assets);

    redoStack.push(batch);
    return batch;
  }

  function redo(assets: any[]): HistoryAction[] | undefined {
    const batch = redoStack.pop();
    if (!batch) return;

    // Re-apply all actions in the batch
    for (const action of batch) {
      const item = assets.find(a => a.id === action.id);
      if (item) {
        item[action.key] = action.newValue;
      }
    }

    undoStack.push(batch);
    return batch;
  }

  function clear() {
    undoStack = [];
    redoStack = [];
  }

  /**
   * Removes committed actions from the undo stack, effectively "locking them in"
   * as the new baseline. This prevents a "Discard" from reverting successfully
   * committed changes after a partial commit.
   */
  function clearCommitted(committedActions: HistoryAction[]) {
    if (committedActions.length === 0) return;

    const committedKeys = new Set(
      committedActions.map(c => `${c.id},${c.key}`)
    );

    const newUndoStack: HistoryAction[][] = [];

    for (const batch of undoStack) {
      const newBatch = batch.filter(
        action => !committedKeys.has(`${action.id},${action.key}`)
      );

      if (newBatch.length > 0) {
        newUndoStack.push(newBatch);
      }
    }

    undoStack = newUndoStack;
    redoStack = []; // A new commit invalidates the entire redo stack
  }

  return {
    get undoStack() { return undoStack },
    get redoStack() { return redoStack },

    record,
    recordBatch,
    revert,
    undo,
    redo,
    clear,
    clearCommitted
  };
}

export type HistoryManager = ReturnType<typeof createHistoryManager>;

// Export singleton instance
export const historyManager = createHistoryManager();