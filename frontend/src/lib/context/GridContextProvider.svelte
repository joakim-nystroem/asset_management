<script lang="ts">
  import type { Snippet } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';

  import {
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
    setChangeControllerContext,
    setHistoryControllerContext,
  } from '$lib/context/gridContext.svelte.ts';

  import { ContextMenuState } from '$lib/grid/components/context-menu/contextMenu.svelte.ts';
  import { createHeaderMenu } from '$lib/grid/components/header-menu/headerMenu.svelte.ts';
  import { createEditDropdown } from '$lib/grid/components/edit-dropdown/editDropdown.svelte.ts';
  import { createAutocomplete } from '$lib/grid/components/suggestion-menu/autocomplete.svelte.ts';
  import { createVirtualScroll } from '$lib/grid/utils/virtualScrollManager.svelte';
  import { FilterPanelState } from '$lib/grid/components/filter-panel/filterPanel.svelte.ts';
  import { createChangeController } from '$lib/grid/utils/gridChanges.svelte.ts';
  import { createHistoryController } from '$lib/grid/utils/gridHistory.svelte.ts';

  let { children }: { children: Snippet } = $props();

  // ─── Domain context initialization ────────────────────────────────────────────
  // Each domain gets its own typed $state object.
  // EventListener enriches these contexts with live data on mount.

  let editingCtx = $state({
    isEditing: false,
    editKey: null as string | null,
    editRow: -1,
    editCol: -1,
    editOriginalValue: '',
    editOriginalColumnWidth: 0,
    inputValue: '',
    editDropdown: createEditDropdown(),
    autocomplete: createAutocomplete(),
  });
  setEditingContext(editingCtx);

  let selectionCtx = $state({
    selectionStart: { row: -1, col: -1 },
    selectionEnd: { row: -1, col: -1 },
    isSelecting: false,
    isHiddenAfterCopy: false,
    dirtyCells: new Set<string>(),
  });
  setSelectionContext(selectionCtx);

  let clipboardCtx = $state({
    copyStart: { row: -1, col: -1 },
    copyEnd: { row: -1, col: -1 },
    isCopyVisible: false,
  });
  setClipboardContext(clipboardCtx);

  let columnCtx = $state({
    keys: [] as string[],
    columnWidths: new SvelteMap<string, number>(),
    resizingColumn: null as string | null,
  });
  setColumnContext(columnCtx);

  let rowCtx = $state({
    rowHeights: new SvelteMap<number, number>(),
  });
  setRowContext(rowCtx);

  let sortCtx = $state({
    sortKey: null as string | null,
    sortDirection: null as 'asc' | 'desc' | null,
  });
  setSortContext(sortCtx);

  let validationCtx = $state({
    validationConstraints: {} as Record<string, string[]>,
  });
  setValidationContext(validationCtx);

  let changeCtx = $state({
    hasUnsavedChanges: false,
    hasInvalidChanges: false,
  });
  setChangeContext(changeCtx);

  let dataCtx = $state({
    assets: [] as Record<string, any>[],
    baseAssets: [] as Record<string, any>[],
    filteredAssetsCount: 0,
    user: null as import('$lib/types').SafeUser | null,
  });
  setDataContext(dataCtx);

  let viewCtx = $state({
    activeView: 'default',
    virtualScroll: createVirtualScroll(),
    scrollToRow: null as number | null,
  });
  setViewContext(viewCtx);

  let uiCtx = $state({
    filterPanel: new FilterPanelState(),
    headerMenu: createHeaderMenu(),
    contextMenu: new ContextMenuState(),
    handleFilterSelect: null as ((item: string, key: string) => void) | null,
    applySort: null as ((key: string, dir: 'asc' | 'desc') => void) | null,
  });
  setUiContext(uiCtx);

  // ─── Controller instance contexts ──────────────────────────────────────────
  // Created here (common ancestor) so both GridOverlays and EventListener
  // share the SAME instances. Must run after validationCtx and changeCtx are set
  // because createChangeController() reads them via getValidationContext/getChangeContext.
  const changeController = createChangeController();
  const historyController = createHistoryController();
  setChangeControllerContext(changeController);
  setHistoryControllerContext(historyController);
</script>

{@render children()}
