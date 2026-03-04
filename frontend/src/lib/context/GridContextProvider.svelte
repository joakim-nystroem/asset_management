<script lang="ts">
  import type { Snippet } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';

  import {
    type PendingContext,
    setEditingContext,
    setPendingContext,
    setHistoryContext,
    setNewRowContext,
    setSelectionContext,
    setClipboardContext,
    setRowContext,
    setViewContext,
    setUiContext,
    setQueryContext,
    setColumnWidthContext,
    setSortContext,
  } from '$lib/context/gridContext.svelte.ts';

  import { createVirtualScroll } from '$lib/grid/utils/virtualScrollManager.svelte';

  let { children }: { children: Snippet } = $props();

  // ─── Domain context initialization ────────────────────────────────────────────

  let editingCtx = $state({
    isEditing: false,
    isPasting: false,
    editRow: -1,
    editCol: -1,
  });
  setEditingContext(editingCtx);

  let pendingCtx = $state({
    edits: [] as PendingContext['edits'],
  });
  setPendingContext(pendingCtx);

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
    hideSelection: false,
    dirtyCells: new Set<string>(),
  });
  setSelectionContext(selectionCtx);

  let clipboardCtx = $state({
    copyStart: { row: -1, col: -1 },
    copyEnd: { row: -1, col: -1 },
    isCopying: false,
  });
  setClipboardContext(clipboardCtx);

  let rowCtx = $state({
    rowHeights: new SvelteMap<number, number>(),
  });
  setRowContext(rowCtx);

  let viewCtx = $state({
    virtualScroll: createVirtualScroll(),
    scrollToRow: null as number | null,
    scrollToCol: null as { left: number; right: number } | null,
  });
  setViewContext(viewCtx);

  let uiCtx = $state({
    filterPanel: { visible: false },
    headerMenu: { visible: false, activeKey: '' },
    contextMenu: { visible: false },
    commitRequested: false,
    commitCreateRequested: false,
    discardRequested: false,
  });
  setUiContext(uiCtx);

  let colWidthCtx = $state({
    widths: new SvelteMap<string, number>(),
  });
  setColumnWidthContext(colWidthCtx);

  let sortCtx = $state({
    key: null as string | null,
    direction: 'asc' as 'asc' | 'desc',
  });
  setSortContext(sortCtx);

  let queryCtx = $state({
    view: 'default',
    q: '',
    filters: [] as { key: string; value: string }[],
  });
  setQueryContext(queryCtx);
</script>

{@render children()}
