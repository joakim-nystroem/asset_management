<script lang="ts">
  import { untrack } from 'svelte';
  import { getEditingContext, getPendingContext, getHistoryContext, getSelectionContext, getClipboardContext, getColumnWidthContext, resetEditing, type HistoryAction } from '$lib/context/gridContext.svelte.ts';
  import { enqueue } from '$lib/grid/eventQueue/eventQueue';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import { DEFAULT_ROW_HEIGHT } from '$lib/grid/gridConfig';
  import { presenceStore } from '$lib/data/presenceStore.svelte';
  import { toastState } from '$lib/toast/toastState.svelte';

  let { scrollTop }: { scrollTop: number } = $props();

  import EditDropdownComponent from '$lib/grid/components/edit-dropdown/editDropdown.svelte';
  import AutocompleteComponent from '$lib/grid/components/suggestion-menu/autocomplete.svelte';
  import { createEditDropdown } from '$lib/grid/components/edit-dropdown/editDropdown.svelte.ts';
  import { createAutocomplete } from '$lib/grid/components/suggestion-menu/autocomplete.svelte.ts';
  import { computeEditorPosition } from './editHandler.svelte.ts';
  import { DEFAULT_WIDTH } from '$lib/grid/gridConfig';

  const editingCtx = getEditingContext();
  const pendingCtx = getPendingContext();
  const historyCtx = getHistoryContext();
  const selCtx = getSelectionContext();
  const clipCtx = getClipboardContext();
  const colWidthCtx = getColumnWidthContext();
  const assets = $derived(assetStore.filteredAssets);
  const keys = $derived(Object.keys(assets[0] ?? {}));

  // Derive edit properties — editRow is asset ID, editCol is column key string
  const editKey = $derived(editingCtx.editCol !== '' ? editingCtx.editCol : null);
  const editAsset = $derived(
    editingCtx.editRow >= 0 ? assets.find((a: Record<string, any>) => a.id === editingCtx.editRow) : null
  );
  const editOriginalValue = $derived(
    editAsset && editKey ? String(editAsset[editKey] ?? '') : ''
  );

  // --- Local state (owned by EditHandler, not in context) ---
  let textareaRef: HTMLTextAreaElement | null = $state(null);
  let inputValue = $state('');
  const editDropdown = createEditDropdown();
  const autocomplete = createAutocomplete();

  // Column edit modes: 'dropdown' = fixed list, 'unique' = autocomplete from unique column values
  const columnEditMode: Record<string, { type: 'dropdown'; options: () => string[]; required: boolean } | { type: 'unique' }> = {
    location: { type: 'dropdown', options: () => assetStore.locations.map((l: any) => l.location_name), required: true },
    status: { type: 'dropdown', options: () => assetStore.statuses.map((s: any) => s.status_name), required: true },
    condition: { type: 'dropdown', options: () => assetStore.conditions.map((c: any) => c.condition_name), required: true },
    department: { type: 'dropdown', options: () => assetStore.departments.map((d: any) => d.department_name), required: true },
    wbd_tag: { type: 'unique' },
    serial_number: { type: 'unique' },
  };

  const validationErrors = {
    required: 'Value is required',
    invalidOption: 'Invalid value',
    duplicate: 'Must be unique',
  };

  const isDropdownColumn = $derived(editKey ? columnEditMode[editKey]?.type === 'dropdown' : false);

  // Compute absolute position within GridOverlays
  const editorStyle = $derived.by(() => {
    if (!editingCtx.isEditing || !editKey || editingCtx.editRow < 0 || editingCtx.editCol === '') {
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

  // --- Validation ---
  function validateCell(assetId: number, colKey: string, value: string): { isValid: boolean; error: string | null } {
    const mode = columnEditMode[colKey];
    if (!mode) return { isValid: true, error: null };

    if (mode.type === 'dropdown') {
      if (!value && !mode.required) return { isValid: true, error: null };
      if (!value && mode.required) return { isValid: false, error: validationErrors.required };
      const valid = mode.options().includes(value);
      return { isValid: valid, error: valid ? null : validationErrors.invalidOption };
    }

    if (mode.type === 'unique') {
      if (!value) return { isValid: false, error: validationErrors.required };
      // Check against all base assets (excluding this asset) and pending edits
      const isDuplicateInAssets = assetStore.baseAssets.some(
        (a: Record<string, any>) => a.id !== assetId && String(a[colKey] ?? '') === value
      );
      if (isDuplicateInAssets) {
        // Check if the duplicate has a pending edit changing it away from this value
        const duplicateAsset = assetStore.baseAssets.find(
          (a: Record<string, any>) => a.id !== assetId && String(a[colKey] ?? '') === value
        );
        if (duplicateAsset) {
          const pendingForDuplicate = pendingCtx.edits.find(
            (e) => e.row === duplicateAsset.id && e.col === colKey
          );
          if (!pendingForDuplicate || pendingForDuplicate.value === value) return { isValid: false, error: validationErrors.duplicate };
        }
      }
      // Check against other pending edits for the same column
      const isDuplicateInPending = pendingCtx.edits.some(
        (e) => e.row !== assetId && e.col === colKey && e.value === value
      );
      if (isDuplicateInPending) return { isValid: false, error: validationErrors.duplicate };
      return { isValid: true, error: null };
    }

    return { isValid: true, error: null };
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
      const { isValid, error } = validateCell(assetId, colKey, newValue);
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
      handlePaste();
      editingCtx.isPasting = false;
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
          const { isValid, error } = validateCell(asset.id, key, newValue);
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
    selCtx.hideSelection = false;
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
      upsertPending(action.id as number, action.key, action.oldValue);
    }
    historyCtx.redoStack = [...historyCtx.redoStack, batch];
  }

  function handleRedo() {
    if (historyCtx.redoStack.length === 0) return;
    const batch = historyCtx.redoStack[historyCtx.redoStack.length - 1];
    historyCtx.redoStack = historyCtx.redoStack.slice(0, -1);
    for (const action of batch) {
      upsertPending(action.id as number, action.key, action.newValue);
    }
    historyCtx.undoStack = [...historyCtx.undoStack, batch];
  }

  // Seed inputValue when editing starts (normal edit, not paste)
  // If cell already has a pending edit, use the pending value (not the optimistic asset value)
  $effect(() => {
    if (editingCtx.isEditing) {
      const pending = pendingCtx.edits.find(
        (e) => e.row === editingCtx.editRow && e.col === editKey
      );
      inputValue = pending ? pending.value : editOriginalValue;

      // Show dropdown for constrained columns
      const mode = editKey ? columnEditMode[editKey] : undefined;
      if (mode?.type === 'dropdown') {
        untrack(() => editDropdown.show(mode.options(), inputValue));
      }
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
    inputValue = '';
    autocomplete.clear();
    editDropdown.hide();
  }

  function saveEdit() {
    if (!editKey || editingCtx.editRow < 0) { cancelEdit(); return; }
    const oldValue = cellValue(editingCtx.editRow, editKey);
    const newValue = inputValue.trim();
    if (oldValue !== newValue) {
      historyCtx.undoStack = [...historyCtx.undoStack, [{ id: editingCtx.editRow, key: editKey, oldValue, newValue }]];
      historyCtx.redoStack = [];
      selCtx.hideSelection = true;
    }
    upsertPending(editingCtx.editRow, editKey, newValue);
    cancelEdit();
  }

  function handleKeydown(e: KeyboardEvent) {
    // Handle autocomplete navigation if visible
    if (autocomplete.isVisible) {
      if (e.key === 'ArrowDown') { e.preventDefault(); autocomplete.selectNext(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); autocomplete.selectPrevious(); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        const v = autocomplete.getSelectedValue();
        if (v) inputValue = v;
        autocomplete.clear();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const v = autocomplete.getSelectedValue();
        if (v !== null) inputValue = v;
        autocomplete.clear();
        saveEdit();
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); autocomplete.clear(); cancelEdit(); return; }
    }

    // Handle dropdown navigation if visible
    if (editDropdown.isVisible) {
      if (e.key === 'ArrowDown') { e.preventDefault(); editDropdown.selectNext(); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); editDropdown.selectPrevious(); return; }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const v = editDropdown.getSelectedValue();
        if (v !== null) inputValue = v;
        editDropdown.hide();
        saveEdit();
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); editDropdown.hide(); cancelEdit(); return; }
    }

    // Normal keyboard handling
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    inputValue = target.value;
    // Update suggestions only for columns without a specific edit mode
    const mode = editKey ? columnEditMode[editKey] : undefined;
    if (!mode && !editDropdown.isVisible) {
      autocomplete.updateSuggestions(assets, editKey ?? '', inputValue);
    }
  }

  function handleBlur() {
    autocomplete.clear();
    saveEdit();
  }
</script>

{#if editingCtx.isEditing}
  <div class="absolute z-[100]" style={editorStyle}>
    <div class="relative w-full h-full">
      <textarea
        bind:this={textareaRef}
        bind:value={inputValue}
        oninput={handleInput}
        onkeydown={handleKeydown}
        onmousedown={(e) => e.stopPropagation()}
        onblur={handleBlur}
        readonly={isDropdownColumn}
        class="w-full h-full resize-none bg-white dark:bg-slate-700 text-neutral-900 dark:text-neutral-100 text-xs border-2 border-blue-500 rounded px-1.5 py-1.5 focus:outline-none {isDropdownColumn ? 'cursor-default caret-transparent' : ''}"
        style="overflow: hidden;"
      ></textarea>
      <EditDropdownComponent
        dropdown={editDropdown}
        onSelect={(value) => {
          inputValue = value;
          editDropdown.hide();
          saveEdit();
        }}
      />
      <AutocompleteComponent
        {autocomplete}
        onSelect={(value) => {
          inputValue = value;
          autocomplete.clear();
          saveEdit();
        }}
      />
    </div>
  </div>
{/if}
