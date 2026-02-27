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
    getChangeControllerContext,
    getHistoryControllerContext,
    getRowGenControllerContext,
  } from '$lib/context/gridContext.svelte.ts';

  import { searchManager } from '$lib/data/searchManager.svelte';
  import { createSelectionController } from '$lib/grid/utils/gridSelection.svelte.ts';
  import { createValidationController } from '$lib/grid/utils/gridValidation.svelte.ts';
  import { realtime } from '$lib/utils/interaction/realtimeManager.svelte';
  import { toastState } from '$lib/components/toast/toastState.svelte';
  import { createEventQueue } from './EventQueue.svelte.ts';
  import { createEventHandler } from './EventHandler.svelte.ts';

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
  // changes and history are read from context — GridOverlays creates the instances
  // and publishes them via setChangeControllerContext/setHistoryControllerContext.
  // This ensures EventListener's commit/discard operate on the SAME instances
  // that receive edits, not independent empty instances.
  const changes = getChangeControllerContext();
  const history = getHistoryControllerContext();
  const selection = createSelectionController();
  const rowGen = getRowGenControllerContext();
  const validation = createValidationController();

  // --- LOCAL DATA STATE ---
  // svelte-ignore state_referenced_locally
  let baseAssets: Record<string, any>[] = $state(data.assets ?? []);
  // svelte-ignore state_referenced_locally
  let filteredAssets: Record<string, any>[] = $state(data.searchResults ?? data.assets ?? []);

  // Keys derived from assets
  const assets = $derived([...filteredAssets, ...rowGen.newRows]);
  const keys = $derived(assets.length > 0 ? Object.keys(assets[0]) : []);

  // --- EVENT HANDLER AND QUEUE ---
  // Created at top level (NOT inside $effect) — Pitfall 6: factory must run during sync init
  const handler = createEventHandler({
    getBaseAssets: () => baseAssets,
    setBaseAssets: (v) => { baseAssets = v; },
    getFilteredAssets: () => filteredAssets,
    setFilteredAssets: (v) => { filteredAssets = v; },
    dataCtx,
    viewCtx,
    sortCtx,
    editingCtx,
    changeCtx,
    columnCtx,
    changes,
    history,
    selection,
    rowGen,
    updateSearchUrl,
  });
  const queue = createEventQueue(handler.handle);

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
  // Translates URL state changes into queue events.
  // The cancelled flag pattern from DataController is removed — the queue serializes
  // handlers, so only one runs at a time. No need to cancel in-flight operations.
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

    const currentView = untrack(() => viewCtx.activeView);
    if (urlView !== currentView) {
      queue.enqueue({ type: 'VIEW_CHANGE', view: urlView, q, filters });
    } else if (q || filters.length > 0) {
      queue.enqueue({ type: 'FILTER', q, filters, view: urlView });
    } else {
      // No q, no filters, same view — clear filter, reset to baseAssets
      queue.enqueue({ type: 'FILTER', q: '', filters: [], view: urlView });
    }
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

  // --- APPLY SORT — local-only, not queued ---
  // Sort is pure in-memory. No network call needed.
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

  // --- HANDLE FILTER SELECT — local-only, not queued ---
  // Just calls updateSearchUrl which triggers the URL $effect → queue enqueue
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

  // --- HANDLE VIEW CHANGE — directly queued ---
  // Enqueues VIEW_CHANGE directly (not through URL -> $effect).
  // URL is updated as side-effect by EventHandler after fetch completes.
  // No guard — the queue handles serialization. Every click = one event.
  function handleViewChange(viewName: string) {
    const { q, filters } = getCurrentUrlState();
    queue.enqueue({ type: 'VIEW_CHANGE', view: viewName, q, filters });
  }

  // --- NAVIGATE ERROR — local-only, not queued ---
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

  // --- ADD NEW ROW — local-only, not queued ---
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

  // Wire action callbacks — queue-eligible operations go through queue.enqueue(),
  // local-only operations execute directly (not queued).
  // commit/addRows/discard return Promise<void> to satisfy DataContext type — enqueue is sync
  // but the Toolbar awaits these; wrapping in async gives back a resolved promise immediately.
  $effect(() => {
    dataCtx.commit = async () => queue.enqueue({ type: 'COMMIT', mode: 'update' });
    dataCtx.discard = async () => queue.enqueue({ type: 'DISCARD' });
    dataCtx.addRows = async () => queue.enqueue({ type: 'COMMIT', mode: 'create' });
    dataCtx.addNewRow = handleAddNewRow;       // local-only, NOT queued
    dataCtx.navigateError = navigateToError;   // local-only, NOT queued
    dataCtx.viewChange = handleViewChange;     // direct enqueue, URL updated by EventHandler
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
  // WS delta handler registered via queue.enqueue, not direct callback
  $effect(() => {
    realtime.setAssetUpdateHandler((payload: { id: number; key: string; value: any }) =>
      queue.enqueue({ type: 'WS_DELTA', payload })
    );
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
