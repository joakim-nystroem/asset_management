<script lang="ts">
  import { getEditingContext, getPendingContext, getSelectionContext, getClipboardContext, getViewContext, getColumnWidthContext } from '$lib/context/gridContext.svelte.ts';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import EditDropdownComponent from '$lib/grid/components/edit-dropdown/editDropdown.svelte';
  import AutocompleteComponent from '$lib/grid/components/suggestion-menu/autocomplete.svelte';
  import { createEditDropdown } from '$lib/grid/components/edit-dropdown/editDropdown.svelte.ts';
  import { createAutocomplete } from '$lib/grid/components/suggestion-menu/autocomplete.svelte.ts';
  import { computeEditorPosition } from './editHandler.svelte.ts';
  import { DEFAULT_WIDTH } from '$lib/grid/gridConfig';

  const editingCtx = getEditingContext();
  const pendingCtx = getPendingContext();
  const selCtx = getSelectionContext();
  const clipCtx = getClipboardContext();
  const viewCtx = getViewContext();
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
      viewCtx.virtualScroll
    );
    if (!pos) return 'display: none;';
    return `top: ${pos.top}px; left: ${pos.left}px; width: ${pos.width}px; height: ${pos.height}px;`;
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

    // If changed from baseline, track it
    if (newValue !== baseline) {
      pendingCtx.edits.push({ row: assetId, col: colKey, original: baseline, value: newValue, isValid: true });
    }
  }

  // --- Asset ID → array index ---
  function assetIndex(id: number): number {
    const idx = assets.findIndex((a: Record<string, any>) => a.id === id);
    if (idx === -1) throw new Error(`Asset ${id} not found in filtered list — selection invariant violated`);
    return idx;
  }

  // --- Copy: build tab-separated text from selection, pending-aware ---
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

    const externalRows = assets.slice(minRow, maxRow + 1).map((asset: Record<string, any>) =>
      colKeys.map((key) => cellValue(asset.id, key)).join('\t')
    );

    // Set copy overlay positions
    clipCtx.copyStart = { ...selCtx.selectionStart };
    clipCtx.copyEnd = { ...selCtx.selectionEnd };
    selCtx.hideSelection = true;

    navigator.clipboard.writeText(externalRows.join('\n')).catch(() => {});
  }

  // --- Paste: read system clipboard, parse 2D block, upsert each cell ---
  $effect(() => {
    if (editingCtx.isPasting) {
      handlePaste();
    }
  });

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;

      const lines = text.split(/\r?\n/);
      if (lines.at(-1) === '') lines.pop();
      const clipRows = lines.map((line) => line.split(/\t|,/));
      const clipHeight = clipRows.length;
      const clipWidth = clipRows[0].length;

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

      for (let r = 0; r < maxRow; r++) {
        const asset = assets[minStartRow + r];
        const clipRow = clipRows[r % clipHeight];

        for (let c = 0; c < maxCol; c++) {
          const key = keys[minStartCol + c];
          if (key === 'id') continue;

          const value = clipRow[c % clipWidth];
          const original = String(asset[key] ?? '');
          pastedKeys.add(`${asset.id}:${key}`);

          if (value !== original) {
            newEdits.push({ row: asset.id, col: key, original, value, isValid: true });
          }
        }
      }

      pendingCtx.edits = [
        ...pendingCtx.edits.filter((e) => !pastedKeys.has(`${e.row}:${e.col}`)),
        ...newEdits,
      ];
    } catch {
      // Clipboard read failed
    } finally {
      selCtx.hideSelection = true;
      editingCtx.isPasting = false;
    }
  }

  // Seed inputValue when editing starts (normal edit, not paste)
  // If cell already has a pending edit, use the pending value (not the optimistic asset value)
  $effect(() => {
    if (editingCtx.isEditing) {
      const pending = pendingCtx.edits.find(
        (e) => e.row === editingCtx.editRow && e.col === editKey
      );
      inputValue = pending ? pending.value : editOriginalValue;
    }
  });

  // Focus and select text when textarea mounts
  $effect(() => {
    if (textareaRef && editingCtx.isEditing) {
      textareaRef.focus();
      textareaRef.select();
    }
  });

  function cancelEdit() {
    editingCtx.isEditing = false;
    editingCtx.editRow = -1;
    editingCtx.editCol = '';
    inputValue = '';
    autocomplete.clear();
    editDropdown.hide();
  }

  function saveEdit() {
    if (!editKey || editingCtx.editRow < 0) { cancelEdit(); return; }
    upsertPending(editingCtx.editRow, editKey, inputValue.trim());
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
    // Update suggestions for free-text columns
    if (!editDropdown.isVisible) {
      autocomplete.updateSuggestions(assets, editKey ?? '', inputValue);
    }
  }

  function handleBlur() {
    autocomplete.clear();
    setTimeout(() => {
      if (editingCtx.isEditing) saveEdit();
    }, 0);
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
        class="w-full h-full resize-none bg-white dark:bg-slate-700 text-neutral-900 dark:text-neutral-100 text-xs border-2 border-blue-500 rounded px-1.5 py-1.5 focus:outline-none"
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
