<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';
  import { editingStore, pendingStore, historyStore, selectionStore } from '$lib/data/cellStore.svelte';
  import { resetEditing } from '$lib/utils/gridHelpers';
  import { columnWidthStore, uiStore } from '$lib/data/uiStore.svelte';
  import { enqueue } from '$lib/eventQueue/eventQueue';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import { validateCell, columnConstraints } from '$lib/grid/validation';
  import { isConstrained, isValidOption, getOptionsForColumn } from '$lib/grid/components/suggestion-menu/suggestionMenu.svelte.ts';
  import { gridPrefsStore } from '$lib/data/gridPrefsStore.svelte';
  import { presenceStore } from '$lib/data/presenceStore.svelte';
  import { scrollStore } from '$lib/data/scrollStore.svelte';
  import { toastState } from '$lib/toast/toastState.svelte';

  import SuggestionMenu from '$lib/grid/components/suggestion-menu/suggestionMenu.svelte';
  import { computeEditorPosition, computeEditorDimensions } from './editHandler.svelte.ts';
  import { doCopy, doPaste } from '$lib/utils/clipboard';
  import { DEFAULT_WIDTH } from '$lib/grid/gridConfig';

  const assets = $derived(assetStore.displayedAssets);
  const keys = $derived(Object.keys(assets[0] ?? {}));

  // Derive edit properties — editRow is asset ID, editCol is column key string
  const editKey = $derived(editingStore.editCol !== '' ? editingStore.editCol : null);

  // Max input length from DB schema constraints
  const maxLength = $derived.by(() => {
    if (!editKey) return undefined;
    const constraint = columnConstraints[editKey];
    if (constraint && 'maxChars' in constraint) return constraint.maxChars;
    return undefined;
  });

  // Track original column width to restore on edit end
  let originalColWidth = $state(0);
  // Tracks user-typed text only (suggestion-arrow previews don't update this).
  // Drives column width so cycling through long suggestions doesn't make the column jump.
  let typedValue = $state('');

  // Capture original column width and seed typedValue before other effects run
  $effect.pre(() => {
    if (editingStore.isEditing && editKey && originalColWidth === 0) {
      originalColWidth = columnWidthStore.widths.get(editKey) ?? DEFAULT_WIDTH;
      typedValue = editingStore.editValue;
    }
  });

  // Editor follows the live column width so manual drag-resize during edit propagates
  const editorDims = $derived.by(() => {
    if (!editingStore.isEditing || !editKey) return null;
    const colWidth = columnWidthStore.widths.get(editKey) ?? (originalColWidth || DEFAULT_WIDTH);
    return computeEditorDimensions(editingStore.editValue, colWidth);
  });

  // Expand column when typed text needs more room. Never shrink during edit —
  // drag-resize stays put, suggestion preview doesn't widen (typedValue, not editValue).
  // cancelEdit restores originalColWidth on close.
  $effect(() => {
    if (!editingStore.isEditing || !editKey) return;
    const current = columnWidthStore.widths.get(editKey) ?? (originalColWidth || DEFAULT_WIDTH);
    const desired = computeEditorDimensions(typedValue, current).width;
    if (desired > current) {
      columnWidthStore.widths.set(editKey, desired);
    }
  });

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
    const dims = editorDims ?? { width: pos.width, height: pos.height };
    return `top: ${pos.top - scrollStore.scrollTop}px; left: ${pos.left}px; width: ${dims.width}px; height: ${dims.height}px;`;
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

  // --- Copy/paste: native window events, system clipboard is single source of truth ---
  function isInputTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
  }

  function handleWindowCopy(e: ClipboardEvent) {
    if (editingStore.isEditing || isInputTarget(e.target)) return;
    if (selectionStore.selectionStart.row === -1) return;
    doCopy(e);
  }

  function handleWindowPaste(e: ClipboardEvent) {
    if (editingStore.isEditing || isInputTarget(e.target)) return;
    if (selectionStore.selectionStart.row === -1) return;
    if (!page.data.user) {
      toastState.addToast('Log in to edit.', 'warning');
      return;
    }
    const text = e.clipboardData?.getData('text') ?? '';
    if (!text) return;
    e.preventDefault();
    doPaste(text);
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
    selectionStore.pasteRange = null;
  }

  function handleRedo() {
    if (historyStore.redoStack.length === 0) return;
    const batch = historyStore.redoStack[historyStore.redoStack.length - 1];
    historyStore.redoStack = historyStore.redoStack.slice(0, -1);
    for (const action of batch) {
      upsertPending(action.id, action.key, action.newValue);
    }
    historyStore.undoStack = [...historyStore.undoStack, batch];
    selectionStore.pasteRange = null;
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
    // Restore original column width before closing editor
    const colToRestore = editKey;
    const widthToRestore = originalColWidth;
    // Clear editing state first — prevents effects from re-firing with stale values
    resetEditing();
    originalColWidth = 0;
    typedValue = '';
    if (colToRestore && widthToRestore > 0) {
      columnWidthStore.widths.set(colToRestore, widthToRestore);
    }
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
    typedValue = target.value;
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

<svelte:window oncopy={handleWindowCopy} onpaste={handleWindowPaste} />

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
        maxlength={maxLength}
        class="w-full h-full resize-none bg-bg-elevated text-text-primary text-xs border-2 border-blue-500 rounded px-1.5 focus:outline-none overflow-hidden break-words"
        style="word-wrap: break-word; white-space: pre-wrap; padding-top: {Math.max(2, gridPrefsStore.rowHeight / 2 - 10)}px; padding-bottom: {Math.max(2, gridPrefsStore.rowHeight / 2 - 10)}px;"
      ></textarea>
      {#if uiStore.suggestionMenu.visible}
        <SuggestionMenu options={getOptionsForColumn(editingStore.editCol)} constrained={isConstrained(editingStore.editCol)} />
      {/if}
    </div>
  </div>
{/if}
