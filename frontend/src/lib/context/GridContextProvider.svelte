<script lang="ts">
  import type { Snippet } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';

  import {
    setEditingContext,
    setEditContext,
    setHistoryContext,
    setNewRowContext,
    setSelectionContext,
    setClipboardContext,
    setColumnContext,
    setRowContext,
    setViewContext,
    setUiContext,
  } from '$lib/context/gridContext.svelte.ts';

  import { ContextMenuState } from '$lib/grid/components/context-menu/contextMenu.svelte.ts';
  import { createHeaderMenu } from '$lib/grid/components/header-menu/headerMenu.svelte.ts';
  import { createEditDropdown } from '$lib/grid/components/edit-dropdown/editDropdown.svelte.ts';
  import { createAutocomplete } from '$lib/grid/components/suggestion-menu/autocomplete.svelte.ts';
  import { createVirtualScroll } from '$lib/grid/utils/virtualScrollManager.svelte';
  import { FilterPanelState } from '$lib/grid/components/filter-panel/filterPanel.svelte.ts';

  let { children }: { children: Snippet } = $props();

  // ─── Domain context initialization ────────────────────────────────────────────

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

  let editCtx = $state({
    edits: [],
    hasUnsavedChanges: false,
    isValid: true,
  });
  setEditContext(editCtx);

  let historyCtx = $state({
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,
  });
  setHistoryContext(historyCtx);

  let newRowCtx = $state({
    newRows: [],
    hasNewRows: false,
    isValid: true,
  });
  setNewRowContext(newRowCtx);

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
    commitRequested: false,
    commitCreateRequested: false,
    discardRequested: false,
    searchRequested: false,
  });
  setUiContext(uiCtx);
</script>

{@render children()}