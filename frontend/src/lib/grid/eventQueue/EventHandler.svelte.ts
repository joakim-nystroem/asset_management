import type { Filter } from '$lib/data/searchManager.svelte';
import type { DataContext, ViewContext, SortContext, EditingContext, ChangeContext, ColumnContext } from '$lib/context/gridContext.svelte.ts';
import type { ChangeController } from '$lib/grid/utils/gridChanges.svelte.ts';
import type { HistoryController } from '$lib/grid/utils/gridHistory.svelte.ts';
import type { SelectionController } from '$lib/grid/utils/gridSelection.svelte.ts';
import type { RowGenerationController } from '$lib/grid/utils/rowGeneration.svelte.ts';
import { toastState } from '$lib/components/toast/toastState.svelte';
import type { GridEvent } from './EventQueue.svelte.ts';

// ─── Dependency injection params ──────────────────────────────────────────────

type EventHandlerDeps = {
  // Mutable state refs — reactive $state objects from the caller
  getBaseAssets: () => Record<string, any>[];
  setBaseAssets: (v: Record<string, any>[]) => void;
  getFilteredAssets: () => Record<string, any>[];
  setFilteredAssets: (v: Record<string, any>[]) => void;
  // Context refs
  dataCtx: DataContext;
  viewCtx: ViewContext;
  sortCtx: SortContext;
  editingCtx: EditingContext;
  changeCtx: ChangeContext;
  columnCtx: ColumnContext;
  // Controller refs
  changes: ChangeController;
  history: HistoryController;
  selection: SelectionController;
  rowGen: RowGenerationController;
  // URL helper — used by handleViewChange to update browser URL after completion
  updateSearchUrl: (params: { q?: string; filters?: Filter[]; view?: string }) => void;
};

// ─── updateAssetInList helper ─────────────────────────────────────────────────

function updateAssetInList(
  list: Record<string, any>[],
  payload: { id: number | string; key: string; value: any },
): void {
  const index = list.findIndex((a) => a.id === payload.id);
  if (index !== -1) {
    list[index][payload.key] = payload.value;
  }
}

// ─── createEventHandler factory ───────────────────────────────────────────────

export function createEventHandler(deps: EventHandlerDeps): { handle: (event: GridEvent) => Promise<void> } {
  const {
    getBaseAssets,
    setBaseAssets,
    getFilteredAssets,
    setFilteredAssets,
    dataCtx,
    viewCtx,
    sortCtx,
    changes,
    history,
    selection,
    rowGen,
    updateSearchUrl,
  } = deps;

  // --- handleCommitUpdate — extracted from DataController.commitChanges (lines 444-481) ---
  async function handleCommitUpdate(): Promise<void> {
    if (!dataCtx.user) {
      toastState.addToast("Log in to edit.", "warning");
      return;
    }
    if (changes.hasInvalidChanges) {
      toastState.addToast("Cannot commit: Fix all invalid values first.", "error");
      return;
    }
    const validChanges = changes.getAllChanges();
    if (validChanges.length === 0) return;

    const apiChanges = validChanges.map((c) => ({
      rowId: c.id,
      columnId: c.key,
      newValue: c.newValue,
      oldValue: c.oldValue,
    }));

    try {
      const response = await fetch("/api/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiChanges),
      });
      if (!response.ok) {
        console.error("Commit failed:", await response.text());
        toastState.addToast("Failed to commit changes. See console for details.", "error");
        return;
      }
      changes.clear();
      selection.resetAll();
      toastState.addToast(`${validChanges.length} changes committed successfully.`, "success");
    } catch (error) {
      console.error("Commit failed:", error);
      toastState.addToast("Network error while committing changes.", "error");
    }
  }

  // --- handleCommitCreate — extracted from DataController.addNewRows (lines 484-559) ---
  async function handleCommitCreate(): Promise<void> {
    if (!dataCtx.user) {
      toastState.addToast("Log in to edit.", "warning");
      return;
    }

    const isValid = rowGen.validateAll();
    const filteredAssets = getFilteredAssets();
    const keys = deps.columnCtx.keys;

    if (!isValid) {
      const keyMap = new Map(keys.map((key, index) => [key, index]));
      const invalidCells: { row: number; col: number }[] = [];
      const newRows = rowGen.newRows;
      for (let i = 0; i < newRows.length; i++) {
        const rowIndex = filteredAssets.length + i;
        for (const key of keys) {
          if (key !== 'id' && rowGen.isNewRowFieldInvalid(i, key)) {
            const col = keyMap.get(key);
            if (col !== undefined) invalidCells.push({ row: rowIndex, col });
          }
        }
      }
      selection.setDirtyCells(invalidCells);
      toastState.addToast("Invalid values in new rows.", "warning");
      return;
    }

    const newRows = rowGen.newRows;
    const incompleteRows = newRows.filter(row => {
      const hasData = Object.entries(row).some(([key, value]) => {
        return key !== 'id' && value !== undefined && value !== null && value !== '';
      });
      return !hasData;
    });

    if (incompleteRows.length > 0) {
      toastState.addToast(
        `Cannot add: ${incompleteRows.length} new ${incompleteRows.length === 1 ? 'row is' : 'rows are'} incomplete. Please fill in data or delete empty rows.`,
        "error",
      );
      rowGen.clearValidation();
      return;
    }

    const rowsToSave = newRows.map((row) => {
      const { id, ...fields } = row;
      return fields;
    });

    try {
      const response = await fetch("/api/create/asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rowsToSave),
      });
      if (!response.ok) {
        const errorData = await response.json();
        toastState.addToast(errorData.error || "Failed to save new rows.", "error");
        rowGen.clearValidation();
        return;
      }
      const { createdRows } = await response.json();
      if (createdRows && createdRows.length > 0) {
        setBaseAssets([...getBaseAssets(), ...createdRows]);
        setFilteredAssets([...getFilteredAssets(), ...createdRows]);
      }
      rowGen.clearNewRows();
      selection.clearDirtyCells();
      selection.resetAll();
      toastState.addToast(
        `${newRows.length} new ${newRows.length === 1 ? "row" : "rows"} saved successfully.`,
        "success",
      );
    } catch (error) {
      console.error("Add rows failed:", error);
      toastState.addToast("Network error while adding new rows.", "error");
      rowGen.clearValidation();
    }
  }

  // --- handleFilter — extracted from DataController URL $effect (lines 248-283) ---
  async function handleFilter(q: string, filters: Filter[], view: string): Promise<void> {
    if (!q && filters.length === 0) {
      setFilteredAssets([...getBaseAssets()]);
      sortCtx.sortKey = null;
      sortCtx.sortDirection = null;
      selection.reset();
      return;
    }

    const params = new URLSearchParams();
    if (q) params.set('q', q);
    filters.forEach(f => params.append('filter', `${f.key}:${f.value}`));
    params.set('view', view);

    try {
      const response = await fetch(`/api/assets?${params.toString()}`);
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const result = await response.json();

      if (changes.hasChanges) {
        const changesToRevert = changes.getAllChanges(true);
        for (const change of changesToRevert) {
          const item = getBaseAssets().find((a: any) => a.id === change.id);
          if (item) item[change.key] = change.oldValue;
        }
        changes.clear();
        history.clear();
      }
      if (rowGen.hasNewRows) rowGen.clearNewRows();
      setFilteredAssets(result.assets || []);
      selection.reset();
      sortCtx.sortKey = null;
      sortCtx.sortDirection = null;
    } catch (err) {
      console.error('Search failed:', err);
      toastState.addToast("Search failed. Please try again.", "error");
    }
  }

  // --- handleViewChange — extracted from DataController URL $effect (lines 217-246) ---
  async function handleViewChange(view: string, q: string, filters: Filter[]): Promise<void> {
    const validViews = ['default', 'audit', 'ped', 'galaxy', 'network'];
    if (validViews.includes(view)) {
      viewCtx.activeView = view;
    } else {
      viewCtx.activeView = 'default';
      return;
    }

    try {
      const response = await fetch(`/api/assets?view=${view}`);
      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const result = await response.json();
      setBaseAssets(result.assets);

      if (!q && filters.length === 0) {
        setFilteredAssets(result.assets);
        selection.reset();
        sortCtx.sortKey = null;
        sortCtx.sortDirection = null;
        changes.clear();
        history.clear();
        rowGen.clearNewRows();
        updateSearchUrl({ view, q: '', filters: [] });
        return;
      }

      // q or filters exist — fall through to filter logic
      await handleFilter(q, filters, view);
      updateSearchUrl({ view, q, filters });
    } catch (err) {
      console.error(`Failed to load ${view} view:`, err);
      toastState.addToast(`Failed to load ${view} view.`, "error");
    }
  }

  // --- handleDiscard — extracted from DataController.discardChanges (lines 562-578) ---
  function handleDiscard(): void {
    if (!dataCtx.user) {
      toastState.addToast("Log in to edit.", "warning");
      return;
    }
    const changesToRevert = changes.getAllChanges(true);
    for (const change of changesToRevert) {
      const item = getFilteredAssets().find((a: any) => a.id === change.id);
      if (item) item[change.key] = change.oldValue;
    }
    history.clearCommitted(changesToRevert);
    changes.clear();
    rowGen.clearNewRows();
    selection.clearDirtyCells();
    selection.resetAll();
    toastState.addToast("Changes discarded.", "info");
  }

  // --- handleWsDelta — extracted from DataController.handleRealtimeUpdate (lines 355-368) ---
  function handleWsDelta(payload: { id: number; key: string; value: any }): void {
    updateAssetInList(getFilteredAssets(), payload);
    updateAssetInList(getBaseAssets(), payload);
  }

  // ─── Exhaustive dispatch switch ───────────────────────────────────────────

  async function handle(event: GridEvent): Promise<void> {
    switch (event.type) {
      case 'COMMIT':
        if (event.mode === 'update') {
          await handleCommitUpdate();
        } else if (event.mode === 'create') {
          await handleCommitCreate();
        }
        break;
      case 'FILTER':
        await handleFilter(event.q, event.filters, event.view);
        break;
      case 'DISCARD':
        handleDiscard();
        break;
      case 'VIEW_CHANGE':
        await handleViewChange(event.view, event.q, event.filters);
        break;
      case 'WS_DELTA':
        handleWsDelta(event.payload);
        break;
    }
  }

  return { handle };
}
