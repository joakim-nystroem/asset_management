<script lang="ts">
  import { untrack } from 'svelte';
  import { getEditingContext, getPendingContext, getHistoryContext, getNewRowContext, getSelectionContext, getClipboardContext, getColumnWidthContext, getUiContext, resetEditing, type HistoryAction } from '$lib/context/gridContext.svelte.ts';
  import { enqueue } from '$lib/grid/eventQueue/eventQueue';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import { validateCell } from '$lib/grid/validation';
  import { isConstrained, isValidOption } from '$lib/grid/components/suggestion-menu/suggestionMenu.svelte.ts';
  import { DEFAULT_ROW_HEIGHT } from '$lib/grid/gridConfig';
  import { presenceStore } from '$lib/data/presenceStore.svelte';
  import { toastState } from '$lib/toast/toastState.svelte';

  let { scrollTop }: { scrollTop: number } = $props();

  import SuggestionMenu from '$lib/grid/components/suggestion-menu/suggestionMenu.svelte';
  import { computeEditorPosition } from './editHandler.svelte.ts';
  import { DEFAULT_WIDTH } from '$lib/grid/gridConfig';

  const editingCtx = getEditingContext();
  const pendingCtx = getPendingContext();
  const historyCtx = getHistoryContext();
  const selCtx = getSelectionContext();
  const clipCtx = getClipboardContext();
  const colWidthCtx = getColumnWidthContext();
  const uiCtx = getUiContext();
  const newRowCtx = getNewRowContext();
  const assets = $derived(assetStore.displayedAssets);
  const keys = $derived(Object.keys(assets[0] ?? {}));

  // Derive edit properties — editRow is asset ID, editCol is column key string
  const editKey = $derived(editingCtx.editCol !== '' ? editingCtx.editCol : null);
  const editAsset = $derived(
    editingCtx.editRow !== -1 ? assets.find((a: Record<string, any>) => a.id === editingCtx.editRow) : null
  );
  const editOriginalValue = $derived(
    editAsset && editKey ? String(editAsset[editKey] ?? '') : ''
  );

  // --- Local state (owned by EditHandler, not in context) ---
  let textareaRef: HTMLTextAreaElement | null = $state(null);

  // Compute absolute position within GridOverlays
  const editorStyle = $derived.by(() => {
    if (!editingCtx.isEditing || !editKey || editingCtx.editRow === -1 || editingCtx.editCol === '') {
      return 'display: none;';
    }
    const pos = computeEditorPosition(
      editingCtx.editRow,
      editingCtx.editCol,
      colWidthCtx.widths,
      keys,
      assets,
    );
    if (!pos) return 'display: none;';
    return `top: ${pos.top - scrollTop}px; left: ${pos.left}px; width: ${pos.width}px; height: ${pos.height}px;`;
  });

  // --- Shared helper: resolve the visible value for a cell (pending or asset) ---
  function cellValue(assetId: number, colKey: string): string {
    const pending = pendingCtx.edits.find((e) => e.row === assetId && e.col === colKey);
    if (pending) return pending.value;
    const asset = assets.find((a: Record<string, any>) => a.id === assetId);
    return asset ? String(asset[colKey] ?? '') : '';
  }

  // --- Shared helper: upsert a single cell into pendingCtx ---
  function upsertPending(assetId: number, colKey: string, newValue: string) {
    const asset = assets.find((a: Record<string, any>) => a.id === assetId);
    if (!asset) return;
    const existing = pendingCtx.edits.find((e) => e.row === assetId && e.col === colKey);
    const baseline = existing ? existing.original : String(asset[colKey] ?? '');

    // Remove existing entry
    pendingCtx.edits = pendingCtx.edits.filter((e) => !(e.row === assetId && e.col === colKey));

    // If changed from baseline, track it and notify server
    if (newValue !== baseline) {
      const { isValid, error } = validateCell(assetId, colKey, newValue, pendingCtx.edits);
      pendingCtx.edits.push({ row: assetId, col: colKey, original: baseline, value: newValue, isValid, validationError: error });
      enqueue({ type: 'CELL_PENDING', payload: { assetId, key: colKey, value: newValue } }, {});
    } else {
      // Reverted to baseline — clear pending on server
      enqueue({ type: 'CELL_PENDING_CLEAR', payload: { assetId, key: colKey } }, {});
    }
  }

  // --- Asset ID → array index ---
  function assetIndex(id: number): number {
    const idx = assets.findIndex((a: Record<string, any>) => a.id === id);
    if (idx === -1) throw new Error(`Asset ${id} not found in filtered list — selection invariant violated`);
    return idx;
  }

  // --- Copy: build mini-grid from selection, store in clipCtx + system clipboard ---
  $effect(() => {
    if (clipCtx.isCopying) {
      handleCopy();
      clipCtx.isCopying = false;
    }
  });

  function handleCopy() {
    const startIdx = assetIndex(selCtx.selectionStart.row);
    const endIdx = assetIndex(selCtx.selectionEnd.row);
    const startColIdx = keys.indexOf(selCtx.selectionStart.col);
    const endColIdx = keys.indexOf(selCtx.selectionEnd.col);
    if (startColIdx === -1 || endColIdx === -1) return;
    const minRow = Math.min(startIdx, endIdx);
    const maxRow = Math.max(startIdx, endIdx);
    const minCol = Math.min(startColIdx, endColIdx);
    const maxCol = Math.max(startColIdx, endColIdx);
    const colKeys = keys.slice(minCol, maxCol + 1);

    // Build mini-grid (top-left = [0][0])
    const grid: string[][] = [];
    for (let r = minRow; r <= maxRow; r++) {
      const asset = assets[r];
      grid.push(colKeys.map((key) => cellValue(asset.id, key)));
    }

    clipCtx.grid = grid;
    clipCtx.copyStart = { ...selCtx.selectionStart };
    clipCtx.copyEnd = { ...selCtx.selectionEnd };
    selCtx.hideSelection = true;

    const text = grid.map((row) => row.join('\t')).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  }

  // --- Paste: triggered by isPasting flag, uses internal clipCtx.grid ---
  $effect(() => {
    if (editingCtx.isPasting) {
      untrack(() => editingCtx.isPasting = false);
      if (newRowCtx.hasNewRows && selCtx.selectionStart.row > 0) {
        toastState.addToast('Commit or discard new rows before editing.', 'warning');
        return;
      }
      handlePaste();
    }
  });

  function handlePaste() {
    if (selCtx.selectionStart.row === -1) return;
    if (clipCtx.grid.length === 0 || clipCtx.grid[0].length === 0) return;

    const clipHeight = clipCtx.grid.length;
    const clipWidth = clipCtx.grid[0].length;

    const startRow = assetIndex(selCtx.selectionStart.row);
    const endRow = assetIndex(selCtx.selectionEnd.row);
    const startCol = keys.indexOf(selCtx.selectionStart.col);
    const endCol = keys.indexOf(selCtx.selectionEnd.col);
    if (startCol === -1 || endCol === -1) return;
    const minStartRow = Math.min(startRow, endRow);
    const minStartCol = Math.min(startCol, endCol);
    const selHeight = Math.abs(endRow - startRow) + 1;
    const selWidth = Math.abs(endCol - startCol) + 1;

    const canTile = selHeight % clipHeight === 0 && selWidth % clipWidth === 0;
    const maxRow = Math.min(canTile ? selHeight : clipHeight, assets.length - minStartRow);
    const maxCol = Math.min(canTile ? selWidth : clipWidth, keys.length - minStartCol);

    const pastedKeys = new Set<string>();
    const newEdits: typeof pendingCtx.edits = [];
    const historyBatch: HistoryAction[] = [];

    for (let r = 0; r < maxRow; r++) {
      const asset = assets[minStartRow + r];
      const clipRow = clipCtx.grid[r % clipHeight];

      for (let c = 0; c < maxCol; c++) {
        const key = keys[minStartCol + c];
        if (key === 'id') continue;

        const newValue = clipRow[c % clipWidth];
        const oldValue = cellValue(asset.id, key);
        const original = String(asset[key] ?? '');
        pastedKeys.add(`${asset.id}:${key}`);

        if (newValue !== original) {
          // Changed from baseline — track as pending
          const { isValid, error } = validateCell(asset.id, key, newValue, pendingCtx.edits);
          newEdits.push({ row: asset.id, col: key, original, value: newValue, isValid, validationError: error });
          enqueue({ type: 'CELL_PENDING', payload: { assetId: asset.id, key, value: newValue } }, {});
        } else {
          // Same as baseline — clear any server-side pending state
          enqueue({ type: 'CELL_PENDING_CLEAR', payload: { assetId: asset.id, key } }, {});
        }

        if (oldValue !== newValue) {
          historyBatch.push({ id: asset.id, key, oldValue, newValue });
        }
      }
    }

    // Remove all prior pending in paste range, re-add only changed cells
    pendingCtx.edits = [
      ...pendingCtx.edits.filter((e) => !pastedKeys.has(`${e.row}:${e.col}`)),
      ...newEdits,
    ];

    if (historyBatch.length > 0) {
      historyCtx.undoStack = [...historyCtx.undoStack, historyBatch];
      historyCtx.redoStack = [];
    }

    // Update selection to cover paste range
    const pasteStartId = assets[minStartRow].id;
    const pasteEndId = assets[minStartRow + maxRow - 1].id;
    const pasteStartCol = keys[minStartCol];
    const pasteEndCol = keys[minStartCol + maxCol - 1];
    selCtx.selectionStart = { row: pasteStartId, col: pasteStartCol };
    selCtx.selectionEnd = { row: pasteEndId, col: pasteEndCol };
    selCtx.hideSelection = true;
    selCtx.pasteRange = { start: { row: pasteStartId, col: pasteStartCol }, end: { row: pasteEndId, col: pasteEndCol } };
  }

  // --- Undo/Redo ---
  $effect(() => {
    if (editingCtx.isUndoing) {
      handleUndo();
      editingCtx.isUndoing = false;
    }
  });

  $effect(() => {
    if (editingCtx.isRedoing) {
      handleRedo();
      editingCtx.isRedoing = false;
    }
  });

  function handleUndo() {
    if (historyCtx.undoStack.length === 0) return;
    const batch = historyCtx.undoStack[historyCtx.undoStack.length - 1];
    historyCtx.undoStack = historyCtx.undoStack.slice(0, -1);
    for (const action of batch) {
      upsertPending(action.id, action.key, action.oldValue);
    }
    historyCtx.redoStack = [...historyCtx.redoStack, batch];
  }

  function handleRedo() {
    if (historyCtx.redoStack.length === 0) return;
    const batch = historyCtx.redoStack[historyCtx.redoStack.length - 1];
    historyCtx.redoStack = historyCtx.redoStack.slice(0, -1);
    for (const action of batch) {
      upsertPending(action.id, action.key, action.newValue);
    }
    historyCtx.undoStack = [...historyCtx.undoStack, batch];
  }

  // Show suggestion menu when editing starts
  $effect(() => {
    if (editingCtx.isEditing) {
      uiCtx.suggestionMenu.visible = true;
    }
  });

  // Focus and select text when textarea mounts
  $effect(() => {
    if (textareaRef && editingCtx.isEditing) {
      textareaRef.focus();
      textareaRef.select();
    }
  });

  // Reactive lock rejection — if another user locks our editing cell, cancel
  $effect(() => {
    if (!editingCtx.isEditing) return;
    const lock = presenceStore.users.find(
      u => u.row === editingCtx.editRow && u.col === editingCtx.editCol && u.isLocked
    );
    if (lock) {
      cancelEdit();
      toastState.addToast(
        `Cell is being edited by ${lock.firstname} ${lock.lastname}`.trim(),
        'warning',
      );
    }
  });

  function cancelEdit() {
    resetEditing(editingCtx);
    enqueue({ type: 'CELL_EDIT_END', payload: {} }, {});
    uiCtx.suggestionMenu.visible = false;
  }

  function saveEdit() {
    if (!editKey || editingCtx.editRow === -1) { cancelEdit(); return; }
    const newValue = editingCtx.editValue.trim();
    // Constrained columns: reject invalid values, keep editor open
    if (isConstrained(editKey) && !isValidOption(editKey, newValue)) {
      toastState.addToast('Select a valid option', 'warning');
      return;
    }
    const oldValue = cellValue(editingCtx.editRow, editKey);
    if (oldValue !== newValue) {
      historyCtx.undoStack = [...historyCtx.undoStack, [{ id: editingCtx.editRow, key: editKey, oldValue, newValue }]];
      historyCtx.redoStack = [];
      selCtx.hideSelection = true;
    }
    upsertPending(editingCtx.editRow, editKey, newValue);
    cancelEdit();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    editingCtx.editValue = target.value;
  }

  function handleBlur() {
    if (editKey && isConstrained(editKey)) {
      if (isValidOption(editKey, editingCtx.editValue.trim())) {
        saveEdit();
      } else {
        cancelEdit();
      }
      return;
    }
    saveEdit();
  }
</script>

{#if editingCtx.isEditing}
  <div class="absolute z-[100]" style={editorStyle}>
    <div class="relative w-full h-full">
      <textarea
        bind:this={textareaRef}
        bind:value={editingCtx.editValue}
        oninput={handleInput}
        onkeydown={handleKeydown}
        onmousedown={(e) => e.stopPropagation()}
        onblur={handleBlur}
        class="w-full h-full resize-none bg-white dark:bg-slate-700 text-neutral-900 dark:text-neutral-100 text-xs border-2 border-blue-500 rounded px-1.5 py-1.5 focus:outline-none"
        style="overflow: hidden;"
      ></textarea>
      {#if uiCtx.suggestionMenu.visible}
        <SuggestionMenu />
      {/if}
    </div>
  </div>
{/if}
