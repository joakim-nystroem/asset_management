<script lang="ts">
  import type { Snippet } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';

  import {
    type PendingContext,
    type HistoryAction,
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
    isUndoing: false,
    isRedoing: false,
    editRow: -1,
    editCol: '',
  });
  setEditingContext(editingCtx);

  let pendingCtx = $state({
    edits: [] as PendingContext['edits'],
  });
  setPendingContext(pendingCtx);

  let historyCtx = $state({
    undoStack: [] as HistoryAction[][],
    redoStack: [] as HistoryAction[][],
  });
  setHistoryContext(historyCtx);

  let newRowCtx = $state({
    newRows: [],
    hasNewRows: false,
    isValid: true,
  });
  setNewRowContext(newRowCtx);

  let selectionCtx = $state({
    selectionStart: { row: -1, col: '' },
    selectionEnd: { row: -1, col: '' },
    isSelecting: false,
    hideSelection: false,
  });
  setSelectionContext(selectionCtx);

  let clipboardCtx = $state({
    copyStart: { row: -1, col: '' },
    copyEnd: { row: -1, col: '' },
    isCopying: false,
    grid: [] as string[][],
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
    scrollTop: 0,
    scrollLeft: 0,
  });
  setViewContext(viewCtx);

  let uiCtx = $state({
    filterPanel: { visible: false },
    headerMenu: { visible: false, activeKey: '' },
    contextMenu: { visible: false, x: 0, y: 0, row: -1, col: '', value: '' },
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
