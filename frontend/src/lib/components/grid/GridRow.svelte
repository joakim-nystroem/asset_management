<script lang="ts">
  import type { SafeUser } from '$lib/types';
  import type { EditDropdown } from "$lib/grid/components/edit-dropdown/editDropdown.svelte.ts";
  import type { Autocomplete } from "$lib/grid/components/suggestion-menu/autocomplete.svelte.ts";
  import { getGridContext } from "$lib/context/gridContext.svelte.ts";
  import { createEditController } from "$lib/grid/utils/gridEdit.svelte.ts";
  import { createSelectionController } from "$lib/grid/utils/gridSelection.svelte.ts";
  import { createColumnController } from "$lib/grid/utils/gridColumns.svelte.ts";
  import { createRowController } from "$lib/grid/utils/gridRows.svelte.ts";
  import { toastState } from "$lib/components/toast/toastState.svelte";
  import EditDropdownComponent from "$lib/grid/components/edit-dropdown/editDropdown.svelte";
  import AutocompleteComponent from "$lib/grid/components/suggestion-menu/autocomplete.svelte";

  const ctx = getGridContext();
  const edit = createEditController();
  const selection = createSelectionController();
  const columns = createColumnController();
  const rows = createRowController();

  type Props = {
    asset: Record<string, any>;
    keys: string[];
    actualIndex: number;
    user: SafeUser | null;
    editDropdown: EditDropdown;
    autocomplete: Autocomplete;
    assets: Record<string, any>[];
    onSaveEdit: () => void;
    onCancelEdit: () => void;
    onEditAction: () => void;
    onContextMenu: (e: MouseEvent, visibleIndex: number, col: number) => void;
    visibleIndex: number;
  };

  let {
    asset, keys, actualIndex, user,
    editDropdown, autocomplete, assets, onSaveEdit, onCancelEdit, onEditAction, onContextMenu, visibleIndex,
  }: Props = $props();

  // GridRow owns its own textareaRef — no bind propagation needed
  let textareaRef: HTMLTextAreaElement | null = $state(null);

  // When this row becomes the active edit row, focus and select the textarea
  $effect(() => {
    if (textareaRef && ctx.isEditing && ctx.editRow === actualIndex) {
      edit.updateRowHeight(textareaRef);
      textareaRef.focus();
      textareaRef.select();
    }
  });
</script>

{#each keys as key, j}
  {@const isEditingThisCell = edit.isEditingCell(
    actualIndex,
    j,
  )}

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    data-row={actualIndex}
    data-col={j}
    onmousedown={async (e) => {
      if (isEditingThisCell) return;
      // Don't interfere if we're about to double-click
      if (e.detail === 2) return;

      if (ctx.isEditing) {
        // Save the current edit and select new cell without drag mode
        onSaveEdit();
        selection.selectCell(actualIndex, j);
        return;
      } else {
        selection.handleMouseDown(actualIndex, j, e);
      }
    }}
    ondblclick={(e) => {
      if (!user) {
        toastState.addToast(
          "Log in to edit.",
          "warning",
        );
        return;
      }

      // Don't allow editing ID column
      if (key === 'id') {
        toastState.addToast("ID column cannot be edited.", "warning");
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      if (!isEditingThisCell) {
        // Set selection first
        selection.selectCell(actualIndex, j);
        // Then trigger edit
        onEditAction();
      }
    }}
    onmouseenter={() =>
      !isEditingThisCell &&
      selection.extendSelection(actualIndex, j)}
    oncontextmenu={(e) =>
      !isEditingThisCell && onContextMenu(e, visibleIndex, j)}
    class="
      h-full flex items-center text-xs
      text-neutral-700 dark:text-neutral-200
      border-r border-neutral-200 dark:border-slate-700 last:border-r-0
      {isEditingThisCell
      ? ''
      : 'px-2 cursor-cell hover:bg-blue-100 dark:hover:bg-slate-600'}
    "
    style="width: {columns.getWidth(
      key,
    )}px; min-width: {columns.getWidth(key)}px;"
  >
    {#if isEditingThisCell}
      <div class="relative w-full h-full">
        <textarea
          bind:this={textareaRef}
          bind:value={ctx.inputValue}
          oninput={() => {
            edit.updateRowHeight(textareaRef);
            // Update suggestions for free-text columns (not constrained dropdown columns)
            if (!editDropdown.isVisible) {
              autocomplete.updateSuggestions(assets, key, ctx.inputValue);
            }
          }}
          onkeydown={(e) => {
            // Handle autocomplete navigation if visible (takes priority — free-text columns)
            if (autocomplete.isVisible) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                autocomplete.selectNext();
                return;
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                autocomplete.selectPrevious();
                return;
              } else if (e.key === "Tab") {
                e.preventDefault();
                const v = autocomplete.getSelectedValue();
                if (v) ctx.inputValue = v;
                autocomplete.clear();
                return;
              } else if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const v = autocomplete.getSelectedValue();
                if (v !== null) ctx.inputValue = v;
                autocomplete.clear();
                onSaveEdit();
                return;
              } else if (e.key === "Escape") {
                e.preventDefault();
                autocomplete.clear();
                onCancelEdit();
                return;
              }
            }

            // Handle dropdown navigation if visible
            if (editDropdown.isVisible) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                editDropdown.selectNext();
                return;
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                editDropdown.selectPrevious();
                return;
              } else if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const selectedValue = editDropdown.getSelectedValue();
                if (selectedValue !== null) {
                  ctx.inputValue = selectedValue;
                }
                editDropdown.hide();
                onSaveEdit();
                return;
              } else if (e.key === "Escape") {
                e.preventDefault();
                editDropdown.hide();
                onCancelEdit();
                return;
              }
            }

            // Normal keyboard handling when neither dropdown visible
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSaveEdit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancelEdit();
            }
          }}
          onmousedown={(e) => {
            e.stopPropagation();
          }}
          onblur={() => {
            autocomplete.clear();
            // Always save on blur (clicking outside)
            setTimeout(() => {
              if (ctx.isEditing) {
                onSaveEdit();
              }
            }, 0);
          }}
          class="w-full h-full resize-none bg-white dark:bg-slate-700 text-neutral-900 dark:text-neutral-100 border-2 border-blue-500 rounded px-1.5 py-1.5 focus:outline-none"
          style="overflow: hidden;"
        ></textarea>
        <EditDropdownComponent
          dropdown={editDropdown}
          onSelect={(value) => {
            ctx.inputValue = value;
            editDropdown.hide();
            onSaveEdit();
          }}
        />
        <AutocompleteComponent
          {autocomplete}
          onSelect={(value) => {
            ctx.inputValue = value;
            autocomplete.clear();
            onSaveEdit();
          }}
        />
      </div>
    {:else}
      <span class="truncate w-full">{asset[key]}</span>
    {/if}
  </div>
{/each}
