<script lang="ts">

  import { tick, untrack } from "svelte";
  import { page } from '$app/state';
  import { replaceState } from '$app/navigation';
  import { SvelteURL, SvelteMap } from 'svelte/reactivity';

  // --- TYPES ---
  import type { PageProps } from './$types';
  import type { Filter } from '$lib/data/searchManager.svelte';
  import type { SafeUser } from '$lib/types';

  // --- CONTEXT ---
  import { setGridContext } from '$lib/context/gridContext.svelte.ts';
  import type { GridContext } from '$lib/context/gridContext.svelte.ts';

  // --- COMPONENTS ---
  import ContextMenu from "$lib/grid/components/context-menu/contextMenu.svelte";
  import Toolbar from "$lib/components/grid/Toolbar.svelte";
  import GridContainer from "$lib/components/grid/GridContainer.svelte";

  // createInteractionHandler removed — interaction handling delegated to GridOverlays via {@attach gridShortcuts(...)}

  // --- STATE CLASSES ---
  import { ContextMenuState } from "$lib/grid/components/context-menu/contextMenu.svelte.ts";
  import { createHistoryController } from "$lib/grid/utils/gridHistory.svelte.ts";
  import { createHeaderMenu } from "$lib/grid/components/header-menu/headerMenu.svelte.ts";
  import { createSelectionController } from "$lib/grid/utils/gridSelection.svelte.ts";
  import { createClipboardController } from "$lib/grid/utils/gridClipboard.svelte.ts";
  import { createEditDropdown } from "$lib/grid/components/edit-dropdown/editDropdown.svelte.ts";
  import { createAutocomplete } from "$lib/grid/components/suggestion-menu/autocomplete.svelte.ts";
  import { searchManager } from "$lib/data/searchManager.svelte";
  import { createVirtualScroll } from "$lib/grid/utils/virtualScrollManager.svelte";
  import { createColumnController } from "$lib/grid/utils/gridColumns.svelte.ts";
  import { createRowController } from "$lib/grid/utils/gridRows.svelte.ts";
  import { createValidationController } from "$lib/grid/utils/gridValidation.svelte.ts";
  import { createEditController } from "$lib/grid/utils/gridEdit.svelte.ts";
  import { FilterPanelState } from "$lib/grid/components/filter-panel/filterPanel.svelte.ts";
  import { createChangeController } from "$lib/grid/utils/gridChanges.svelte.ts";
  import { realtime } from "$lib/utils/interaction/realtimeManager.svelte";
  import { toastState } from "$lib/components/toast/toastState.svelte";
  import { createRowGenerationController } from "$lib/grid/utils/rowGeneration.svelte.ts";

  // --- ROUTE DATA ---
  let { data }: PageProps = $props();

  // Map data fields to the same variable names used throughout the script
  const initialAssets = data.assets;
  const initialKeys = data.assets.length > 0 ? Object.keys(data.assets[0]) : [];
  const user = data.user;
  const initialLocations = data.locations ?? [];
  const initialStatuses = data.statuses ?? [];
  const initialConditions = data.conditions ?? [];
  const initialDepartments = data.departments ?? [];
  const initialView = data.initialView ?? 'default';
  const searchResults = data.searchResults ?? null;

  // --- CREATE AND SET CONTEXT ---
  // MUST be called synchronously before any $effect or await
  const ctx = $state<GridContext>({
    isEditing: false,
    editKey: null,
    editRow: -1,
    editCol: -1,
    editOriginalValue: '',
    editOriginalColumnWidth: 0,
    inputValue: '',
    selectionStart: { row: -1, col: -1 },
    selectionEnd: { row: -1, col: -1 },
    isSelecting: false,
    isHiddenAfterCopy: false,
    copyStart: { row: -1, col: -1 },
    copyEnd: { row: -1, col: -1 },
    isCopyVisible: false,
    dirtyCells: new Set(),
    hasUnsavedChanges: false,
    hasInvalidChanges: false,
    validationConstraints: {},
    columnWidths: new SvelteMap(),
    rowHeights: new SvelteMap(),
    resizingColumn: null,
    sortKey: null,
    sortDirection: null,
    activeView: initialView || 'default',
    keys: initialKeys,
    // Phase 2 additions
    filteredAssetsCount: (searchResults ?? initialAssets).length,
    virtualScroll: createVirtualScroll(),
    scrollToRow: null,
    // Context-channel fields (02-02) — assigned after controllers init below
    assets: [],
    filterPanel: null,
    pageActions: null,
    editDropdown: null,
    autocomplete: null,
    headerMenu: null,
    baseAssets: [],
    applySort: null,
    handleFilterSelect: null,
    contextMenu: null,
  });

  setGridContext(ctx);

  // Alias for virtualScroll (created inside ctx literal above)
  const virtualScroll = ctx.virtualScroll;

  // Initialize co-located controllers (must be after setGridContext)
  const columns = createColumnController();
  const rows = createRowController();
  const validation = createValidationController();
  const selection = createSelectionController();
  const history = createHistoryController();
  const edit = createEditController();
  const changes = createChangeController();
  const rowGen = createRowGenerationController();

  // Initialize State Classes
  const contextMenu = new ContextMenuState();
  const headerMenu = createHeaderMenu();
  const clipboard = createClipboardController();
  const filterPanel = new FilterPanelState();
  const editDropdown = createEditDropdown();
  const autocomplete = createAutocomplete();

  // --- Context-channel assignments (02-02) ---
  // Set after controllers are created so GridContainer/GridOverlays can read them from context
  ctx.filterPanel = filterPanel;
  ctx.editDropdown = editDropdown;
  ctx.autocomplete = autocomplete;
  ctx.headerMenu = headerMenu;
  ctx.contextMenu = contextMenu;
  ctx.pageActions = {
    onSaveEdit: (_value: string) => { saveEdit(); },
    onCancelEdit: cancelEdit,
    onEditAction: (_action: string, _row: number, _col: number) => { handleEditAction(); },
    onCopy: handleCopy,
    onPaste: handlePaste,
    onUndo: () => {
      const undoneBatch = history.undo(assets);
      if (undoneBatch) {
        for (const action of undoneBatch) {
          changes.update({
            id: action.id,
            key: action.key,
            newValue: action.oldValue,
            oldValue: action.newValue,
          });
        }
      }
    },
    onRedo: () => {
      const redoneBatch = history.redo(assets);
      if (redoneBatch) {
        for (const action of redoneBatch) {
          changes.update(action);
        }
      }
    },
    onEscape: () => {
      if (ctx.isEditing) {
        releaseEditLock();
        edit.cancel();
        return;
      }
      if (selection.hasSelection) {
        selection.resetAll();
      }
      clipboard.clear();
      if (contextMenu.visible) contextMenu.close();
      headerMenu.close();
    },
    onDeleteNewRow: handleDeleteNewRow,
    user: user,
  };
  ctx.applySort = applySort;
  ctx.handleFilterSelect = (item: string, key: string) => {
    const { q, filters, view } = getCurrentUrlState();
    const exists = filters.some(f => f.key === key && f.value === item);
    const newFilters = exists
      ? filters.filter(f => !(f.key === key && f.value === item))
      : [...filters, { key, value: item }];
    updateSearchUrl({ q, filters: newFilters, view });
  };

  // Clear stale controller state on page load/refresh
  rowGen.clearNewRows();
  changes.clear();
  history.clear();

  // Always sync view from server data (prevents stale state on navigation)
  // ctx.activeView is already initialised from initialView prop above (in the ctx $state literal)

  // --- Data State ---
  // svelte-ignore state_referenced_locally
  let baseAssets: Record<string, any>[] = $state(initialAssets);
  // svelte-ignore state_referenced_locally
  let filteredAssets: Record<string, any>[] = $state(searchResults ?? initialAssets);
  let searchError = $state('');
  let locations = $derived(initialLocations || []);
  let statuses = $derived(initialStatuses || []);
  let conditions = $derived(initialConditions || []);
  let departments = $derived(initialDepartments || []);

  // Combine filtered assets with new rows at the bottom
  let assets = $derived([...filteredAssets, ...rowGen.newRows]);

  // Sync filteredAssetsCount to context
  $effect(() => {
    ctx.filteredAssetsCount = filteredAssets.length;
  });

  // Sync combined assets array to context (for GridOverlays + GridContainer children)
  $effect(() => {
    ctx.assets = assets;
  });

  // Sync baseAssets to context (for HeaderMenu filter items)
  $effect(() => {
    ctx.baseAssets = baseAssets;
  });

  // Check logged in status
  let isLoggedIn = $derived(!!user);
  // svelte-ignore state_referenced_locally
  let wasLoggedIn = $state(!!user);

  function logOutToast() {
    toastState.addToast("You have been logged out.", "info");
  }

  $effect(() => {
    if (!isLoggedIn && wasLoggedIn) {
      untrack(() => {
        logOutToast();
        // Reset reactive URL to clean state — the redirect already updated the browser URL,
        // but reactiveUrl (SvelteURL) is a separate object that still holds stale params.
        // This triggers the URL effect to clear filters and show unfiltered data.
        reactiveUrl.searchParams.delete('q');
        reactiveUrl.searchParams.delete('filter');
        reactiveUrl.searchParams.set('view', 'default');
      });
    }
  })

  // Realtime State (Derived from Singleton)
  // Map other users' positions based on asset IDs to current filtered view
  // otherUserSelections and hoveredUser moved to GridOverlays (self-computes from context + realtime)

  let keys = $derived(assets.length > 0 ? Object.keys(assets[0]) : []);

  // Set up the next ID provider for new rows (based on full original array, not filtered)
  $effect(() => {
    rowGen.setNextIdProvider(() => {
      if (baseAssets.length === 0) return 1;
      const maxId = Math.max(...baseAssets.map(a => typeof a.id === 'number' ? a.id : 0));
      return maxId + 1 + rowGen.newRowCount;
    });
  });

  // Track dirty cells for existing row changes (new row validation is triggered manually on commit)
  $effect(() => {
    const allChanges = changes.getAllChanges();

    if (allChanges.length === 0) {
      selection.clearDirtyCells();
      return;
    }

    const keyMap = new Map(keys.map((key, index) => [key, index]));
    const assetIdMap = new Map(
      assets.map((asset, index) => [asset.id.toString(), index]),
    );

    const dirtyCells = allChanges
      .map((change) => {
        const row = assetIdMap.get(String(change.id));
        const col = keyMap.get(change.key);
        return { row, col };
      })
      .filter((c) => c.row !== undefined && c.col !== undefined) as {
      row: number;
      col: number;
    }[];

    if (dirtyCells.length === 0) {
      selection.clearDirtyCells();
    } else {
      selection.setDirtyCells(dirtyCells);
    }
  });

  $effect(() => {
    // 1. Capture the data explicitly.
    // This ensures the effect subscribes to 'locations', 'statuses', and 'conditions'.
    const locNames = locations.map((l) => l.location_name);
    const statNames = statuses.map((s) => s.status_name);
    const condNames = conditions.map((c) => c.condition_name);
    const deptNames = departments.map((d: any) => d.department_name);

    // 2. Update the managers inside 'untrack'.
    // This tells Svelte: "Execute this, but ignore any state reads happening inside."
    untrack(() => {
      const constraints = {
        location: locNames,
        status: statNames,
        condition: condNames,
        department: deptNames,
      };

      // Update context constraints (used by changes and rowGen controllers directly)
      ctx.validationConstraints = constraints;
      validation.setConstraints(constraints);

      // Note: Validation for new rows now happens only on commit
    });
  });

  // dirtyCellOverlays moved to GridOverlays (self-computes from context)
  // totalInvalidCount moved to Toolbar (self-computes via $derived)

  const updateAssetInList = (
    list: Record<string, any>[],
    payload: { id: number | string; key: string; value: any },
  ) => {
    const index = list.findIndex((a) => a.id === payload.id);
    if (index !== -1) {
      list[index][payload.key] = payload.value;
    }
  };

  const handleRealtimeUpdate = (payload: {
    id: number;
    key: string;
    value: any;
  }) => {
    updateAssetInList(filteredAssets, payload);
    updateAssetInList(baseAssets, payload);
  };

  async function handleAddNewRow() {
    if (!user) {
      toastState.addToast("Log in to add new rows.", "warning");
      return;
    }

    // Block if an edit is in progress
    if (edit.isEditingCell(ctx.editRow, ctx.editCol) || ctx.isEditing) {
      toastState.addToast(
        "Please finish or cancel your current edit before adding new rows.",
        "warning"
      );
      return;
    }

    // Block only if there are unsaved changes to existing rows
    // Allow adding multiple new rows
    if (changes.hasChanges) {
      toastState.addToast(
        "Please save or discard your changes to existing rows before adding new rows.",
        "warning"
      );
      return;
    }

    // Create a template with empty values for all columns
    const template: Record<string, any> = {};
    keys.forEach(key => {
      if (key !== 'id') {
        template[key] = '';
      }
    });

    // Add a new row with empty values for all columns
    const newRows = rowGen.addNewRows(1, template);

    // Scroll to the bottom of the grid — GridContainer observes ctx.scrollToRow
    await tick();
    const totalRows = assets.length;
    const lastRowIndex = totalRows - 1;
    ctx.scrollToRow = lastRowIndex;
    // Select the first cell of the new row
    selection.selectCell(lastRowIndex, 1);
  }

  // scrollContainer, visibleData, selectionOverlay, copyOverlay moved to GridContainer/GridOverlays
  let errorNavigationIndex = $state(-1);
  // Reactive URL — SvelteURL makes searchParams deeply reactive
  // (page.url uses $state.raw which is shallow — doesn't react to replaceState changes)
  const reactiveUrl = new SvelteURL(page.url);

  // Sync reactiveUrl from page.url on SvelteKit navigation (e.g. clicking Home links)
  // page.url reference changes on navigation but NOT on replaceState — so this only fires on real navigations
  $effect(() => {
    const url = page.url; // subscribe to page.url reference changes
    untrack(() => {
      // Clear all existing params
      for (const key of [...reactiveUrl.searchParams.keys()]) {
        reactiveUrl.searchParams.delete(key);
      }
      // Copy params from the new page.url
      for (const [key, value] of url.searchParams.entries()) {
        reactiveUrl.searchParams.append(key, value);
      }
    });
  });

  // --- URL-driven search helpers ---
  function updateSearchUrl(params: { q?: string; filters?: Filter[]; view?: string }) {
    // Clear known search params (delete only specific keys to preserve SvelteURL reactive tracking)
    reactiveUrl.searchParams.delete('q');
    reactiveUrl.searchParams.delete('filter');
    reactiveUrl.searchParams.delete('view');
    if (params.q) reactiveUrl.searchParams.set('q', params.q);
    if (params.filters && params.filters.length > 0) {
      params.filters.forEach(f => reactiveUrl.searchParams.append('filter', `${f.key}:${f.value}`));
    }
    // Always include view in URL to prevent flicker on reload
    reactiveUrl.searchParams.set('view', params.view || 'default');
    // Sync to browser URL bar (non-reactive, just visual)
    replaceState(new URL(reactiveUrl), {});
  }

  function parseUrlFilters(filterParams: string[]): Filter[] {
    return filterParams
      .map(f => {
        const colonIndex = f.indexOf(':');
        if (colonIndex === -1) return null;
        return { key: f.slice(0, colonIndex), value: f.slice(colonIndex + 1) };
      })
      .filter((f): f is Filter => f !== null);
  }

  function getCurrentUrlState() {
    const q = reactiveUrl.searchParams.get('q') || '';
    const filters = parseUrlFilters(reactiveUrl.searchParams.getAll('filter'));
    const view = reactiveUrl.searchParams.get('view') || 'default';
    return { q, filters, view };
  }

  // --- View Switching ---
  function handleViewChange(viewName: string) {
    if (viewName === ctx.activeView) return;
    // Just update URL — the URL-driven effect handles view loading, state reset, etc.
    updateSearchUrl({ view: viewName });
  }

  async function applySort(key: string, dir: "asc" | "desc") {
    selection.reset();
    // Toggle off if same key+direction
    if (ctx.sortKey === key && ctx.sortDirection === dir) {
      ctx.sortKey = null;
      ctx.sortDirection = null;
      filteredAssets = [...baseAssets];
    } else {
      ctx.sortKey = key;
      ctx.sortDirection = dir;
      filteredAssets = await sortDataAsync(filteredAssets, key, dir);
    }
    headerMenu.close();
  }

  type SortDirection = 'asc' | 'desc';

  function sortData<T>(list: T[], key: keyof T, dir: SortDirection): T[] {
    const direction = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const valA = a[key];
      const valB = b[key];
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * direction;
      }
      return String(valA).localeCompare(String(valB)) * direction;
    });
  }

  async function sortDataAsync(data: any[], key: string, dir: SortDirection): Promise<any[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(sortData(data, key as any, dir));
      }, 0);
    });
  }

  async function handleCopy() {
    await clipboard.copy(assets, keys);
    if (contextMenu.visible) contextMenu.close();
    // Selection overlay visibility is now automatically derived:
    // hidden when selection is within copy bounds, shown when outside
  }

  function handleContextMenu(e: MouseEvent, visibleIndex: number, col: number) {
    const actualRow = virtualScroll.getActualIndex(visibleIndex);
    const key = keys[col];
    const value = String(assets[actualRow][key] ?? "");
    selection.selectCell(actualRow, col);
    contextMenu.open(e, actualRow, col, value, key);
    headerMenu.close();
  }

  function handleDeleteNewRow() {
    if (!contextMenu.visible) return;
    const { row } = contextMenu;

    // Check if this is a new row (row index >= filtered assets length)
    const isNewRow = row >= filteredAssets.length;
    if (isNewRow) {
      const newRowIndex = row - filteredAssets.length;
      rowGen.deleteNewRow(newRowIndex);
      contextMenu.close();
      selection.reset();
      toastState.addToast("New row deleted.", "info");
    }
  }

  function getActionTarget() {
    if (contextMenu.visible) {
      return { row: contextMenu.row, col: contextMenu.col };
    }
    return selection.anchor;
  }

  function releaseEditLock() {
    const pos = edit.getEditPosition();
    if (pos) {
      const asset = assets[pos.row];
      const key = keys[pos.col];
      if (asset && key) {
        realtime.sendEditEnd(asset.id, key);
      }
    }
  }

  function navigateToError(direction: 'prev' | 'next') {
    const invalidCells: { row: number; col: number }[] = [];
    const keyMap = new Map(keys.map((key, index) => [key, index]));
    const assetIdMap = new Map(assets.map((asset, index) => [String(asset.id), index]));

    // Existing row errors
    for (const { id, key } of changes.getInvalidCellKeys()) {
      const row = assetIdMap.get(id);
      const col = keyMap.get(key);
      if (row !== undefined && col !== undefined) {
        invalidCells.push({ row, col });
      }
    }

    // New row errors
    const newRows = rowGen.newRows;
    for (let i = 0; i < newRows.length; i++) {
      const rowIndex = filteredAssets.length + i;
      for (const key of keys) {
        if (key !== 'id' && rowGen.isNewRowFieldInvalid(i, key)) {
          const col = keyMap.get(key);
          if (col !== undefined) {
            invalidCells.push({ row: rowIndex, col });
          }
        }
      }
    }

    if (invalidCells.length === 0) return;

    // Sort by row, then col for consistent ordering
    invalidCells.sort((a, b) => a.row - b.row || a.col - b.col);

    // Navigate
    if (direction === 'next') {
      errorNavigationIndex = (errorNavigationIndex + 1) % invalidCells.length;
    } else {
      errorNavigationIndex = errorNavigationIndex <= 0
        ? invalidCells.length - 1
        : errorNavigationIndex - 1;
    }

    const target = invalidCells[errorNavigationIndex];
    selection.selectCell(target.row, target.col);
    ctx.scrollToRow = target.row; // GridContainer observes and calls ensureVisible
  }

  async function handlePaste() {
    if (!user) {
      toastState.addToast("Log in to edit.", "warning");
      return;
    }
    const target = getActionTarget();
    if (!target) return;

    if (rowGen.hasNewRows && target.row < filteredAssets.length) {
      toastState.addToast(
        "Please save or discard new rows before pasting into existing rows.",
        "warning",
      );
      return;
    }

    // Create a mutable copy of assets for the paste operation
    const mutableAssets = [...assets];
    const pasteResult = await clipboard.paste(target, mutableAssets, keys);

    if (pasteResult && pasteResult.changes.length > 0) {
      const existingRowChanges: typeof pasteResult.changes = [];

      // Process each change and route to the appropriate manager
      for (const change of pasteResult.changes) {
        const rowIndex = mutableAssets.findIndex(a => a.id === change.id);
        if (rowIndex === -1) continue;

        // Check if this is a new row (row index >= filtered assets length)
        const isNewRow = rowIndex >= filteredAssets.length;

        if (isNewRow) {
          // Don't allow pasting into ID column
          if (change.key === 'id') continue;

          // Update new row in the manager
          const newRowIndex = rowIndex - filteredAssets.length;
          rowGen.updateNewRowField(newRowIndex, change.key, change.newValue);
        } else {
          // Don't allow pasting into ID column
          if (change.key === 'id') continue;

          // Update existing row
          const itemInFiltered = filteredAssets.find(a => a.id === change.id);
          if (itemInFiltered) {
            itemInFiltered[change.key] = change.newValue;
          }

          existingRowChanges.push(change);
          changes.update(change);
        }
      }

      // Record ALL paste changes as a single undo batch
      if (existingRowChanges.length > 0) {
        history.recordBatch(existingRowChanges);
      }
    }

    if (contextMenu.visible) contextMenu.close();
    if (pasteResult) {
      const startRow = target.row;
      const startCol = target.col;
      const endRow = Math.min(
        startRow + pasteResult.rows - 1,
        assets.length - 1,
      );
      const endCol = Math.min(startCol + pasteResult.cols - 1, keys.length - 1);
      selection.reset();
      selection.start = { row: startRow, col: startCol };
      selection.end = { row: endRow, col: endCol };
    }
  }

  function handleFilterByValue() {
    if (!contextMenu.visible) return;
    const { key, value: filterValue } = contextMenu;
    const { q, filters, view } = getCurrentUrlState();
    // Toggle the filter
    const exists = filters.some(f => f.key === key && f.value === filterValue);
    const newFilters = exists
      ? filters.filter(f => !(f.key === key && f.value === filterValue))
      : [...filters, { key, value: filterValue }];
    updateSearchUrl({ q, filters: newFilters, view });
    contextMenu.close();
  }

  async function handleEditAction() {
    if (!user) {
      toastState.addToast("Log in to edit.", "warning");
      contextMenu.close();
      return;
    }
    // Falls back to state (ContextMenu > Selection)
    const target = getActionTarget();

    if (!target) return;
    const { row, col } = target;

    // Check if trying to edit an existing row while new rows exist
    const isExistingRow = row < filteredAssets.length;
    if (isExistingRow && rowGen.hasNewRows) {
      toastState.addToast(
        "Please save or discard new rows before editing existing rows.",
        "warning"
      );
      contextMenu.close();
      return;
    }

    const key = keys[col];
    const asset = assets[row];
    if (!asset || !key) return;

    // Check if cell is locked by another user
    if (realtime.isCellLocked(asset.id, key)) {
      const lock = realtime.getCellLock(asset.id, key);
      if (lock) {
        toastState.addToast(
          `This cell is being edited by ${lock.firstname} ${lock.lastname}.`,
          "warning"
        );
      }
      contextMenu.close();
      return;
    }

    // Don't allow editing ID column
    if (key === 'id') {
      toastState.addToast("ID column cannot be edited.", "warning");
      contextMenu.close();
      return;
    }

    const currentValue = String(asset[key] ?? "");

    // Show dropdown for columns with value restrictions
    if (validation.hasConstraints(key)) {
      const validValues = validation.getValidValues(key);
      editDropdown.show(validValues, currentValue);
    } else {
      editDropdown.hide();
    }

    edit.startEdit(row, col, key, currentValue);

    // Notify other users that we're editing this cell
    realtime.sendEditStart(asset.id, key);

    contextMenu.close();
    selection.reset();

    // GridRow observes ctx.isEditing + ctx.editRow via $effect and handles focus/updateRowHeight locally
  }

  async function saveEdit() {
    if (!user) {
      toastState.addToast("Log in to edit.", "warning");
      return;
    }
    const pos = edit.getEditPosition();
    if (!pos) return;

    autocomplete.clear();

    // Release cell lock before save/cancel clears edit state
    releaseEditLock();

    // Check if this is a new row (row index >= filtered assets length)
    const isNewRow = pos.row >= filteredAssets.length;

    if (isNewRow) {
      // Handle new row editing
      const key = keys[pos.col];
      const newValue = ctx.inputValue.trim();

      // Update the new row field directly in the controller
      const newRowIndex = pos.row - filteredAssets.length;
      rowGen.updateNewRowField(newRowIndex, key, newValue);

      // Reset the edit controller
      edit.cancel();
    } else {
      // Existing row - validate first
      const key = keys[pos.col];
      const newValue = ctx.inputValue.trim();

      // Validate the value before saving
      if (!validation.isValidValue(key, newValue)) {
        toastState.addToast(
          `Invalid value for ${key}. Please check constraints.`,
          "warning"
        );
        // Don't save, keep editing
        return;
      }

      // Existing row - use normal flow
      const change = await edit.save(filteredAssets);

      if (change) {
        // Also update baseAssets to keep them in sync
        updateAssetInList(baseAssets, {
          id: change.id,
          key: change.key,
          value: change.newValue,
        });

        const action = {
          id: change.id,
          key: change.key,
          oldValue: change.oldValue,
          newValue: change.newValue,
        };
        history.recordBatch([action]);
        changes.update(action);
      }
    }

    if (pos) selection.selectCell(pos.row, pos.col);
  }

  function cancelEdit() {
    const pos = edit.getEditPosition();
    editDropdown.hide();
    autocomplete.clear();
    releaseEditLock();
    edit.cancel();
    if (pos) selection.selectCell(pos.row, pos.col);
  }

  function handleScroll(e: Event) {
    virtualScroll.handleScroll(e);
    if (headerMenu.activeKey) headerMenu.reposition();
  }

  async function commitChanges() {
    if (!user) {
      toastState.addToast("Log in to edit.", "warning");
      return;
    }

    // Block commit if any existing-row changes are invalid
    if (changes.hasInvalidChanges) {
      toastState.addToast(
        "Cannot commit: Fix all invalid values first.",
        "error"
      );
      return;
    }

    const validChanges = changes.getAllChanges();

    if (validChanges.length === 0) {
      return;
    }

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
        toastState.addToast(
          "Failed to commit changes. See console for details.",
          "error",
        );
        return;
      }

      changes.clear();
      selection.resetAll();

      toastState.addToast(
        `${validChanges.length} changes committed successfully.`,
        "success",
      );
    } catch (error) {
      console.error("Commit failed:", error);
      toastState.addToast("Network error while committing changes.", "error");
    }
  }

  async function addNewRows() {
    if (!user) {
      toastState.addToast("Log in to edit.", "warning");
      return;
    }

    // Validate all new rows
    const isValid = rowGen.validateAll();

    if (!isValid) {
      // Set dirty cells for invalid new row fields
      const keyMap = new Map(keys.map((key, index) => [key, index]));
      const invalidCells: { row: number; col: number }[] = [];
      const newRows = rowGen.newRows;

      for (let i = 0; i < newRows.length; i++) {
        const rowIndex = filteredAssets.length + i;
        for (const key of keys) {
          if (key !== 'id' && rowGen.isNewRowFieldInvalid(i, key)) {
            const col = keyMap.get(key);
            if (col !== undefined) {
              invalidCells.push({ row: rowIndex, col });
            }
          }
        }
      }
      selection.setDirtyCells(invalidCells);

      toastState.addToast(
        "Invalid values in new rows.",
        "warning",
      );
      return;
    }

    // Check if any new rows are incomplete (have empty required fields)
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

    // Prepare rows for API (strip the temporary ID, include all fields)
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
        toastState.addToast(
          errorData.error || "Failed to save new rows.",
          "error",
        );
        rowGen.clearValidation();
        return;
      }

      const { createdRows } = await response.json();

      // Add the newly created rows to baseAssets and filteredAssets
      if (createdRows && createdRows.length > 0) {
        baseAssets = [...baseAssets, ...createdRows];
        filteredAssets = [...filteredAssets, ...createdRows];
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

  function discardChanges() {
    if (!user) {
      toastState.addToast("Log in to edit.", "warning");
      return;
    }
    const changesToRevert = changes.getAllChanges(true);

    // Revert changes from changes controller
    for (const change of changesToRevert) {
        const item = filteredAssets.find(a => a.id === change.id);
        if (item) {
            item[change.key] = change.oldValue;
        }
    }

    // Remove the discarded changes from history
    history.clearCommitted(changesToRevert);

    // Clear all changes and new rows
    changes.clear();
    rowGen.clearNewRows();
    selection.clearDirtyCells();
    selection.resetAll();

    toastState.addToast("Changes discarded.", "info");
  }

  // Separate effect for one-time setup (runs only once)
  // mountInteraction removed — interaction handling delegated to GridOverlays via {@attach gridShortcuts(...)}
  $effect(() => {
    // Register this page's handler
    realtime.setAssetUpdateHandler(handleRealtimeUpdate);

    return () => {
      // CHANGED: Overwrite with an empty function to "remove" the handler
      realtime.setAssetUpdateHandler(() => {});

      // Only clear controllers on actual component unmount
      changes.clear();
      history.clear();
      rowGen.clearNewRows();
    };
  });

  // ResizeObserver moved to GridContainer — it owns the scroll container now

  let skipInitialFetch = true; // Server already returned correct data for initial load
  $effect(() => {
    // Read from reactiveUrl (SvelteURL) — deeply reactive, triggers on searchParams changes
    const q = reactiveUrl.searchParams.get('q') || '';
    const filterParams = reactiveUrl.searchParams.getAll('filter');
    const filters = parseUrlFilters(filterParams);
    const urlView = reactiveUrl.searchParams.get('view') || 'default';

    // Sync searchManager UI state from URL (one-way: URL -> manager)
    // Use untrack to prevent searchManager reactive writes from re-triggering this effect
    untrack(() => {
      searchManager.inputValue = q;
      const currentFiltersJson = JSON.stringify(searchManager.selectedFilters.slice().sort((a, b) => a.key.localeCompare(b.key) || a.value.localeCompare(b.value)));
      const urlFiltersJson = JSON.stringify(filters.slice().sort((a, b) => a.key.localeCompare(b.key) || a.value.localeCompare(b.value)));
      if (currentFiltersJson !== urlFiltersJson) {
        searchManager.setSelectedFilters(filters);
      }
    });

    // On initial mount, server already returned correct data — skip fetching
    if (skipInitialFetch) {
      skipInitialFetch = false;
      return;
    }

    // Stale request guard
    let cancelled = false;

    (async () => {
      // Handle view change if needed (load view data FIRST before search)
      // Use untrack for ctx reads/writes — we only want this effect to react to URL changes,
      // not to ctx.activeView state changes (which would cancel the async fetch)
      const validViews = ['default', 'audit', 'ped', 'galaxy', 'network'];
      const currentView = untrack(() => ctx.activeView);
      if (urlView !== currentView) {
        if (validViews.includes(urlView)) {
          untrack(() => { ctx.activeView = urlView; });
          try {
            const response = await fetch(`/api/assets/view?view=${urlView}`);
            if (cancelled) return;
            if (response.ok) {
              const result = await response.json();
              baseAssets = result.assets;
              // If no search params, show view data directly and we're done
              if (!q && filters.length === 0) {
                filteredAssets = result.assets;
                searchError = '';
                selection.reset();
                ctx.sortKey = null;
                ctx.sortDirection = null;
                changes.clear();
                history.clear();
                rowGen.clearNewRows();
                return;
              }
            }
          } catch (err) {
            if (cancelled) return;
            console.error(`Failed to load ${urlView} view:`, err);
          }
        } else {
          untrack(() => { ctx.activeView = 'default'; });
        }
      }

      // Handle search/filter state
      if (!q && filters.length === 0) {
        // No search params — show all base data
        filteredAssets = [...baseAssets];
        searchError = '';
        ctx.sortKey = null;
        ctx.sortDirection = null;
        selection.reset();
      } else {
        // Has search params — fetch from search API
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        filters.forEach(f => params.append('filter', `${f.key}:${f.value}`));
        params.set('view', urlView);

        try {
          const response = await fetch(`/api/search?${params.toString()}`);
          if (cancelled) return;
          if (!response.ok) throw new Error(`API Error: ${response.status}`);
          const result = await response.json();

          // Discard pending changes when search results change
          if (changes.hasChanges) {
            const changesToRevert = changes.getAllChanges(true);
            for (const change of changesToRevert) {
              const item = baseAssets.find(a => a.id === change.id);
              if (item) {
                item[change.key] = change.oldValue;
              }
            }
            changes.clear();
            history.clear();
          }
          if (rowGen.hasNewRows) {
            rowGen.clearNewRows();
          }
          filteredAssets = result || [];
          searchError = '';
          selection.reset();
          ctx.sortKey = null;
          ctx.sortDirection = null;
        } catch (err) {
          if (cancelled) return;
          searchError = err instanceof Error ? err.message : 'Search failed';
          console.error('Search failed:', err);
        }
      }
    })();

    return () => { cancelled = true; };
  });
  $effect(() => {
    if (filterPanel.isOpen) headerMenu.close();
  });
  $effect(() => {
    if (headerMenu.activeKey) filterPanel.close();
  });
  $effect(() => {
    filteredAssets;
    searchManager.cleanupFilterCache();
    // Sort state is reset by the URL-driven effect when data changes
  });

  let updatePositionTimeout: NodeJS.Timeout | null = null;
  $effect(() => {
    if (selection.start) {
      if (updatePositionTimeout) {
        clearTimeout(updatePositionTimeout);
      }
      updatePositionTimeout = setTimeout(() => {
        if (selection.start.row === -1) {
          if (!ctx.isEditing) {
            realtime.sendDeselect();
          }
        } else {
          const asset = assets[selection.start.row];
          const assetId = asset?.id;
          realtime.sendPositionUpdate(selection.start.row, selection.start.col, assetId);
        }
      }, 100);
    }
  });
</script>

<div class="px-4 py-2 flex-grow flex flex-col">
  <Toolbar
    user={user}
    {getCurrentUrlState}
    {updateSearchUrl}
    onAddNewRow={handleAddNewRow}
    onCommit={commitChanges}
    onAddRows={addNewRows}
    onDiscard={discardChanges}
    onViewChange={handleViewChange}
    onNavigateError={navigateToError}
  />

  {#if searchError}
    <p class="text-red-500">Error: {searchError}</p>
  {:else}
    <GridContainer
      {assets}
      onHeaderClick={(e, key, _filterItems, isLast) =>
        headerMenu.toggle(e, key, searchManager.getFilterItems(key, assets, baseAssets), isLast)}
      onContextMenu={handleContextMenu}
      onCloseContextMenu={() => contextMenu.close()}
    />
  {/if}

  <ContextMenu />
</div>
