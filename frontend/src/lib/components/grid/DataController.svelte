<script lang="ts">
  import { tick, untrack } from "svelte";
  import { replaceState } from '$app/navigation';
  import { SvelteURL } from 'svelte/reactivity';
  import { page } from '$app/state';

  import type { PageProps } from '../../../routes/$types';
  import type { Filter } from '$lib/data/searchManager.svelte';

  import {
    getDataContext,
    getChangeContext,
    getValidationContext,
    getViewContext,
    getSortContext,
    getColumnContext,
    getSelectionContext,
    getEditingContext,
    getUiContext,
  } from '$lib/context/gridContext.svelte.ts';

  import { searchManager } from '$lib/data/searchManager.svelte';
  import { createChangeController } from '$lib/grid/utils/gridChanges.svelte.ts';
  import { createSelectionController } from '$lib/grid/utils/gridSelection.svelte.ts';
  import { createRowGenerationController } from '$lib/grid/utils/rowGeneration.svelte.ts';
  import { createHistoryController } from '$lib/grid/utils/gridHistory.svelte.ts';
  import { createValidationController } from '$lib/grid/utils/gridValidation.svelte.ts';
  import { realtime } from '$lib/utils/interaction/realtimeManager.svelte';
  import { toastState } from '$lib/components/toast/toastState.svelte';

  // --- PROP ---
  type Props = { data: PageProps['data'] };
  let { data }: Props = $props();

  // --- CONTEXT READS ---
  const dataCtx = getDataContext();
  const changeCtx = getChangeContext();
  const validationCtx = getValidationContext();
  const viewCtx = getViewContext();
  const sortCtx = getSortContext();
  const columnCtx = getColumnContext();
  const selectionCtx = getSelectionContext();
  const editingCtx = getEditingContext();
  const uiCtx = getUiContext();

  // --- CONTROLLERS ---
  const changes = createChangeController();
  const selection = createSelectionController();
  const rowGen = createRowGenerationController();
  const history = createHistoryController();
  const validation = createValidationController();

  // --- LOCAL DATA STATE ---
  // svelte-ignore state_referenced_locally
  let baseAssets: Record<string, any>[] = $state(data.assets ?? []);
  // svelte-ignore state_referenced_locally
  let filteredAssets: Record<string, any>[] = $state(data.searchResults ?? data.assets ?? []);

  // Keys derived from assets
  const assets = $derived([...filteredAssets, ...rowGen.newRows]);
  const keys = $derived(assets.length > 0 ? Object.keys(assets[0]) : []);

  // Synchronous seed — prevents "no data" flash on first render
  // These run during script initialization, before the first render frame
  dataCtx.assets = [...(data.searchResults ?? data.assets ?? []), ...rowGen.newRows];
  dataCtx.baseAssets = data.assets ?? [];
  dataCtx.filteredAssetsCount = (data.searchResults ?? data.assets ?? []).length;
  dataCtx.user = data.user ?? null;
  columnCtx.keys = data.assets?.[0] ? Object.keys(data.assets[0]) : [];

  // Sync assets into dataCtx (reactive updates after initial seed)
  $effect(() => { dataCtx.assets = assets; });
  $effect(() => { dataCtx.baseAssets = baseAssets; });
  $effect(() => { dataCtx.filteredAssetsCount = filteredAssets.length; });
  $effect(() => { dataCtx.user = data.user ?? null; });

  // Sync keys into columnCtx
  $effect(() => { columnCtx.keys = keys; });

  // Set validation constraints from route data
  $effect(() => {
    const locNames = (data.locations ?? []).map((l: any) => l.location_name);
    const statNames = (data.statuses ?? []).map((s: any) => s.status_name);
    const condNames = (data.conditions ?? []).map((c: any) => c.condition_name);
    const deptNames = (data.departments ?? []).map((d: any) => d.department_name);
    untrack(() => {
      const constraints = {
        location: locNames,
        status: statNames,
        condition: condNames,
        department: deptNames,
      };
      validationCtx.validationConstraints = constraints;
      validation.setConstraints(constraints);
    });
  });

  // Set nextId provider for new rows
  $effect(() => {
    rowGen.setNextIdProvider(() => {
      if (baseAssets.length === 0) return 1;
      const maxId = Math.max(...baseAssets.map((a: any) => typeof a.id === 'number' ? a.id : 0));
      return maxId + 1 + rowGen.newRowCount;
    });
  });

  // Track dirty cells for existing row changes
  $effect(() => {
    const allChanges = changes.getAllChanges();
    if (allChanges.length === 0) {
      selection.clearDirtyCells();
      return;
    }
    const keyMap = new Map(keys.map((key, index) => [key, index]));
    const assetIdMap = new Map(assets.map((asset, index) => [asset.id.toString(), index]));
    const dirtyCells = allChanges
      .map((change) => {
        const row = assetIdMap.get(String(change.id));
        const col = keyMap.get(change.key);
        return { row, col };
      })
      .filter((c) => c.row !== undefined && c.col !== undefined) as { row: number; col: number }[];
    if (dirtyCells.length === 0) {
      selection.clearDirtyCells();
    } else {
      selection.setDirtyCells(dirtyCells);
    }
  });

  // --- REACTIVE URL ---
  const reactiveUrl = new SvelteURL(page.url);

  // Sync reactiveUrl from page.url on SvelteKit navigation
  $effect(() => {
    const url = page.url;
    untrack(() => {
      for (const key of [...reactiveUrl.searchParams.keys()]) {
        reactiveUrl.searchParams.delete(key);
      }
      for (const [key, value] of url.searchParams.entries()) {
        reactiveUrl.searchParams.append(key, value);
      }
    });
  });

  // --- URL HELPERS ---
  function updateSearchUrl(params: { q?: string; filters?: Filter[]; view?: string }) {
    const current = getCurrentUrlState();
    const q = params.q !== undefined ? params.q : current.q;
    const filters = params.filters !== undefined ? params.filters : current.filters;
    const view = params.view !== undefined ? params.view : current.view;

    reactiveUrl.searchParams.delete('q');
    reactiveUrl.searchParams.delete('filter');
    reactiveUrl.searchParams.delete('view');
    if (q) reactiveUrl.searchParams.set('q', q);
    if (filters && filters.length > 0) {
      filters.forEach(f => reactiveUrl.searchParams.append('filter', `${f.key}:${f.value}`));
    }
    reactiveUrl.searchParams.set('view', view || 'default');
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

  // Expose URL helpers on uiCtx for Toolbar
  $effect(() => {
    uiCtx.getCurrentUrlState = getCurrentUrlState;
    uiCtx.updateSearchUrl = updateSearchUrl;
  });

  // --- URL-DRIVEN SEARCH $EFFECT ---
  let skipInitialFetch = true;

  $effect(() => {
    const q = reactiveUrl.searchParams.get('q') || '';
    const filterParams = reactiveUrl.searchParams.getAll('filter');
    const filters = parseUrlFilters(filterParams);
    const urlView = reactiveUrl.searchParams.get('view') || 'default';

    untrack(() => {
      searchManager.inputValue = q;
      const currentFiltersJson = JSON.stringify(searchManager.selectedFilters.slice().sort((a, b) => a.key.localeCompare(b.key) || a.value.localeCompare(b.value)));
      const urlFiltersJson = JSON.stringify(filters.slice().sort((a, b) => a.key.localeCompare(b.key) || a.value.localeCompare(b.value)));
      if (currentFiltersJson !== urlFiltersJson) {
        searchManager.setSelectedFilters(filters);
      }
    });

    if (skipInitialFetch) {
      skipInitialFetch = false;
      return;
    }

    let cancelled = false;

    (async () => {
      const validViews = ['default', 'audit', 'ped', 'galaxy', 'network'];
      const currentView = untrack(() => viewCtx.activeView);
      if (urlView !== currentView) {
        if (validViews.includes(urlView)) {
          untrack(() => { viewCtx.activeView = urlView; });
          try {
            const response = await fetch(`/api/assets/view?view=${urlView}`);
            if (cancelled) return;
            if (response.ok) {
              const result = await response.json();
              baseAssets = result.assets;
              if (!q && filters.length === 0) {
                filteredAssets = result.assets;
                selection.reset();
                sortCtx.sortKey = null;
                sortCtx.sortDirection = null;
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
          untrack(() => { viewCtx.activeView = 'default'; });
        }
      }

      if (!q && filters.length === 0) {
        filteredAssets = [...baseAssets];
        sortCtx.sortKey = null;
        sortCtx.sortDirection = null;
        selection.reset();
      } else {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        filters.forEach(f => params.append('filter', `${f.key}:${f.value}`));
        params.set('view', urlView);

        try {
          const response = await fetch(`/api/search?${params.toString()}`);
          if (cancelled) return;
          if (!response.ok) throw new Error(`API Error: ${response.status}`);
          const result = await response.json();

          if (changes.hasChanges) {
            const changesToRevert = changes.getAllChanges(true);
            for (const change of changesToRevert) {
              const item = baseAssets.find((a: any) => a.id === change.id);
              if (item) item[change.key] = change.oldValue;
            }
            changes.clear();
            history.clear();
          }
          if (rowGen.hasNewRows) rowGen.clearNewRows();
          filteredAssets = result || [];
          selection.reset();
          sortCtx.sortKey = null;
          sortCtx.sortDirection = null;
        } catch (err) {
          if (cancelled) return;
          console.error('Search failed:', err);
        }
      }
    })();

    return () => { cancelled = true; };
  });

  // Sort helper
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
      setTimeout(() => { resolve(sortData(data, key as any, dir)); }, 0);
    });
  }

  // --- APPLY SORT ---
  async function applySort(key: string, dir: 'asc' | 'desc') {
    selection.reset();
    if (sortCtx.sortKey === key && sortCtx.sortDirection === dir) {
      sortCtx.sortKey = null;
      sortCtx.sortDirection = null;
      filteredAssets = [...baseAssets];
    } else {
      sortCtx.sortKey = key;
      sortCtx.sortDirection = dir;
      filteredAssets = await sortDataAsync(filteredAssets, key, dir);
    }
    uiCtx.headerMenu?.close();
  }

  // --- HANDLE FILTER SELECT ---
  function handleFilterSelect(item: string, key: string) {
    const { q, filters, view } = getCurrentUrlState();
    const exists = filters.some(f => f.key === key && f.value === item);
    const newFilters = exists
      ? filters.filter(f => !(f.key === key && f.value === item))
      : [...filters, { key, value: item }];
    updateSearchUrl({ q, filters: newFilters, view });
  }

  // Register sort and filter handlers on uiCtx
  $effect(() => {
    uiCtx.applySort = applySort;
    uiCtx.handleFilterSelect = handleFilterSelect;
  });

  // --- HANDLE VIEW CHANGE ---
  function handleViewChange(viewName: string) {
    if (viewName === viewCtx.activeView) return;
    updateSearchUrl({ view: viewName });
  }

  // Expose viewChange on dataCtx
  $effect(() => {
    dataCtx.viewChange = handleViewChange;
  });

  // --- HANDLE REALTIME UPDATE ---
  const updateAssetInList = (
    list: Record<string, any>[],
    payload: { id: number | string; key: string; value: any },
  ) => {
    const index = list.findIndex((a) => a.id === payload.id);
    if (index !== -1) {
      list[index][payload.key] = payload.value;
    }
  };

  const handleRealtimeUpdate = (payload: { id: number; key: string; value: any }) => {
    updateAssetInList(filteredAssets, payload);
    updateAssetInList(baseAssets, payload);
  };

  // --- NAVIGATE ERROR ---
  function navigateToError(direction: 'prev' | 'next') {
    const invalidCells: { row: number; col: number }[] = [];
    const keyMap = new Map(keys.map((key, index) => [key, index]));
    const assetIdMap = new Map(assets.map((asset, index) => [String(asset.id), index]));

    for (const { id, key } of changes.getInvalidCellKeys()) {
      const row = assetIdMap.get(id);
      const col = keyMap.get(key);
      if (row !== undefined && col !== undefined) invalidCells.push({ row, col });
    }

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

    if (invalidCells.length === 0) return;
    invalidCells.sort((a, b) => a.row - b.row || a.col - b.col);

    if (direction === 'next') {
      errorNavigationIndex = (errorNavigationIndex + 1) % invalidCells.length;
    } else {
      errorNavigationIndex = errorNavigationIndex <= 0
        ? invalidCells.length - 1
        : errorNavigationIndex - 1;
    }

    const target = invalidCells[errorNavigationIndex];
    selection.selectCell(target.row, target.col);
    viewCtx.scrollToRow = target.row;
  }

  let errorNavigationIndex = $state(-1);

  // --- ADD NEW ROW ---
  async function handleAddNewRow() {
    if (!dataCtx.user) {
      toastState.addToast("Log in to add new rows.", "warning");
      return;
    }
    if (editingCtx.isEditing) {
      toastState.addToast(
        "Please finish or cancel your current edit before adding new rows.",
        "warning"
      );
      return;
    }
    if (changes.hasChanges) {
      toastState.addToast(
        "Please save or discard your changes to existing rows before adding new rows.",
        "warning"
      );
      return;
    }
    const template: Record<string, any> = {};
    keys.forEach(key => { if (key !== 'id') template[key] = ''; });
    rowGen.addNewRows(1, template);
    await tick();
    const lastRowIndex = assets.length - 1;
    viewCtx.scrollToRow = lastRowIndex;
    selection.selectCell(lastRowIndex, 1);
  }

  // --- COMMIT CHANGES ---
  async function commitChanges() {
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

  // --- ADD ROWS (commit new rows) ---
  async function addNewRows() {
    if (!dataCtx.user) {
      toastState.addToast("Log in to edit.", "warning");
      return;
    }
    const isValid = rowGen.validateAll();
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

  // --- DISCARD CHANGES ---
  function discardChanges() {
    if (!dataCtx.user) {
      toastState.addToast("Log in to edit.", "warning");
      return;
    }
    const changesToRevert = changes.getAllChanges(true);
    for (const change of changesToRevert) {
      const item = filteredAssets.find((a: any) => a.id === change.id);
      if (item) item[change.key] = change.oldValue;
    }
    history.clearCommitted(changesToRevert);
    changes.clear();
    rowGen.clearNewRows();
    selection.clearDirtyCells();
    selection.resetAll();
    toastState.addToast("Changes discarded.", "info");
  }

  // Register action callbacks on dataCtx so Toolbar can call them
  $effect(() => {
    dataCtx.commit = commitChanges;
    dataCtx.discard = discardChanges;
    dataCtx.addRows = addNewRows;
    dataCtx.addNewRow = handleAddNewRow;
    dataCtx.navigateError = navigateToError;
  });

  // --- LOGOUT HANDLER ---
  $effect(() => {
    if (!dataCtx.user) {
      untrack(() => {
        reactiveUrl.searchParams.delete('q');
        reactiveUrl.searchParams.delete('filter');
        reactiveUrl.searchParams.set('view', 'default');
      });
    }
  });

  // --- REALTIME + CLEANUP ---
  $effect(() => {
    realtime.setAssetUpdateHandler(handleRealtimeUpdate);
    return () => {
      realtime.setAssetUpdateHandler(() => {});
      changes.clear();
      history.clear();
      rowGen.clearNewRows();
    };
  });

  // Filter panel / header menu mutual-close effects
  $effect(() => {
    if (uiCtx.filterPanel?.isOpen) uiCtx.headerMenu?.close();
  });
  $effect(() => {
    if (uiCtx.headerMenu?.activeKey) uiCtx.filterPanel?.close();
  });
  $effect(() => {
    filteredAssets;
    searchManager.cleanupFilterCache();
  });
</script>
