<script lang="ts">
  import { getEditingContext, getColumnContext, getDataContext, getViewContext } from '$lib/context/gridContext.svelte.ts';
  import { createEditController } from '$lib/grid/utils/gridEdit.svelte.ts';
  import { createRowController } from '$lib/grid/utils/gridRows.svelte.ts';
  import { createColumnController } from '$lib/grid/utils/gridColumns.svelte.ts';
  import EditDropdownComponent from '$lib/grid/components/edit-dropdown/editDropdown.svelte';
  import AutocompleteComponent from '$lib/grid/components/suggestion-menu/autocomplete.svelte';
  import { computeEditorPosition } from './floatingEditor.svelte.ts';

  const editCtx = getEditingContext();
  const colCtx = getColumnContext();
  const dataCtx = getDataContext();
  const viewCtx = getViewContext();
  const edit = createEditController();
  const rows = createRowController();
  const columns = createColumnController();

  type Props = {
    onSave?: (change: { id: any; key: string; oldValue: any; newValue: any }) => void;
  };
  let { onSave }: Props = $props();

  let textareaRef: HTMLTextAreaElement | null = $state(null);

  // Compute absolute position within the translated virtual-chunk
  const editorStyle = $derived.by(() => {
    if (!editCtx.isEditing || editCtx.editKey === null || editCtx.editRow < 0 || editCtx.editCol < 0) {
      return 'display: none;';
    }
    const pos = computeEditorPosition(
      editCtx.editRow,
      editCtx.editCol,
      editCtx.editKey,
      colCtx.keys,
      rows,
      columns,
      viewCtx.virtualScroll
    );
    return `top: ${pos.top}px; left: ${pos.left}px; width: ${pos.width}px; height: ${pos.height}px;`;
  });

  // Focus and select text when textarea mounts and this row is the active edit row
  $effect(() => {
    if (textareaRef && editCtx.isEditing) {
      edit.updateRowHeight(textareaRef);
      textareaRef.focus();
      textareaRef.select();
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    const autocomplete = editCtx.autocomplete;
    const editDropdown = editCtx.editDropdown;

    // Handle autocomplete navigation if visible (takes priority — free-text columns)
    if (autocomplete && autocomplete.isVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        autocomplete.selectNext();
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        autocomplete.selectPrevious();
        return;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const v = autocomplete.getSelectedValue();
        if (v) editCtx.inputValue = v;
        autocomplete.clear();
        return;
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const v = autocomplete.getSelectedValue();
        if (v !== null) editCtx.inputValue = v;
        autocomplete.clear();
        edit.save(dataCtx.assets).then(change => { if (change) onSave?.(change); });
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        autocomplete.clear();
        edit.cancel();
        return;
      }
    }

    // Handle dropdown navigation if visible
    if (editDropdown && editDropdown.isVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        editDropdown.selectNext();
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        editDropdown.selectPrevious();
        return;
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const selectedValue = editDropdown.getSelectedValue();
        if (selectedValue !== null) {
          editCtx.inputValue = selectedValue;
        }
        editDropdown.hide();
        edit.save(dataCtx.assets).then(change => { if (change) onSave?.(change); });
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        editDropdown.hide();
        edit.cancel();
        return;
      }
    }

    // Normal keyboard handling when neither dropdown is visible
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      edit.save(dataCtx.assets).then(change => { if (change) onSave?.(change); });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      edit.cancel();
    }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    editCtx.inputValue = target.value;
    edit.updateRowHeight(textareaRef);
    // Update suggestions for free-text columns (not constrained dropdown columns)
    if (editCtx.autocomplete && editCtx.editDropdown && !editCtx.editDropdown.isVisible) {
      editCtx.autocomplete.updateSuggestions(dataCtx.assets, editCtx.editKey ?? '', editCtx.inputValue);
    }
  }

  function handleBlur() {
    if (editCtx.autocomplete) {
      editCtx.autocomplete.clear();
    }
    // Always save on blur (clicking outside) — setTimeout prevents race with dropdown mousedown
    setTimeout(() => {
      if (editCtx.isEditing) {
        edit.save(dataCtx.assets).then(change => { if (change) onSave?.(change); });
      }
    }, 0);
  }
</script>

{#if editCtx.isEditing}
  <div class="absolute z-[100]" style={editorStyle}>
    <div class="relative w-full h-full">
      <textarea
        bind:this={textareaRef}
        bind:value={editCtx.inputValue}
        oninput={handleInput}
        onkeydown={handleKeydown}
        onmousedown={(e) => e.stopPropagation()}
        onblur={handleBlur}
        class="w-full h-full resize-none bg-white dark:bg-slate-700 text-neutral-900 dark:text-neutral-100 text-xs border-2 border-blue-500 rounded px-1.5 py-1.5 focus:outline-none"
        style="overflow: hidden;"
      ></textarea>
      {#if editCtx.editDropdown}
        <EditDropdownComponent
          dropdown={editCtx.editDropdown}
          onSelect={(value) => {
            editCtx.inputValue = value;
            editCtx.editDropdown?.hide();
            edit.save(dataCtx.assets).then(change => { if (change) onSave?.(change); });
          }}
        />
      {/if}
      {#if editCtx.autocomplete}
        <AutocompleteComponent
          autocomplete={editCtx.autocomplete}
          onSelect={(value) => {
            editCtx.inputValue = value;
            editCtx.autocomplete?.clear();
            edit.save(dataCtx.assets).then(change => { if (change) onSave?.(change); });
          }}
        />
      {/if}
    </div>
  </div>
{/if}
