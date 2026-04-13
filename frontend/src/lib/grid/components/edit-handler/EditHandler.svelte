<script lang="ts">
  import { untrack } from 'svelte';
  import { editingStore, pendingStore, historyStore, selectionStore, clipboardStore, type HistoryAction } from '$lib/data/cellStore.svelte';
  import { resetEditing } from '$lib/utils/gridHelpers';
  import { newRowStore } from '$lib/data/newRowStore.svelte';
  import { columnWidthStore, uiStore } from '$lib/data/uiStore.svelte';
  import { enqueue } from '$lib/eventQueue/eventQueue';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import { validateCell } from '$lib/grid/validation';
  import { isConstrained, isValidOption, getOptionsForColumn } from '$lib/grid/components/suggestion-menu/suggestionMenu.svelte.ts';
  import { DEFAULT_ROW_HEIGHT } from '$lib/grid/gridConfig';
  import { presenceStore } from '$lib/data/presenceStore.svelte';
  import { scrollStore } from '$lib/data/scrollStore.svelte';
  import { toastState } from '$lib/toast/toastState.svelte';

  import SuggestionMenu from '$lib/grid/components/suggestion-menu/suggestionMenu.svelte';
  import { computeEditorPosition } from './editHandler.svelte.ts';
  import { DEFAULT_WIDTH } from '$lib/grid/gridConfig';

  const assets = $derived(assetStore.displayedAssets);
  const keys = $derived(Object.keys(assets[0] ?? {}));

  // Derive edit properties — editRow is asset ID, editCol is column key string
  const editKey = $derived(editingStore.editCol !== '' ? editingStore.editCol : null);

  // Compute absolute position within GridOverlays
  const editorStyle = $derived.by(() => {
    if (!editingStore.isEditing || !editKey || editingStore.editRow === -1 || editingStore.editCol === '') {
      return 'display: none;';
    }
    const pos = computeEditorPosition(
      editingStore.editRow,
      editingStore.editCol,
      columnWidthStore.widths,
      keys,
      assets,
    );
    if (!pos) return 'display: none;';
    return `top: ${pos.top - scrollStore.scrollTop}px; left: ${pos.left}px; width: ${pos.width}px; height: ${pos.height}px;`;
  });

  // --- Shared helper: resolve the visible value for a cell (pending or asset) ---
  function cellValue(assetId: number, colKey: string): string {
    const pending = pendingStore.edits.find((e) => e.row === assetId && e.col === colKey);
    if (pending) return pending.value;
    const asset = assets.find((a: Record<string, any>) => a.id === assetId);
    return asset ? String(asset[colKey] ?? '') : '';
  }

  // --- Shared helper: upsert a single cell into pendingStore ---
  function upsertPending(assetId: number, colKey: string, newValue: string) {
    const asset = assets.find((a: Record<string, any>) => a.id === assetId);
    if (!asset) return;
    const existing = pendingStore.edits.find((e) => e.row === assetId && e.col === colKey);
    const baseline = existing ? existing.original : String(asset[colKey] ?? '');

    // Remove existing entry
    pendingStore.edits = pendingStore.edits.filter((e) => !(e.row === assetId && e.col === colKey));

    // If changed from baseline, track it and notify server
    if (newValue !== baseline) {
      const { isValid, error } = validateCell(assetId, colKey, newValue, pendingStore.edits);
      pendingStore.edits.push({ row: assetId, col: colKey, original: baseline, value: newValue, isValid, validationError: error });
      enqueue({ type: 'CELL_PENDING', payload: { assetId, key: colKey, value: newValue } });
    } else {
      // Reverted to baseline — clear pending on server
      enqueue({ type: 'CELL_PENDING_CLEAR', payload: { assetId, key: colKey } });
    }
  }

  // --- Copy: build mini-grid from selection, store in clipboardStore + system clipboard ---
  $effect(() => {
    if (clipboardStore.isCopying) {
      untrack(() => {
        handleCopy();
        clipboardStore.isCopying = false;
      });
    }
  });

  function handleCopy() {
    selectionStore.pasteRange = null;
    // Find asset position by ID
    const startIdx = assets.findIndex((a: Record<string, any>) => a.id === selectionStore.selectionStart.row);
    // Find asset position by ID
    const endIdx = assets.findIndex((a: Record<string, any>) => a.id === selectionStore.selectionEnd.row);
    const startColIdx = keys.indexOf(selectionStore.selectionStart.col);
    const endColIdx = keys.indexOf(selectionStore.selectionEnd.col);
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

    clipboardStore.grid = grid;
    clipboardStore.copyStart = { ...selectionStore.selectionStart };
    clipboardStore.copyEnd = { ...selectionStore.selectionEnd };
    selectionStore.hideSelection = true;

    const text = grid.map((row) => row.join('\t')).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  }

  // --- Paste: triggered by isPasting flag, uses internal clipboardStore.grid ---
  $effect(() => {
    if (editingStore.isPasting) {
      untrack(() => editingStore.isPasting = false);
      if (newRowStore.newRows.length > 0 && selectionStore.selectionStart.row > 0) {
        toastState.addToast('Commit or discard new rows before editing.', 'warning');
        return;
      }
      handlePaste();
    }
  });

  function handlePaste() {
    if (selectionStore.selectionStart.row === -1) return;
    if (clipboardStore.grid.length === 0 || clipboardStore.grid[0].length === 0) return;

    const clipHeight = clipboardStore.grid.length;
    const clipWidth = clipboardStore.grid[0].length;

    // Find asset position by ID
    const startRow = assets.findIndex((a: Record<string, any>) => a.id === selectionStore.selectionStart.row);
    // Find asset position by ID
    const endRow = assets.findIndex((a: Record<string, any>) => a.id === selectionStore.selectionEnd.row);
    const startCol = keys.indexOf(selectionStore.selectionStart.col);
    const endCol = keys.indexOf(selectionStore.selectionEnd.col);
    if (startCol === -1 || endCol === -1) return;
    const minStartRow = Math.min(startRow, endRow);
    const minStartCol = Math.min(startCol, endCol);
    const selHeight = Math.abs(endRow - startRow) + 1;
    const selWidth = Math.abs(endCol - startCol) + 1;

    const canTile = selHeight % clipHeight === 0 && selWidth % clipWidth === 0;
    const maxRow = Math.min(canTile ? selHeight : clipHeight, assets.length - minStartRow);
    const maxCol = Math.min(canTile ? selWidth : clipWidth, keys.length - minStartCol);

    const pastedKeys = new Set<string>();
    const newEdits: typeof pendingStore.edits = [];
    const historyBatch: HistoryAction[] = [];

    for (let r = 0; r < maxRow; r++) {
      const asset = assets[minStartRow + r];
      const clipRow = clipboardStore.grid[r % clipHeight];

      for (let c = 0; c < maxCol; c++) {
        const key = keys[minStartCol + c];
        if (key === 'id') continue;

        const newValue = clipRow[c % clipWidth];
        const oldValue = cellValue(asset.id, key);
        const original = String(asset[key] ?? '');
        pastedKeys.add(`${asset.id}:${key}`);

        if (newValue !== original) {
          // Changed from baseline — track as pending
          const { isValid, error } = validateCell(asset.id, key, newValue, pendingStore.edits);
          newEdits.push({ row: asset.id, col: key, original, value: newValue, isValid, validationError: error });
          enqueue({ type: 'CELL_PENDING', payload: { assetId: asset.id, key, value: newValue } });
        } else {
          // Same as baseline — clear any server-side pending state
          enqueue({ type: 'CELL_PENDING_CLEAR', payload: { assetId: asset.id, key } });
        }

        if (oldValue !== newValue) {
          historyBatch.push({ id: asset.id, key, oldValue, newValue });
        }
      }
    }

    // Remove all prior pending in paste range, re-add only changed cells
    pendingStore.edits = [
      ...pendingStore.edits.filter((e) => !pastedKeys.has(`${e.row}:${e.col}`)),
      ...newEdits,
    ];

    if (historyBatch.length > 0) {
      historyStore.undoStack = [...historyStore.undoStack, historyBatch];
      historyStore.redoStack = [];
    }

    // Update selection to cover paste range
    const pasteStartId = assets[minStartRow].id;
    const pasteEndId = assets[minStartRow + maxRow - 1].id;
    const pasteStartCol = keys[minStartCol];
    const pasteEndCol = keys[minStartCol + maxCol - 1];
    selectionStore.selectionStart = { row: pasteStartId, col: pasteStartCol };
    selectionStore.selectionEnd = { row: pasteEndId, col: pasteEndCol };
    selectionStore.hideSelection = true;
    selectionStore.pasteRange = { start: { row: pasteStartId, col: pasteStartCol }, end: { row: pasteEndId, col: pasteEndCol } };
  }

  // --- Undo/Redo ---
  $effect(() => {
    if (editingStore.isUndoing) {
      untrack(() => {
        handleUndo();
        editingStore.isUndoing = false;
      });
    }
  });

  $effect(() => {
    if (editingStore.isRedoing) {
      untrack(() => {
        handleRedo();
        editingStore.isRedoing = false;
      });
    }
  });

  function handleUndo() {
    if (historyStore.undoStack.length === 0) return;
    const batch = historyStore.undoStack[historyStore.undoStack.length - 1];
    historyStore.undoStack = historyStore.undoStack.slice(0, -1);
    for (const action of batch) {
      upsertPending(action.id, action.key, action.oldValue);
    }
    historyStore.redoStack = [...historyStore.redoStack, batch];
  }

  function handleRedo() {
    if (historyStore.redoStack.length === 0) return;
    const batch = historyStore.redoStack[historyStore.redoStack.length - 1];
    historyStore.redoStack = historyStore.redoStack.slice(0, -1);
    for (const action of batch) {
      upsertPending(action.id, action.key, action.newValue);
    }
    historyStore.undoStack = [...historyStore.undoStack, batch];
  }

  // Show suggestion menu when editing starts (pre so it mounts in same render pass as textarea)
  $effect.pre(() => {
    if (editingStore.isEditing) {
      uiStore.suggestionMenu.visible = true;
    }
  });

  // Reactive lock rejection — if another user locks our editing cell, cancel
  $effect(() => {
    if (!editingStore.isEditing) return;
    const lock = presenceStore.users.find(
      u => u.row === editingStore.editRow && u.col === editingStore.editCol && u.isLocked
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
    resetEditing();
    enqueue({ type: 'CELL_EDIT_END', payload: {} });
    uiStore.suggestionMenu.visible = false;
  }

  function saveEdit() {
    if (!editKey || editingStore.editRow === -1) { cancelEdit(); return; }
    const newValue = editingStore.editValue.trim();
    // Constrained columns: reject invalid values, keep editor open
    if (isConstrained(editKey) && !isValidOption(editKey, newValue)) {
      toastState.addToast('Select a valid option', 'warning');
      return;
    }
    const oldValue = cellValue(editingStore.editRow, editKey);
    if (oldValue !== newValue) {
      historyStore.undoStack = [...historyStore.undoStack, [{ id: editingStore.editRow, key: editKey, oldValue, newValue }]];
      historyStore.redoStack = [];
      selectionStore.hideSelection = true;
    }
    upsertPending(editingStore.editRow, editKey, newValue);
    cancelEdit();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Tab') { e.preventDefault(); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    editingStore.editValue = target.value;
  }

  function handleBlur() {
    if (!editingStore.isEditing) return;
    if (editKey && isConstrained(editKey)) {
      if (isValidOption(editKey, editingStore.editValue.trim())) {
        saveEdit();
      } else {
        cancelEdit();
      }
      return;
    }
    saveEdit();
  }
</script>

{#if editingStore.isEditing}
  <div class="absolute z-70" style={editorStyle}>
    <div class="relative w-full h-full">
      <textarea
        {@attach (node: HTMLTextAreaElement) => { node.focus(); node.select(); }}
        bind:value={editingStore.editValue}
        oninput={handleInput}
        onkeydown={handleKeydown}
        onmousedown={(e) => e.stopPropagation()}
        onblur={handleBlur}
        class="w-full h-full resize-none bg-bg-elevated text-text-primary text-xs border-2 border-blue-500 rounded px-1.5 py-1.5 focus:outline-none overflow-hidden"
      ></textarea>
      {#if uiStore.suggestionMenu.visible}
        <SuggestionMenu options={getOptionsForColumn(editingStore.editCol)} constrained={isConstrained(editingStore.editCol)} />
      {/if}
    </div>
  </div>
{/if}
