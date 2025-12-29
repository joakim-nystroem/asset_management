// src/lib/utils/history.svelte.ts

export type HistoryAction = {
  id: number | string;
  key: string;
  oldValue: string;
  newValue: string;
};

export class HistoryManager {
  // Stacks now hold ARRAYS of actions (batches)
  undoStack = $state<HistoryAction[][]>([]);
  redoStack = $state<HistoryAction[][]>([]);

  /**
   * Record a single change (wraps it in a batch of 1)
   */
  record(id: number | string, key: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return;
    this.undoStack.push([{ id, key, oldValue, newValue }]);
    this.redoStack = []; 
  }

  /**
   * Record multiple changes as a single history event
   */
  recordBatch(actions: HistoryAction[]) {
    if (actions.length === 0) return;
    this.undoStack.push(actions);
    this.redoStack = [];
  }

  revert(actions: HistoryAction[], assets: any[]) {
    // Revert all actions in the batch (in reverse order for safety)
    for (let i = actions.length - 1; i >= 0; i--) {
      const action = actions[i];
      const item = assets.find(a => a.id === action.id);
      if (item) {
        item[action.key] = action.oldValue;
      }
    }
  }

  undo(assets: any[]): HistoryAction[] | undefined {
    const batch = this.undoStack.pop();
    if (!batch) return;

    this.revert(batch, assets);
    
    this.redoStack.push(batch);
    return batch;
  }

  redo(assets: any[]): HistoryAction[] | undefined {
    const batch = this.redoStack.pop();
    if (!batch) return;

    // Re-apply all actions in the batch
    for (const action of batch) {
      const item = assets.find(a => a.id === action.id);
      if (item) {
        item[action.key] = action.newValue;
      }
    }

    this.undoStack.push(batch);
    return batch;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Removes committed actions from the undo stack, effectively "locking them in"
   * as the new baseline. This prevents a "Discard" from reverting successfully
   * committed changes after a partial commit.
   */
  clearCommitted(committedActions: HistoryAction[]) {
    if (committedActions.length === 0) return;

    const committedKeys = new Set(
      committedActions.map(c => `${c.id},${c.key}`)
    );

    const newUndoStack: HistoryAction[][] = [];

    for (const batch of this.undoStack) {
      const newBatch = batch.filter(
        action => !committedKeys.has(`${action.id},${action.key}`)
      );
      
      if (newBatch.length > 0) {
        newUndoStack.push(newBatch);
      }
    }

    this.undoStack = newUndoStack;
    this.redoStack = []; // A new commit invalidates the entire redo stack
  }
}