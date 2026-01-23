<script lang="ts">
  import { tick, untrack } from "svelte";
  import type { PageProps } from "./$types";
  // --- COMPONENTS ---
  import ContextMenu from "$lib/utils/ui/contextMenu/contextMenu.svelte";
  import HeaderMenu from "$lib/utils/ui/headerMenu/headerMenu.svelte";
  // --- UTILS IMPORTS ---
  import { createInteractionHandler } from "$lib/utils/interaction/interactionHandler";
  // --- STATE CLASSES ---
  import { ContextMenuState } from "$lib/utils/ui/contextMenu/contextMenu.svelte.ts";
  import { historyManager } from "$lib/utils/interaction/historyManager.svelte";
  import { createHeaderMenu } from "$lib/utils/ui/headerMenu/headerMenu.svelte.ts";
  import { selection } from "$lib/utils/interaction/selectionManager.svelte";
  import { createClipboard } from "$lib/utils/interaction/clipboardManager.svelte";
  import { searchManager } from "$lib/utils/data/searchManager.svelte";
  import { sortManager } from "$lib/utils/data/sortManager.svelte";
  import { createVirtualScroll } from "$lib/utils/core/virtualScrollManager.svelte";
  import { columnManager } from "$lib/utils/core/columnManager.svelte";
  import { rowManager } from "$lib/utils/core/rowManager.svelte";
  import { editManager } from "$lib/utils/interaction/editManager.svelte";
  import FilterPanel from "$lib/utils/ui/filterPanel/filterPanel.svelte";
  import { FilterPanelState } from "$lib/utils/ui/filterPanel/filterPanel.svelte.ts";
  import { changeManager } from "$lib/utils/interaction/changeManager.svelte";
  import { realtime } from "$lib/utils/interaction/realtimeManager.svelte";
  import { toastState } from "$lib/utils/ui/toast/toastState.svelte";
  import { rowGenerationManager } from "$lib/utils/interaction/rowGenerationManager.svelte";
  import { validationManager } from "$lib/utils/data/validationManager.svelte";

  // Initialize State Classes
  const contextMenu = new ContextMenuState();
  const headerMenu = createHeaderMenu();
  const clipboard = createClipboard(selection);
  const virtualScroll = createVirtualScroll();
  const filterPanel = new FilterPanelState();

  let { data }: PageProps = $props();

  // --- Data State ---
  let baseAssets: Record<string, any>[] = $state(data.assets);
  let filteredAssets: Record<string, any>[] = $state(data.assets);
  let locations: Record<string, any>[] = $state(data.locations || []);
  let statuses: Record<string, any>[] = $state(data.statuses || []);
  let conditions: Record<string, any>[] = $state(data.conditions || []);

  // Combine filtered assets with new rows at the bottom
  let assets = $derived([...filteredAssets, ...rowGenerationManager.newRows]);

  // Realtime State (Derived from Singleton)
  // Map other users' positions based on asset IDs to current filtered view
  let otherUserSelections = $derived(
    Object.entries(realtime.connectedUsers).reduce(
      (acc, [clientId, position]) => {
        // If the user has an assetId, find it in our current filtered view
        if (position.assetId !== undefined) {
          const rowIndex = assets.findIndex(a => a.id === position.assetId);
          // Only include if asset exists in current filtered view
          if (rowIndex !== -1) {
            acc[clientId] = {
              ...position,
              row: rowIndex, // Use the mapped row index
              initials: (
                (position.firstname?.[0] || "") + (position.lastname?.[0] || "")
              ).toUpperCase(),
              fullName:
                `${position.firstname?.[0]?.toUpperCase() || ""}${position.firstname?.slice(1) || ""} ${position.lastname?.[0]?.toUpperCase() || ""}${position.lastname?.slice(1) || ""}`.trim(),
            };
          }
        } else {
          // Fallback for old clients that don't send assetId
          acc[clientId] = {
            ...position,
            initials: (
              (position.firstname?.[0] || "") + (position.lastname?.[0] || "")
            ).toUpperCase(),
            fullName:
              `${position.firstname?.[0]?.toUpperCase() || ""}${position.firstname?.slice(1) || ""} ${position.lastname?.[0]?.toUpperCase() || ""}${position.lastname?.slice(1) || ""}`.trim(),
          };
        }
        return acc;
      },
      {} as Record<string, any>,
    ),
  );
  let hoveredUser: string | null = $state(null);

  let keys = $derived(assets.length > 0 ? Object.keys(assets[0]) : []);

  // Set up the next ID provider for new rows (based on full original array, not filtered)
  $effect(() => {
    rowGenerationManager.setNextIdProvider(() => {
      if (baseAssets.length === 0) return 1;
      const maxId = Math.max(...baseAssets.map(a => typeof a.id === 'number' ? a.id : 0));
      return maxId + 1 + rowGenerationManager.newRowCount;
    });
  });

  $effect(() => {
    const changes = changeManager.getAllChanges();
    if (changes.length === 0) {
      selection.clearDirtyCells();
      return;
    }

    const assetIdMap = new Map(
      assets.map((asset, index) => [asset.id.toString(), index]),
    );
    const keyMap = new Map(keys.map((key, index) => [key, index]));

    const dirtyCells = changes
      .map((change) => {
        const row = assetIdMap.get(String(change.id));
        const col = keyMap.get(change.key);
        return { row, col };
      })
      .filter((c) => c.row !== undefined && c.col !== undefined) as {
      row: number;
      col: number;
    }[];

    selection.setDirtyCells(dirtyCells);
  });

  $effect(() => {
    // 1. Capture the data explicitly.
    // This ensures the effect subscribes to 'locations', 'statuses', and 'conditions'.
    const locNames = locations.map((l) => l.location_name);
    const statNames = statuses.map((s) => s.status_name);
    const condNames = conditions.map((c) => c.condition_name);

    // 2. Update the managers inside 'untrack'.
    // This tells Svelte: "Execute this, but ignore any state reads happening inside."
    untrack(() => {
      const constraints = {
        location: locNames,
        status: statNames,
        condition: condNames,
      };

      changeManager.setConstraints(constraints);
      validationManager.setConstraints(constraints);

      // Note: Validation for new rows now happens only on commit
    });
  });

  const dirtyCellOverlays = $derived(
    selection.computeDirtyCellOverlays(
      virtualScroll.visibleRange,
      keys,
      columnManager,
      virtualScroll.rowHeight,
      // Add this callback:
      (row, col) => {
        const asset = assets[row];
        if (!asset) return false;
        const key = keys[col];

        // Check if it's a new row (row index >= filtered assets length)
        const isNewRow = row >= filteredAssets.length;
        if (isNewRow) {
          const newRowIndex = row - filteredAssets.length;
          return rowGenerationManager.isNewRowFieldInvalid(newRowIndex, key);
        }

        // Use changeManager for existing rows
        return changeManager.isInvalid(asset.id, key);
      },
    ),
  );

  const updateAssetInList = (
    list: Record<string, any>[],
    payload: { id: number | string; key: string; value: any },
  ) => {
    const index = list.findIndex((a) => a.id === payload.id);
    if (index !== -1) {
      list[index][payload.key] = payload.value;
    }
  };

  const handleRealtimeUpdate = (payload: {
    id: number;
    key: string;
    value: any;
  }) => {
    updateAssetInList(filteredAssets, payload);
    updateAssetInList(baseAssets, payload);
  };

  async function handleAddNewRow() {
    if (!data.user) {
      toastState.addToast("Log in to add new rows.", "warning");
      return;
    }

    // Block if an edit is in progress
    if (editManager.isEditing) {
      toastState.addToast(
        "Please finish or cancel your current edit before adding new rows.",
        "warning"
      );
      return;
    }

    // Block only if there are unsaved changes to existing rows
    // Allow adding multiple new rows
    if (changeManager.hasChanges) {
      toastState.addToast(
        "Please save or discard your changes to existing rows before adding new rows.",
        "warning"
      );
      return;
    }

    // Create a template with empty values for all columns
    const template: Record<string, any> = {};
    keys.forEach(key => {
      if (key !== 'id') {
        template[key] = '';
      }
    });

    // Add a new row with empty values for all columns
    const newRows = rowGenerationManager.addNewRows(1, template);

    // Scroll to the bottom of the grid
    await tick();
    if (scrollContainer) {
      const totalRows = assets.length;
      const lastRowIndex = totalRows - 1;

      // Ensure the last row is visible
      virtualScroll.ensureVisible(
        lastRowIndex,
        0,
        scrollContainer,
        keys,
        columnManager,
        rowManager
      );

      // Select the first cell of the new row
      selection.selectCell(lastRowIndex, 0);
    }
  }

  let scrollContainer: HTMLDivElement | null = $state(null);
  let textareaRef: HTMLTextAreaElement | null = $state(null);
  const visibleData = $derived(virtualScroll.getVisibleItems(assets));

  const selectionOverlay = $derived(
    selection.computeVisualOverlay(
      selection.start,
      selection.end,
      virtualScroll.visibleRange,
      keys,
      columnManager,
      virtualScroll.rowHeight,
    ),
  );
  const copyOverlay = $derived(
    selection.isCopyVisible
      ? selection.computeVisualOverlay(
          selection.copyStart,
          selection.copyEnd,
          virtualScroll.visibleRange,
          keys,
          columnManager,
          virtualScroll.rowHeight,
        )
      : null,
  );
  const mountInteraction = createInteractionHandler(
    { selection, columnManager, contextMenu, headerMenu },
    {
      onCopy: async () => {
        await handleCopy();
      },
      onPaste: handlePaste,
      onUndo: () => {
        const undoneBatch = historyManager.undo(assets);
        if (undoneBatch) {
          for (const action of undoneBatch) {
            changeManager.update({
              id: action.id,
              key: action.key,
              newValue: action.oldValue,
              oldValue: action.newValue,
            });
          }
        }
      },
      onRedo: () => {
        const redoneBatch = historyManager.redo(assets);
        if (redoneBatch) {
          for (const action of redoneBatch) {
            changeManager.update(action);
          }
        }
      },
      onEscape: () => {
        if (editManager.isEditing) {
          editManager.cancel(columnManager, rowManager);
          return;
        }

        if (selection.hasSelection) {
          selection.resetAll();
        }

        clipboard.clear();
        if (contextMenu.visible) contextMenu.close();
        headerMenu.close();
      },
      onEdit: handleEditAction,
      onScrollIntoView: (row, col) => {
        virtualScroll.ensureVisible(
          row,
          col,
          scrollContainer,
          keys,
          columnManager,
          rowManager,
        );
      },
      getGridSize: () => ({ rows: assets.length, cols: keys.length }),
    },
  );
  async function handleSearch() {
    const result = await searchManager.search(baseAssets);

    // Discard all pending changes when filtering
    if (changeManager.hasChanges) {
      const changesToRevert = changeManager.getAllChanges(true);
      for (const change of changesToRevert) {
        const item = baseAssets.find(a => a.id === change.id);
        if (item) {
          item[change.key] = change.oldValue;
        }
      }
      changeManager.clear();
      historyManager.clear();
    }

    // Discard new rows when filtering
    if (rowGenerationManager.hasNewRows) {
      rowGenerationManager.clearNewRows();
    }

    filteredAssets = result;
    selection.reset();
    sortManager.invalidateCache();
    sortManager.reset();
  }

  async function applySort(key: string, dir: "asc" | "desc") {
    selection.reset();
    sortManager.update(key, dir);
    filteredAssets = await sortManager.applyAsync(filteredAssets);
    headerMenu.close();
  }

  async function handleCopy() {
    await clipboard.copy(assets, keys);
    if (contextMenu.visible) contextMenu.close();
    selection.reset();
  }

  function handleContextMenu(e: MouseEvent, visibleIndex: number, col: number) {
    const actualRow = virtualScroll.getActualIndex(visibleIndex);
    const key = keys[col];
    const value = String(assets[actualRow][key] ?? "");
    selection.selectCell(actualRow, col);
    contextMenu.open(e, actualRow, col, value, key);
    headerMenu.close();
  }

  function handleDeleteNewRow() {
    if (!contextMenu.visible) return;
    const { row } = contextMenu;

    // Check if this is a new row (row index >= filtered assets length)
    const isNewRow = row >= filteredAssets.length;
    if (isNewRow) {
      const newRowIndex = row - filteredAssets.length;
      rowGenerationManager.deleteNewRow(newRowIndex);
      contextMenu.close();
      selection.reset();
      toastState.addToast("New row deleted.", "info");
    }
  }

  function getActionTarget() {
    if (contextMenu.visible) {
      return { row: contextMenu.row, col: contextMenu.col };
    }
    return selection.anchor;
  }

  async function handlePaste() {
    if (!data.user) {
      toastState.addToast("Log in to edit.", "warning");
      return;
    }
    const target = getActionTarget();
    if (!target) return;

    // Create a mutable copy of assets for the paste operation
    const mutableAssets = [...assets];
    const pasteResult = await clipboard.paste(target, mutableAssets, keys);

    if (pasteResult && pasteResult.changes.length > 0) {
      // Process each change and route to the appropriate manager
      for (const change of pasteResult.changes) {
        const rowIndex = mutableAssets.findIndex(a => a.id === change.id);
        if (rowIndex === -1) continue;

        // Check if this is a new row (row index >= filtered assets length)
        const isNewRow = rowIndex >= filteredAssets.length;

        if (isNewRow) {
          // Don't allow pasting into ID column
          if (change.key === 'id') continue;

          // Update new row in the manager
          const newRowIndex = rowIndex - filteredAssets.length;
          rowGenerationManager.updateNewRowField(newRowIndex, change.key, change.newValue);
        } else {
          // Don't allow pasting into ID column
          if (change.key === 'id') continue;

          // Update existing row
          const itemInFiltered = filteredAssets.find(a => a.id === change.id);
          if (itemInFiltered) {
            itemInFiltered[change.key] = change.newValue;
          }

          // Track change
          historyManager.recordBatch([change]);
          changeManager.update(change);
        }
      }
    }

    if (contextMenu.visible) contextMenu.close();
    if (pasteResult) {
      const startRow = target.row;
      const startCol = target.col;
      const endRow = Math.min(
        startRow + pasteResult.rows - 1,
        assets.length - 1,
      );
      const endCol = Math.min(startCol + pasteResult.cols - 1, keys.length - 1);
      selection.reset();
      selection.start = { row: startRow, col: startCol };
      selection.end = { row: endRow, col: endCol };
    }
  }

  function handleFilterByValue() {
    if (!contextMenu.visible) return;
    const { key, value } = contextMenu;
    searchManager.selectFilterItem(value, key, assets);
    contextMenu.close();
  }

  async function handleEditAction() {
    if (!data.user) {
      toastState.addToast("Log in to edit.", "warning");
      contextMenu.close();
      return;
    }
    // Falls back to state (ContextMenu > Selection)
    const target = getActionTarget();

    if (!target) return;
    const { row, col } = target;

    // Check if trying to edit an existing row while new rows exist
    const isExistingRow = row < filteredAssets.length;
    if (isExistingRow && rowGenerationManager.hasNewRows) {
      toastState.addToast(
        "Please save or discard new rows before editing existing rows.",
        "warning"
      );
      contextMenu.close();
      return;
    }

    const key = keys[col];
    const asset = assets[row];
    if (!asset || !key) return;

    // Don't allow editing ID column
    if (key === 'id') {
      toastState.addToast("ID column cannot be edited.", "warning");
      contextMenu.close();
      return;
    }

    const currentValue = String(asset[key] ?? "");

    editManager.startEdit(
      row,
      col,
      key,
      currentValue,
      columnManager,
      rowManager,
    );
    contextMenu.close();
    selection.reset();

    await tick();
    if (textareaRef) {
      editManager.updateRowHeight(textareaRef, rowManager, columnManager);
      textareaRef.focus();
      textareaRef.select();
    }
  }

  async function saveEdit() {
    if (!data.user) {
      toastState.addToast("Log in to edit.", "warning");
      return;
    }
    const pos = editManager.getEditPosition();
    if (!pos) return;

    // Check if this is a new row (row index >= filtered assets length)
    const isNewRow = pos.row >= filteredAssets.length;

    if (isNewRow) {
      // Handle new row editing
      const key = keys[pos.col];
      const newValue = editManager.inputValue.trim();

      // Update the new row field directly in the manager
      const newRowIndex = pos.row - filteredAssets.length;
      rowGenerationManager.updateNewRowField(newRowIndex, key, newValue);

      // Reset the edit manager
      editManager.cancel(columnManager, rowManager);
    } else {
      // Existing row - use normal flow
      const change = await editManager.save(filteredAssets, columnManager, rowManager);

      if (change) {
        // Also update baseAssets to keep them in sync
        updateAssetInList(baseAssets, {
          id: change.id,
          key: change.key,
          value: change.newValue,
        });

        const action = {
          id: change.id,
          key: change.key,
          oldValue: change.oldValue,
          newValue: change.newValue,
        };
        historyManager.recordBatch([action]);
        changeManager.update(action);

        try {
          const response = await fetch("/asset/api/update", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify([
              {
                rowId: change.id,
                columnId: change.key,
                newValue: change.newValue,
              },
            ]),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error("Failed to save edit to server:", errorData.error);
          } else {
            console.log("Edit saved successfully to server.");
          }
        } catch (error) {
          console.error("Network error while saving edit:", error);
        }
      }
    }

    if (pos) selection.selectCell(pos.row, pos.col);
  }

  function cancelEdit() {
    const pos = editManager.getEditPosition();
    editManager.cancel(columnManager, rowManager);
    if (pos) selection.selectCell(pos.row, pos.col);
  }

  async function commitChanges() {
    if (!data.user) {
      toastState.addToast("Log in to edit.", "warning");
      return;
    }

    const hasNewRows = rowGenerationManager.hasNewRows;

    // Validate new rows if any exist
    if (hasNewRows) {
      const isValid = rowGenerationManager.validateAll();

      if (!isValid) {
        toastState.addToast(
          "Invalid values in new rows.",
          "warning",
        );
        return;
      }

      // Check if any new rows are incomplete (have empty required fields)
      const newRows = rowGenerationManager.newRows;
      const incompleteRows = newRows.filter(row => {
        // A row is incomplete if it has no meaningful data beyond the ID
        const hasData = Object.entries(row).some(([key, value]) => {
          return key !== 'id' && value !== undefined && value !== null && value !== '';
        });
        return !hasData;
      });

      if (incompleteRows.length > 0) {
        toastState.addToast(
          `Cannot commit: ${incompleteRows.length} new ${incompleteRows.length === 1 ? 'row is' : 'rows are'} incomplete. Please fill in data or delete empty rows.`,
          "error",
        );
        rowGenerationManager.clearValidation();
        return;
      }
    }

    const validChanges = changeManager.getValidChanges();

    // Only get valid changes
    if (validChanges.length === 0 && !hasNewRows) {
      if (changeManager.hasInvalidChanges) {
        toastState.addToast(
          "Cannot commit: Some changes have invalid values. Please fix the highlighted cells.",
          "warning",
        );
      }
      return;
    }

    const apiChanges = validChanges.map((c) => ({
      rowId: c.id,
      columnId: c.key,
      newValue: c.newValue,
      oldValue: c.oldValue,
    }));

    try {
      // Save existing row updates if any
      if (validChanges.length > 0) {
        const response = await fetch("/asset/api/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(apiChanges),
        });

        if (!response.ok) {
          console.error("Commit failed:", await response.text());
          toastState.addToast(
            "Failed to commit changes. See console for details.",
            "error",
          );
          rowGenerationManager.clearValidation();
          return;
        }
      }

      const invalidChangeCount = changeManager.getAllChanges().length - validChanges.length;

      // Clear only the valid changes from the change manager
      changeManager.clearValidChanges();
      selection.resetAll();

      // TODO: Save new rows via API (not implemented yet)
      if (hasNewRows) {
        const newRows = rowGenerationManager.newRows;
        console.log("New rows to save:", newRows);

        // For now, just notify that new row saving is not implemented
        toastState.addToast(
          "New row saving not yet implemented. New rows have been discarded.",
          "warning",
        );
        rowGenerationManager.clearNewRows();
      }

      if (invalidChangeCount > 0) {
        toastState.addToast(
          `${validChanges.length} changes committed. ${invalidChangeCount} invalid edits still need to be fixed.`,
          "warning",
        );
      } else if (validChanges.length > 0) {
        toastState.addToast(
          `${validChanges.length} changes committed successfully.`,
          "success",
        );
      }
    } catch (error) {
      console.error("Commit failed:", error);
      toastState.addToast("Network error while committing changes.", "error");
      rowGenerationManager.clearValidation();
    }
  }

  function discardChanges() {
    if (!data.user) {
      toastState.addToast("Log in to edit.", "warning");
      return;
    }
    const changesToRevert = changeManager.getAllChanges(true);

    // Revert changes from changeManager
    for (const change of changesToRevert) {
        const item = filteredAssets.find(a => a.id === change.id);
        if (item) {
            item[change.key] = change.oldValue;
        }
    }

    // Remove the discarded changes from history
    historyManager.clearCommitted(changesToRevert);

    // Clear all changes and new rows
    changeManager.clear();
    rowGenerationManager.clearNewRows();
    selection.resetAll();
    toastState.addToast("Changes discarded.", "info");
  }

  $effect(() => {
    const cleanupInteraction = mountInteraction(window);

    // Register this page's handler
    realtime.setAssetUpdateHandler(handleRealtimeUpdate);

    let resizeObserver: ResizeObserver | null = null;
    if (scrollContainer) {
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          virtualScroll.updateContainerHeight(entry.contentRect.height);
        }
      });
      resizeObserver.observe(scrollContainer);
    }

    return () => {
      cleanupInteraction();

      // CHANGED: Overwrite with an empty function to "remove" the handler
      realtime.setAssetUpdateHandler(() => {});

      if (resizeObserver) resizeObserver.disconnect();
      changeManager.clear();
      historyManager.clear();
      rowGenerationManager.clearNewRows();
    };
  });

  $effect(() => {
    searchManager.term;
    searchManager.selectedFilters;
    handleSearch();
  });
  $effect(() => {
    if (filterPanel.isOpen) headerMenu.close();
  });
  $effect(() => {
    if (headerMenu.activeKey) filterPanel.close();
  });
  $effect(() => {
    filteredAssets;
    searchManager.cleanupFilterCache();
    sortManager.invalidateCache();
  });

  let updatePositionTimeout: NodeJS.Timeout | null = null;
  $effect(() => {
    if (selection.start) {
      if (updatePositionTimeout) {
        clearTimeout(updatePositionTimeout);
      }
      updatePositionTimeout = setTimeout(() => {
        if (selection.start.row === -1) {
          realtime.sendDeselect();
        } else {
          const asset = assets[selection.start.row];
          const assetId = asset?.id;
          realtime.sendPositionUpdate(selection.start.row, selection.start.col, assetId);
        }
      }, 100);
    }
  });
</script>

<div class="flex flex-col gap-2 mb-3">
  <div class="flex flex-row gap-4 items-center">
    <!-- WS Indicator Moved to Layout, H2 removed here -->

    <div class="flex gap-4 items-center">
      <div class="relative">
        <input
          bind:value={searchManager.inputValue}
          class="bg-white dark:bg-neutral-100 dark:text-neutral-700 placeholder-neutral-500! p-1 pr-7 border border-neutral-300 dark:border-none focus:outline-none"
          placeholder="Search..."
          onkeydown={(e) => {
            if (e.key === "Enter") searchManager.executeSearch();
          }}
        />
        {#if searchManager.inputValue}
          <button
            onclick={() => searchManager.clearSearch()}
            class="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-700 cursor-pointer font-bold text-xs"
            title="Clear search"
          >
            ✕
          </button>
        {/if}
      </div>
      <button
        onclick={() => searchManager.executeSearch()}
        class="cursor-pointer bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded text-neutral-100"
        >Search</button
      >
    </div>

    <div class="flex flex-row w-full justify-between items-center">
      <div class="flex flex-row gap-2">
        <FilterPanel state={filterPanel} {searchManager} />
        {#if data.user}
          <button
            onclick={handleAddNewRow}
            class="cursor-pointer bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded text-neutral-100 whitespace-nowrap"
          >
            + New Row
          </button>
        {/if}
        {#if (changeManager.hasChanges || rowGenerationManager.hasNewRows) && data.user}
          <div class="flex gap-2 items-center">
            <button
              onclick={commitChanges}
              class="cursor-pointer bg-green-500 hover:bg-green-600 px-2 py-1 rounded text-neutral-100 whitespace-nowrap"
            >
              Commit Changes
              {#if changeManager.hasInvalidChanges}
                <span class="ml-1 text-xs"
                  >({changeManager.validChangeCount} valid)</span
                >
              {/if}
              {#if rowGenerationManager.hasNewRows}
                <span class="ml-1 text-xs"
                  >({rowGenerationManager.newRowCount} new {rowGenerationManager.newRowCount === 1 ? 'row' : 'rows'})</span
                >
              {/if}
            </button>
            <button
              onclick={discardChanges}
              class="cursor-pointer bg-red-500 hover:bg-red-600 px-2 py-1 rounded text-neutral-100"
            >
              Discard
            </button>
            {#if changeManager.hasInvalidChanges}
              <span class="text-yellow-600 dark:text-yellow-400 text-xs">
                ⚠️ Some changes have invalid values
              </span>
            {/if}
          </div>
        {/if}
        {#if rowGenerationManager.hasNewRows && data.user}
          <div class="flex gap-2 items-center">
            <span class="text-blue-600 dark:text-blue-400 text-xs">
              {rowGenerationManager.newRowCount} new {rowGenerationManager.newRowCount === 1 ? 'row' : 'rows'}
              {#if rowGenerationManager.hasInvalidNewRows}
                <span class="text-yellow-600 dark:text-yellow-400">
                  ({rowGenerationManager.invalidNewRowCount} invalid)
                </span>
              {/if}
            </span>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

{#if assets.length > 0}
  <div
    bind:this={scrollContainer}
    onscroll={(e) => {
      // 1. Handle virtual scroll (existing)
      virtualScroll.handleScroll(e);
      
      // 2. Reposition header menu if it's open
      if (headerMenu.activeKey) {
        headerMenu.reposition();
      }
    }}
    class="rounded-lg border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-auto h-[calc(100dvh-8.9rem)] shadow-md relative select-none focus:outline-none"
    tabindex="-1"
  >

    <HeaderMenu
      state={headerMenu}
      {sortManager}
      {searchManager}
      {assets}
      onSort={applySort}
    />

    <div
      class="w-max min-w-full bg-white dark:bg-slate-800 text-left relative"
      style="height: {virtualScroll.getTotalHeight(assets.length, rowManager) +
        32}px;"
    >
      <div class="sticky top-0 z-20 flex border-b border-neutral-200 dark:border-slate-600 bg-neutral-50 dark:bg-slate-700">
        {#each keys as key, i}
          <div
            data-header-col={i}
            class="header-interactive relative group border-r border-neutral-200 dark:border-slate-600 last:border-r-0"
            style="width: {columnManager.getWidth(key)}px; min-width: {columnManager.getWidth(key)}px;"
          >
            <button
              class="w-full h-full px-2 py-2 text-xs font-medium text-neutral-900 dark:text-neutral-100 uppercase hover:bg-neutral-100 dark:hover:bg-slate-600 text-left flex items-center justify-between focus:outline-none focus:bg-neutral-200 dark:focus:bg-slate-500 cursor-pointer"
              onclick={(e) =>{
                contextMenu.close(),
                headerMenu.toggle(
                  e,
                  key,
                  searchManager.getFilterItems(key, assets),
                  i === keys.length - 1 
                )}
              }
            >
              <span class="truncate">{key.replaceAll("_", " ")}</span>
              <span class="ml-1">
                {#if sortManager.key === key}
                  <span>{sortManager.direction === "asc" ? "▲" : "▼"}</span>
                {:else}
                  <span class="invisible group-hover:visible text-neutral-400">▾</span>
                {/if}
              </span>
            </button>

            <!-- Resize handle remains the same -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              class="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 z-50"
              onmousedown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                document.body.style.cursor = "col-resize";
                columnManager.startResize(key, e.clientX);
              }}
              onclick={(e) => e.stopPropagation()}
              ondblclick={(e) => {
                e.stopPropagation();
                columnManager.resetWidth(key);
              }}
            ></div>
          </div>
        {/each}
      </div>

      <div
        class="absolute top-8 w-full"
        style="transform: translateY({virtualScroll.getOffsetY(rowManager)}px);"
      >
        {#each Object.entries(otherUserSelections) as [clientId, position]}
          {@const otherUserOverlay = selection.computeVisualOverlay(
            position,
            position,
            virtualScroll.visibleRange,
            keys,
            columnManager,
            virtualScroll.rowHeight,
          )}
          {#if otherUserOverlay}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- Wrapper: pointer-events-none to allow selection of the cell underneath -->
            <div
              class="absolute pointer-events-none z-50"
              style="
                  top: {otherUserOverlay.top}px;
                  left: {otherUserOverlay.left}px;
                  width: {otherUserOverlay.width}px;
                  height: {otherUserOverlay.height}px;
                  border: 1px solid {position.color};
                  box-sizing: border-box;
                "
            >
              <!-- Badge: pointer-events-auto to allow interaction -->
              <div
                class="absolute flex items-center justify-center text-white text-[10px] rounded-full font-bold shadow-sm overflow-hidden pointer-events-auto cursor-default"
                style="
                  top: -8px;
                  right: -8px;
                  height: 16px;
                  background-color: {position.color};
                  min-width: 16px;
                  max-width: {hoveredUser === clientId ? '200px' : '16px'};
                  transition: max-width 0.2s ease-in-out, background-color 0.2s ease-in-out;
                "
                onmouseenter={() => (hoveredUser = clientId)}
                onmouseleave={() => (hoveredUser = null)}
              >
                <div
                  class="{hoveredUser === clientId
                    ? 'px-1'
                    : ''} whitespace-nowrap"
                >
                  {hoveredUser === clientId
                    ? position.fullName
                    : position.initials}
                </div>
              </div>
            </div>
          {/if}
        {/each}

        {#if copyOverlay}
          <div
            class="absolute pointer-events-none z-20 border-blue-600 dark:border-blue-500"
            style="
            top: {copyOverlay.top}px;
            left: {copyOverlay.left}px; 
            width: {copyOverlay.width}px; 
            height: {copyOverlay.height}px;
            border-top-style: {copyOverlay.showTopBorder ? 'dashed' : 'none'};
  
            border-bottom-style: {copyOverlay.showBottomBorder
              ? 'dashed'
              : 'none'};
            border-left-style: {copyOverlay.showLeftBorder ? 'dashed' : 'none'};
            border-right-style: {copyOverlay.showRightBorder
              ? 'dashed'
              : 'none'};
            border-width: 2px;"
          ></div>
        {/if}

        {#if selectionOverlay}
          <div
            class="absolute pointer-events-none z-10 border-blue-600 dark:border-blue-500 bg-blue-900/10"
            style="
                top: {selectionOverlay.top}px;
                left: {selectionOverlay.left}px; 
       
                width: {selectionOverlay.width}px; 
                height: {selectionOverlay.height}px;
                border-top-style: {selectionOverlay.showTopBorder
              ? 'solid'
              : 'none'};
                border-bottom-style: {selectionOverlay.showBottomBorder
              ? 'solid'
              : 'none'};
                border-left-style: {selectionOverlay.showLeftBorder
              ? 'solid'
              : 'none'};
         
                border-right-style: {selectionOverlay.showRightBorder
              ? 'solid'
              : 'none'};
                border-width: 2px;"
          ></div>
        {/if}

        {#each dirtyCellOverlays as overlay}
          {@const cellKey = `${virtualScroll.getActualIndex(Math.floor(overlay.top / virtualScroll.rowHeight))},${keys[Math.floor(overlay.left / columnManager.getWidth(keys[0]))]}`}
          {@const isInvalid = changeManager.isInvalid(
            assets[
              virtualScroll.getActualIndex(
                Math.floor(overlay.top / virtualScroll.rowHeight),
              )
            ]?.id,
            keys[Math.floor(overlay.left / columnManager.getWidth(keys[0]))],
          )}
          <div
            class="absolute pointer-events-none z-40 border-2
              {isInvalid
              ? 'bg-yellow-400/20 dark:bg-yellow-400/10 border-yellow-500 dark:border-yellow-600'
              : 'bg-green-400/20 dark:bg-green-400/10 border-green-400 dark:border-green-600'}"
            style="
              top: {overlay.top}px;
              left: {overlay.left}px;
              width: {overlay.width}px;
              height: {overlay.height}px;
            "
          ></div>
        {/each}

        {#each visibleData.items as asset, i (asset.id || visibleData.startIndex + i)}
          {@const actualIndex = visibleData.startIndex + i}
          {@const rowHeight = rowManager.getHeight(actualIndex)}
          {@const isNewRow = actualIndex >= filteredAssets.length}

          <div
            class="flex border-b border-neutral-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 {isNewRow ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}"
            style="height: {rowHeight}px;"
          >
            {#each keys as key, j}
              {@const isEditingThisCell = editManager.isEditingCell(
                actualIndex,
                j,
              )}

              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                data-row={actualIndex}
                data-col={j}
                onmousedown={(e) => {
                  if (isEditingThisCell) return;
                  // Don't interfere if we're about to double-click
                  if (e.detail === 2) return;

                  if (editManager.isEditing) {
                    editManager.cancel(columnManager, rowManager);
                    setTimeout(() => {
                      selection.handleMouseDown(actualIndex, j, e);
                    }, 0);
                  } else {
                    selection.handleMouseDown(actualIndex, j, e);
                  }
                }}
                ondblclick={(e) => {
                  if (!data.user) {
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
                    handleEditAction();
                  }
                }}
                onmouseenter={() =>
                  !isEditingThisCell &&
                  selection.extendSelection(actualIndex, j)}
                oncontextmenu={(e) =>
                  !isEditingThisCell && handleContextMenu(e, i, j)}
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
                  <textarea
                    bind:this={textareaRef}
                    bind:value={editManager.inputValue}
                    oninput={() =>
                      editManager.updateRowHeight(
                        textareaRef,
                        rowManager,
                        columnManager,
                      )}
                    onkeydown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        saveEdit();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancelEdit();
                      }
                    }}
                    onmousedown={(e) => {
                      e.stopPropagation();
                    }}
                    onblur={(e) => {
                      // Always save on blur (clicking outside)
                      setTimeout(() => {
                        if (editManager.isEditing) {
                          saveEdit();
                        }
                      }, 0);
                    }}
                    class="w-full h-full resize-none bg-white dark:bg-slate-700 text-neutral-900 dark:text-neutral-100 border-2 border-blue-500 rounded px-1.5 py-1.5 focus:outline-none"
                    style="overflow: hidden;"
                  ></textarea>
                {:else}
                  <span class="truncate w-full">{asset[key]}</span>
                {/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  </div>
  <p class="mt-2 ml-1 text-sm text-neutral-600 dark:text-neutral-300">
    Showing {assets.length} items.
  </p>
{:else if searchManager.error}
  <p class="text-red-500">Error: {searchManager.error}</p>
{:else}
  <div
    class="flex items-center justify-center rounded-lg border border-neutral-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-auto h-[calc(100dvh-8.9rem)] shadow-md relative select-none focus:outline-none"
  >
    <p class="text-lg text-neutral-400">Query successful, but no data was returned.</p>
  </div>
{/if}

<ContextMenu
  state={contextMenu}
  onEdit={handleEditAction}
  onCopy={handleCopy}
  onPaste={handlePaste}
  onFilterByValue={handleFilterByValue}
  onDelete={handleDeleteNewRow}
  showDelete={contextMenu.row >= filteredAssets.length}
/>
