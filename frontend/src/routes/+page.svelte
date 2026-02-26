<script lang="ts">

  import { untrack } from "svelte";
  import { SvelteMap } from 'svelte/reactivity';

  // --- TYPES ---
  import type { PageProps } from './$types';

  // --- CONTEXT ---
  import {
    setGridContext,
    setEditingContext,
    setSelectionContext,
    setClipboardContext,
    setColumnContext,
    setRowContext,
    setSortContext,
    setValidationContext,
    setChangeContext,
    setDataContext,
    setViewContext,
    setUiContext,
  } from '$lib/context/gridContext.svelte.ts';
  import type { GridContext } from '$lib/context/gridContext.svelte.ts';

  // --- COMPONENTS ---
  import ContextMenu from "$lib/grid/components/context-menu/contextMenu.svelte";
  import Toolbar from "$lib/components/grid/Toolbar.svelte";
  import GridContainer from "$lib/components/grid/GridContainer.svelte";
  import DataController from "$lib/components/grid/DataController.svelte";

  // --- STATE CLASSES ---
  import { ContextMenuState } from "$lib/grid/components/context-menu/contextMenu.svelte.ts";
  import { createHeaderMenu } from "$lib/grid/components/header-menu/headerMenu.svelte.ts";
  import { createEditDropdown } from "$lib/grid/components/edit-dropdown/editDropdown.svelte.ts";
  import { createAutocomplete } from "$lib/grid/components/suggestion-menu/autocomplete.svelte.ts";
  import { createVirtualScroll } from "$lib/grid/utils/virtualScrollManager.svelte";
  import { FilterPanelState } from "$lib/grid/components/filter-panel/filterPanel.svelte.ts";

  // --- ROUTE DATA ---
  let { data }: PageProps = $props();

  // Map data fields to the same variable names used throughout the script
  const initialAssets = data.assets;
  const initialKeys = data.assets.length > 0 ? Object.keys(data.assets[0]) : [];
  const user = data.user;
  const searchResults = data.searchResults ?? null;
  const initialView = data.initialView ?? 'default';

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

  // Register domain context slices — same reactive object, typed as each domain
  // ctx is a superset of every domain type; Svelte context stores the reference.
  // Components calling get*Context() will read from this same reactive object.
  setEditingContext(ctx as any);
  setSelectionContext(ctx as any);
  setClipboardContext(ctx as any);
  setColumnContext(ctx as any);
  setRowContext(ctx as any);
  setSortContext(ctx as any);
  setValidationContext(ctx as any);
  setChangeContext(ctx as any);
  setDataContext(ctx as any);
  setViewContext(ctx as any);
  setUiContext(ctx as any);

  // Alias for virtualScroll (created inside ctx literal above)
  const virtualScroll = ctx.virtualScroll;

  // Initialize State Classes
  const contextMenu = new ContextMenuState();
  const headerMenu = createHeaderMenu();
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
  // pageActions intentionally left as null — all consumers now use domain contexts directly

  // Sync user into ctx for components still using monolithic ctx
  ctx.assets = searchResults ?? initialAssets;
  ctx.baseAssets = initialAssets;
</script>

<div class="px-4 py-2 flex-grow flex flex-col">
  <DataController {data} />
  <Toolbar />

  <GridContainer
    assets={ctx.assets}
  />

  <ContextMenu />
</div>
