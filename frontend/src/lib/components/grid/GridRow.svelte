<script lang="ts">
  import type { SafeUser } from '$lib/types';
  import type { EditDropdown } from "$lib/utils/ui/editDropdown/editDropdown.svelte.ts";
  import type { Autocomplete } from "$lib/utils/ui/suggestionMenu/autocomplete.svelte.ts";
  import { editManager } from "$lib/utils/interaction/editManager.svelte";
  import { selection } from "$lib/utils/interaction/selectionManager.svelte";
  import { columnManager } from "$lib/utils/core/columnManager.svelte";
  import { rowManager } from "$lib/utils/core/rowManager.svelte";
  import { toastState } from "$lib/utils/ui/toast/toastState.svelte";
  import EditDropdownComponent from "$lib/utils/ui/editDropdown/editDropdown.svelte";
  import AutocompleteComponent from "$lib/utils/ui/suggestionMenu/autocomplete.svelte";

  type Props = {
    asset: Record<string, any>;
    keys: string[];
    actualIndex: number;
    user: SafeUser | null;
    textareaRef: HTMLTextAreaElement | null;
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
    asset, keys, actualIndex, user, textareaRef = $bindable(),
    editDropdown, autocomplete, assets, onSaveEdit, onCancelEdit, onEditAction, onContextMenu, visibleIndex,
  }: Props = $props();
</script>

{#each keys as key, j}
  {@const isEditingThisCell = editManager.isEditingCell(
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

      if (editManager.isEditing) {
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
    style="width: {columnManager.getWidth(
      key,
    )}px; min-width: {columnManager.getWidth(key)}px;"
  >
    {#if isEditingThisCell}
      <div class="relative w-full h-full">
        <textarea
          bind:this={textareaRef}
          bind:value={editManager.inputValue}
          oninput={() => {
            editManager.updateRowHeight(textareaRef, rowManager, columnManager);
            // Update suggestions for free-text columns (not constrained dropdown columns)
            if (!editDropdown.isVisible) {
              autocomplete.updateSuggestions(assets, key, editManager.inputValue);
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
                if (v) editManager.inputValue = v;
                autocomplete.clear();
                return;
              } else if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const v = autocomplete.getSelectedValue();
                if (v !== null) editManager.inputValue = v;
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
                  editManager.inputValue = selectedValue;
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
              if (editManager.isEditing) {
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
            editManager.inputValue = value;
            editDropdown.hide();
            onSaveEdit();
          }}
        />
        <AutocompleteComponent
          {autocomplete}
          onSelect={(value) => {
            editManager.inputValue = value;
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
