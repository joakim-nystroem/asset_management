<script lang="ts">
  import { getGridContext } from '$lib/context/gridContext.svelte.ts';
  import { createEditController } from '$lib/grid/utils/gridEdit.svelte.ts';
  import { createRowController } from '$lib/grid/utils/gridRows.svelte.ts';
  import { createColumnController } from '$lib/grid/utils/gridColumns.svelte.ts';
  import EditDropdownComponent from '$lib/grid/components/edit-dropdown/editDropdown.svelte';
  import AutocompleteComponent from '$lib/grid/components/suggestion-menu/autocomplete.svelte';
  import { computeEditorPosition } from './floatingEditor.svelte.ts';

  const ctx = getGridContext();
  const edit = createEditController();
  const rows = createRowController();
  const columns = createColumnController();

  let textareaRef: HTMLTextAreaElement | null = $state(null);

  // Compute absolute position within the translated virtual-chunk
  const editorStyle = $derived.by(() => {
    if (!ctx.isEditing || ctx.editKey === null || ctx.editRow < 0 || ctx.editCol < 0) {
      return 'display: none;';
    }
    const pos = computeEditorPosition(
      ctx.editRow,
      ctx.editCol,
      ctx.editKey,
      ctx.keys,
      rows,
      columns,
      ctx.virtualScroll
    );
    return `top: ${pos.top}px; left: ${pos.left}px; width: ${pos.width}px; height: ${pos.height}px;`;
  });

  // Focus and select text when textarea mounts and this row is the active edit row
  $effect(() => {
    if (textareaRef && ctx.isEditing) {
      edit.updateRowHeight(textareaRef);
      textareaRef.focus();
      textareaRef.select();
    }
  });

  function handleKeydown(e: KeyboardEvent) {
    const autocomplete = ctx.autocomplete;
    const editDropdown = ctx.editDropdown;

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
        if (v) ctx.inputValue = v;
        autocomplete.clear();
        return;
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const v = autocomplete.getSelectedValue();
        if (v !== null) ctx.inputValue = v;
        autocomplete.clear();
        ctx.pageActions?.onSaveEdit(ctx.inputValue);
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        autocomplete.clear();
        ctx.pageActions?.onCancelEdit();
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
          ctx.inputValue = selectedValue;
        }
        editDropdown.hide();
        ctx.pageActions?.onSaveEdit(ctx.inputValue);
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        editDropdown.hide();
        ctx.pageActions?.onCancelEdit();
        return;
      }
    }

    // Normal keyboard handling when neither dropdown is visible
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ctx.pageActions?.onSaveEdit(ctx.inputValue);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      ctx.pageActions?.onCancelEdit();
    }
  }

  function handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    ctx.inputValue = target.value;
    edit.updateRowHeight(textareaRef);
    // Update suggestions for free-text columns (not constrained dropdown columns)
    if (ctx.autocomplete && ctx.editDropdown && !ctx.editDropdown.isVisible) {
      ctx.autocomplete.updateSuggestions(ctx.assets, ctx.editKey ?? '', ctx.inputValue);
    }
  }

  function handleBlur() {
    if (ctx.autocomplete) {
      ctx.autocomplete.clear();
    }
    // Always save on blur (clicking outside) — setTimeout prevents race with dropdown mousedown
    setTimeout(() => {
      if (ctx.isEditing) {
        ctx.pageActions?.onSaveEdit(ctx.inputValue);
      }
    }, 0);
  }
</script>

{#if ctx.isEditing}
  <div class="absolute z-[100]" style={editorStyle}>
    <div class="relative w-full h-full">
      <textarea
        bind:this={textareaRef}
        bind:value={ctx.inputValue}
        oninput={handleInput}
        onkeydown={handleKeydown}
        onmousedown={(e) => e.stopPropagation()}
        onblur={handleBlur}
        class="w-full h-full resize-none bg-white dark:bg-slate-700 text-neutral-900 dark:text-neutral-100 border-2 border-blue-500 rounded px-1.5 py-1.5 focus:outline-none"
        style="overflow: hidden;"
      ></textarea>
      {#if ctx.editDropdown}
        <EditDropdownComponent
          dropdown={ctx.editDropdown}
          onSelect={(value) => {
            ctx.inputValue = value;
            ctx.editDropdown?.hide();
            ctx.pageActions?.onSaveEdit(value);
          }}
        />
      {/if}
      {#if ctx.autocomplete}
        <AutocompleteComponent
          autocomplete={ctx.autocomplete}
          onSelect={(value) => {
            ctx.inputValue = value;
            ctx.autocomplete?.clear();
            ctx.pageActions?.onSaveEdit(value);
          }}
        />
      {/if}
    </div>
  </div>
{/if}
