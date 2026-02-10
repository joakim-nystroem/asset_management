<script lang="ts">

  import { tick, untrack } from "svelte";
  import { page } from '$app/state';
  import { replaceState } from '$app/navigation';
  import { SvelteURL } from 'svelte/reactivity';

  // --- TYPES ---
  import type { PageProps } from "./$types";
  import type { Filter } from '$lib/utils/data/searchManager.svelte';
  
  // --- COMPONENTS ---
  import ContextMenu from "$lib/utils/ui/contextMenu/contextMenu.svelte";
  import HeaderMenu from "$lib/utils/ui/headerMenu/headerMenu.svelte";
  import EditDropdownComponent from "$lib/utils/ui/editDropdown/editDropdown.svelte";
  import FilterPanel from "$lib/utils/ui/filterPanel/filterPanel.svelte";

  // --- UTILS IMPORTS ---
  import { createInteractionHandler } from "$lib/utils/interaction/interactionHandler";
  
  // --- STATE CLASSES ---
  import { ContextMenuState } from "$lib/utils/ui/contextMenu/contextMenu.svelte.ts";
  import { historyManager } from "$lib/utils/interaction/historyManager.svelte";
  import { createHeaderMenu } from "$lib/utils/ui/headerMenu/headerMenu.svelte.ts";
  import { selection } from "$lib/utils/interaction/selectionManager.svelte";
  import { createClipboard } from "$lib/utils/interaction/clipboardManager.svelte";
  import { createEditDropdown } from "$lib/utils/ui/editDropdown/editDropdown.svelte.ts";
  import { searchManager } from "$lib/utils/data/searchManager.svelte";
  import { sortManager } from "$lib/utils/data/sortManager.svelte";
  import { createVirtualScroll } from "$lib/utils/core/virtualScrollManager.svelte";
  import { columnManager } from "$lib/utils/core/columnManager.svelte";
  import { rowManager } from "$lib/utils/core/rowManager.svelte";
  import { viewManager } from "$lib/utils/core/viewManager.svelte";
  import { editManager } from "$lib/utils/interaction/editManager.svelte";
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
  const editDropdown = createEditDropdown();

  let { data }: PageProps = $props();

  // Clear stale singleton state on page load/refresh
  // (singletons persist across client-side navigation, causing stale data on refresh)
  rowGenerationManager.clearNewRows();
  changeManager.clear();
  historyManager.clear();

  // Always sync view from server data (prevents singleton stale state on navigation)
  // svelte-ignore state_referenced_locally
  viewManager.setView(data.initialView || 'default');

  // --- Data State ---
  // svelte-ignore state_referenced_locally
  let baseAssets: Record<string, any>[] = $state(data.assets);
  // svelte-ignore state_referenced_locally
  let filteredAssets: Record<string, any>[] = $state(data.searchResults ?? data.assets);
  let searchError = $state('');
  let locations = $derived(data.locations || []);
  let statuses = $derived(data.statuses || []);
  let conditions = $derived(data.conditions || []);

  // Combine filtered assets with new rows at the bottom
  let assets = $derived([...filteredAssets, ...rowGenerationManager.newRows]);

  // Check logged in status
  let isLoggedIn = $derived(!!data.user);
  // svelte-ignore state_referenced_locally
  let wasLoggedIn = $state(!!data.user);

  function logOutToast() {
    toastState.addToast("You have been logged out.", "info");
  }

  $effect(() => {
    if (!isLoggedIn && wasLoggedIn) {
      untrack(() => {
        logOutToast();
      });
    }
  })


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

  // Track dirty cells for existing row changes (new row validation is triggered manually on commit)
  $effect(() => {
    const changes = changeManager.getAllChanges();

    if (changes.length === 0) {
      selection.clearDirtyCells();
      return;
    }

    const keyMap = new Map(keys.map((key, index) => [key, index]));
    const assetIdMap = new Map(
      assets.map((asset, index) => [asset.id.toString(), index]),
    );

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

    if (dirtyCells.length === 0) {
      selection.clearDirtyCells();
    } else {
      selection.setDirtyCells(dirtyCells);
    }
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
        1,
        scrollContainer,
        keys,
        columnManager,
        rowManager
      );

      // Select the first cell of the new row
      selection.selectCell(lastRowIndex, 1);
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
  // Reactive URL — SvelteURL makes searchParams deeply reactive
  // (page.url uses $state.raw which is shallow — doesn't react to replaceState changes)
  const reactiveUrl = new SvelteURL(page.url);

  // --- URL-driven search helpers ---
  function updateSearchUrl(params: { q?: string; filters?: Filter[]; view?: string }) {
    // Clear known search params (delete only specific keys to preserve SvelteURL reactive tracking)
    reactiveUrl.searchParams.delete('q');
    reactiveUrl.searchParams.delete('filter');
    reactiveUrl.searchParams.delete('view');
    if (params.q) reactiveUrl.searchParams.set('q', params.q);
    if (params.filters && params.filters.length > 0) {
      params.filters.forEach(f => reactiveUrl.searchParams.append('filter', `${f.key}:${f.value}`));
    }
    // Always include view in URL to prevent flicker on reload
    reactiveUrl.searchParams.set('view', params.view || 'default');
    // Sync to browser URL bar (non-reactive, just visual)
    replaceState(new URL(reactiveUrl), {});
  }

  function parseUrlFilters(filterParams: string[]): Filter[] {
    return filterParams
      .map(f => {
        const colonIndex = f.indexOf(':');
        if (colonIndex === -1) return null;
        return { key: f.slice(0, colonIndex), value: f.slice(colonIndex + 1) };
      })
      .filter((f): f is Filter => f !== null);
  }

  function getCurrentUrlState() {
    const q = reactiveUrl.searchParams.get('q') || '';
    const filters = parseUrlFilters(reactiveUrl.searchParams.getAll('filter'));
    const view = reactiveUrl.searchParams.get('view') || 'default';
    return { q, filters, view };
  }

  // --- View Switching ---
  let viewDropdownOpen = $state(false);

  function handleViewChange(viewName: string) {
    viewDropdownOpen = false;
    if (viewName === viewManager.currentView) return;
    // Just update URL — the URL-driven effect handles view loading, state reset, etc.
    updateSearchUrl({ view: viewName });
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
    // Selection overlay visibility is now automatically derived:
    // hidden when selection is within copy bounds, shown when outside
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

    if (rowGenerationManager.hasNewRows && target.row < filteredAssets.length) {
      toastState.addToast(
        "Please save or discard new rows before pasting into existing rows.",
        "warning",
      );
      return;
    }

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
    const { key, value: filterValue } = contextMenu;
    const { q, filters, view } = getCurrentUrlState();
    // Toggle the filter
    const exists = filters.some(f => f.key === key && f.value === filterValue);
    const newFilters = exists
      ? filters.filter(f => !(f.key === key && f.value === filterValue))
      : [...filters, { key, value: filterValue }];
    updateSearchUrl({ q, filters: newFilters, view });
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

    // Show dropdown for columns with value restrictions
    if (validationManager.hasConstraints(key)) {
      const validValues = validationManager.getValidValues(key);
      editDropdown.show(validValues, currentValue);
    } else {
      editDropdown.hide();
    }

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
      // Existing row - validate first
      const key = keys[pos.col];
      const newValue = editManager.inputValue.trim();

      // Validate the value before saving
      if (!validationManager.isValidValue(key, newValue)) {
        toastState.addToast(
          `Invalid value for ${key}. Please check constraints.`,
          "warning"
        );
        // Don't save, keep editing
        return;
      }

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
      }
    }

    if (pos) selection.selectCell(pos.row, pos.col);
  }

  function cancelEdit() {
    const pos = editManager.getEditPosition();
    editDropdown.hide();
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
        // Manually set dirty cells for invalid new row fields
        const keyMap = new Map(keys.map((key, index) => [key, index]));
        const invalidCells: { row: number; col: number }[] = [];
        const newRows = rowGenerationManager.newRows;

        for (let i = 0; i < newRows.length; i++) {
          const rowIndex = filteredAssets.length + i;
          for (const key of keys) {
            if (key !== 'id' && rowGenerationManager.isNewRowFieldInvalid(i, key)) {
              const col = keyMap.get(key);
              if (col !== undefined) {
                invalidCells.push({ row: rowIndex, col });
              }
            }
          }
        }
        selection.setDirtyCells(invalidCells);

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

      // Save new rows via API
      if (hasNewRows) {
        const newRows = rowGenerationManager.newRows;

        // Prepare rows for API (strip the temporary ID, include all fields)
        const rowsToSave = newRows.map((row) => {
          const { id, ...fields } = row;
          return fields;
        });

        const newRowResponse = await fetch("/asset/api/create/asset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rowsToSave),
        });

        if (!newRowResponse.ok) {
          const errorData = await newRowResponse.json();
          toastState.addToast(
            errorData.error || "Failed to save new rows.",
            "error",
          );
          rowGenerationManager.clearValidation();
          return;
        }

        const { createdRows } = await newRowResponse.json();

        // Add the newly created rows to baseAssets and filteredAssets
        if (createdRows && createdRows.length > 0) {
          baseAssets = [...baseAssets, ...createdRows];
          filteredAssets = [...filteredAssets, ...createdRows];
        }

        rowGenerationManager.clearNewRows();
        selection.clearDirtyCells();

        toastState.addToast(
          `${newRows.length} new ${newRows.length === 1 ? "row" : "rows"} saved successfully.`,
          "success",
        );
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
    selection.clearDirtyCells();
    selection.resetAll();

    toastState.addToast("Changes discarded.", "info");
  }

  // Separate effect for one-time setup (runs only once)
  $effect(() => {
    const cleanupInteraction = mountInteraction(window);

    // Register this page's handler
    realtime.setAssetUpdateHandler(handleRealtimeUpdate);

    return () => {
      cleanupInteraction();

      // CHANGED: Overwrite with an empty function to "remove" the handler
      realtime.setAssetUpdateHandler(() => {});

      // Only clear managers on actual component unmount
      changeManager.clear();
      historyManager.clear();
      rowGenerationManager.clearNewRows();
    };
  });

  // Separate effect for resize observer (depends on scrollContainer)
  $effect(() => {
    let resizeObserver: ResizeObserver | null = null;
    if (scrollContainer) {
      // Reset scroll position to top on page load/refresh
      // (browser may preserve scroll position, but virtual scroller won't have loaded that data)
      scrollContainer.scrollTop = 0;

      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          virtualScroll.updateContainerHeight(entry.contentRect.height);
        }
      });
      resizeObserver.observe(scrollContainer);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
    };
  });

  let skipInitialFetch = true; // Server already returned correct data for initial load
  $effect(() => {
    // Read from reactiveUrl (SvelteURL) — deeply reactive, triggers on searchParams changes
    const q = reactiveUrl.searchParams.get('q') || '';
    const filterParams = reactiveUrl.searchParams.getAll('filter');
    const filters = parseUrlFilters(filterParams);
    const urlView = reactiveUrl.searchParams.get('view') || 'default';

    // Sync searchManager UI state from URL (one-way: URL -> manager)
    // Use untrack to prevent searchManager reactive writes from re-triggering this effect
    untrack(() => {
      searchManager.inputValue = q;
      const currentFiltersJson = JSON.stringify(searchManager.selectedFilters.slice().sort((a, b) => a.key.localeCompare(b.key) || a.value.localeCompare(b.value)));
      const urlFiltersJson = JSON.stringify(filters.slice().sort((a, b) => a.key.localeCompare(b.key) || a.value.localeCompare(b.value)));
      if (currentFiltersJson !== urlFiltersJson) {
        searchManager.setSelectedFilters(filters);
      }
    });

    // On initial mount, server already returned correct data — skip fetching
    if (skipInitialFetch) {
      skipInitialFetch = false;
      return;
    }

    // Stale request guard
    let cancelled = false;

    (async () => {
      // Handle view change if needed (load view data FIRST before search)
      // Use untrack for viewManager reads/writes — we only want this effect to react to URL changes,
      // not to viewManager state changes (which would cancel the async fetch)
      const validViews = untrack(() => viewManager.views.map(v => v.name));
      const currentView = untrack(() => viewManager.currentView);
      if (urlView !== currentView) {
        if (validViews.includes(urlView)) {
          untrack(() => viewManager.setView(urlView));
          try {
            const response = await fetch(`/asset/api/assets/view?view=${urlView}`);
            if (cancelled) return;
            if (response.ok) {
              const result = await response.json();
              baseAssets = result.assets;
              // If no search params, show view data directly and we're done
              if (!q && filters.length === 0) {
                filteredAssets = result.assets;
                searchError = '';
                selection.reset();
                sortManager.invalidateCache();
                sortManager.reset();
                changeManager.clear();
                historyManager.clear();
                rowGenerationManager.clearNewRows();
                return;
              }
            }
          } catch (err) {
            if (cancelled) return;
            console.error(`Failed to load ${urlView} view:`, err);
          }
        } else {
          untrack(() => viewManager.setView('default'));
        }
      }

      // Handle search/filter state
      if (!q && filters.length === 0) {
        // No search params — show all base data
        filteredAssets = [...baseAssets];
        searchError = '';
        sortManager.invalidateCache();
        sortManager.reset();
        selection.reset();
      } else {
        // Has search params — fetch from search API
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        filters.forEach(f => params.append('filter', `${f.key}:${f.value}`));

        try {
          const response = await fetch(`/asset/api/search?${params.toString()}`);
          if (cancelled) return;
          if (!response.ok) throw new Error(`API Error: ${response.status}`);
          const result = await response.json();

          // Discard pending changes when search results change
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
          if (rowGenerationManager.hasNewRows) {
            rowGenerationManager.clearNewRows();
          }
          filteredAssets = result || [];
          searchError = '';
          selection.reset();
          sortManager.invalidateCache();
          sortManager.reset();
        } catch (err) {
          if (cancelled) return;
          searchError = err instanceof Error ? err.message : 'Search failed';
          console.error('Search failed:', err);
        }
      }
    })();

    return () => { cancelled = true; };
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

<div class="px-4 py-2 flex-grow flex flex-col">
<div class="flex flex-col gap-2 mb-3">
  <div class="flex flex-row gap-4 items-center">

    <div class="flex gap-4 items-center">
      <div class="relative">
        <input
          bind:value={searchManager.inputValue}
          class="bg-white dark:bg-neutral-100 dark:text-neutral-700 placeholder-neutral-500! p-1 pr-7 border border-neutral-300 dark:border-none focus:outline-none"
          placeholder="Search..."
          onkeydown={(e) => {
            if (e.key === "Enter") {
              const { filters, view } = getCurrentUrlState();
              updateSearchUrl({ q: searchManager.inputValue, filters, view });
            }
          }}
        />
        {#if searchManager.inputValue}
          <button
            onclick={() => {
              searchManager.inputValue = '';
              const { filters, view } = getCurrentUrlState();
              updateSearchUrl({ q: '', filters, view });
            }}
            class="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-700 cursor-pointer font-bold text-xs"
            title="Clear search"
          >
            ✕
          </button>
        {/if}
      </div>
      <button
        onclick={() => {
          const { filters, view } = getCurrentUrlState();
          updateSearchUrl({ q: searchManager.inputValue, filters, view });
        }}
        class="cursor-pointer bg-blue-500 hover:bg-blue-600 px-2 py-1 rounded text-neutral-100"
        >Search</button
      >
    </div>

    <div class="flex flex-row w-full justify-between items-center">
      <div class="flex flex-row gap-2">
        <FilterPanel
          state={filterPanel}
          {searchManager}
          onRemoveFilter={(filter) => {
            const { q, filters, view } = getCurrentUrlState();
            const newFilters = filters.filter(f => !(f.key === filter.key && f.value === filter.value));
            updateSearchUrl({ q, filters: newFilters, view });
          }}
          onClearAllFilters={() => {
            const { q, view } = getCurrentUrlState();
            updateSearchUrl({ q, filters: [], view });
          }}
        />
        {#if data.user}
          <button
            onclick={handleAddNewRow}
            class="flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-600 hover:bg-neutral-50 dark:hover:bg-slate-700 text-sm cursor-pointer"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v12m6-6H6"></path></svg>
            <span>New Row</span>
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

      <!-- View Selector Dropdown -->
      <div class="relative">
        <button
          onclick={() => viewDropdownOpen = !viewDropdownOpen}
          class="flex items-center gap-1 px-3 py-1.5 rounded bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-600 hover:bg-neutral-50 dark:hover:bg-slate-700 text-sm cursor-pointer"
        >
          <span>{viewManager.currentLabel}</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        {#if viewDropdownOpen}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <div
            class="fixed inset-0 z-40"
            onclick={() => viewDropdownOpen = false}
          ></div>
          <div class="absolute right-0 mt-1 w-40 bg-white dark:bg-slate-800 border border-neutral-300 dark:border-slate-600 rounded shadow-lg z-50">
            {#each viewManager.views as view}
              <button
                onclick={() => handleViewChange(view.name)}
                class="w-full text-left px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-slate-700 cursor-pointer {viewManager.currentView === view.name ? 'bg-blue-50 dark:bg-blue-900/30 font-medium' : ''}"
              >
                {view.label}
              </button>
            {/each}
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
      onFilterSelect={(item, key) => {
        const { q, filters, view } = getCurrentUrlState();
        const exists = filters.some(f => f.key === key && f.value === item);
        const newFilters = exists
          ? filters.filter(f => !(f.key === key && f.value === item))
          : [...filters, { key, value: item }];
        updateSearchUrl({ q, filters: newFilters, view });
      }}
    />

    <div
      class="w-max min-w-full bg-white dark:bg-slate-800 text-left relative"
      style="height: {virtualScroll.getTotalHeight(assets.length, rowManager) +
        32 + 16}px;"
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

        {#if selectionOverlay && selection.isSelectionVisible}
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
          {@const overlayRowIndex = virtualScroll.visibleRange.startIndex + Math.floor(overlay.top / virtualScroll.rowHeight)}
          {@const overlayColIndex = (() => {
            let accWidth = 0;
            for (let c = 0; c < keys.length; c++) {
              const colWidth = columnManager.getWidth(keys[c]);
              if (overlay.left < accWidth + colWidth) return c;
              accWidth += colWidth;
            }
            return 0;
          })()}
          {@const overlayKey = keys[overlayColIndex]}
          {@const overlayAsset = assets[overlayRowIndex]}
          {@const isNewRowOverlay = overlayRowIndex >= filteredAssets.length}
          {@const isInvalid = isNewRowOverlay
            ? rowGenerationManager.isNewRowFieldInvalid(overlayRowIndex - filteredAssets.length, overlayKey)
            : changeManager.isInvalid(overlayAsset?.id, overlayKey)}
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
            class="flex border-b border-neutral-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700 {isNewRow ? 'bg-blue-200 dark:bg-blue-500/20' : ''}"
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
                onmousedown={async (e) => {
                  if (isEditingThisCell) return;
                  // Don't interfere if we're about to double-click
                  if (e.detail === 2) return;

                  if (editManager.isEditing) {
                    // Save the current edit and select new cell without drag mode
                    await saveEdit();
                    selection.selectCell(actualIndex, j);
                    return;
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
                  <div class="relative w-full h-full">
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
                            saveEdit();
                            return;
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            editDropdown.hide();
                            cancelEdit();
                            return;
                          }
                        }

                        // Normal keyboard handling when dropdown not visible
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
                    <EditDropdownComponent
                      dropdown={editDropdown}
                      onSelect={(value) => {
                        editManager.inputValue = value;
                        editDropdown.hide();
                        saveEdit();
                      }}
                    />
                  </div>
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
{:else if searchError}
  <p class="text-red-500">Error: {searchError}</p>
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
</div>
