<script lang="ts">
  import {
    getEditingContext,
    getSelectionContext,
    getColumnContext,
    getDataContext,
    getViewContext,
    getUiContext,
    getChangeControllerContext,
    getHistoryControllerContext,
  } from '$lib/context/gridContext.svelte.ts';
  import { createSelectionController } from '$lib/grid/utils/gridSelection.svelte.ts';
  import { createColumnController } from '$lib/grid/utils/gridColumns.svelte.ts';
  import { createRowGenerationController } from '$lib/grid/utils/rowGeneration.svelte.ts';
  import { createClipboardController } from '$lib/grid/utils/gridClipboard.svelte.ts';
  import { createEditController } from '$lib/grid/utils/gridEdit.svelte.ts';
  import { realtime } from '$lib/utils/interaction/realtimeManager.svelte';
  import { gridShortcuts } from '$lib/grid/utils/gridShortcuts.svelte.ts';
  import FloatingEditor from '$lib/grid/components/floating-editor/FloatingEditor.svelte';

  const editCtx = getEditingContext();
  const selCtx = getSelectionContext();
  const colCtx = getColumnContext();
  const dataCtx = getDataContext();
  const viewCtx = getViewContext();
  const uiCtx = getUiContext();

  const selection = createSelectionController();
  const columns = createColumnController();
  const changes = getChangeControllerContext();
  const rowGen = createRowGenerationController();
  const clipboard = createClipboardController();
  const history = getHistoryControllerContext();
  const edit = createEditController();

  // GridOverlays accepts no data props. F2.5: 0 data props.
  // onHoverUser is a local interaction — handled entirely within this component.
  let hoveredUser: string | null = $state(null);

  // --- Stable shortcutState object (must NOT be an inline literal in template) ---
  // Properties are reactive objects; the wrapper object reference stays stable.
  // This prevents the {@attach} from re-running on every render.
  const shortcutState = {
    get selection() { return selection; },
    get columns() { return columns; },
    get contextMenu() { return uiCtx.contextMenu; },
    get headerMenu() { return uiCtx.headerMenu; },
  };

  // Callbacks use domain contexts and controllers directly — no pageActions needed.
  const callbacks = {
    get onCopy() {
      return () => {
        clipboard.copy(dataCtx.assets, colCtx.keys);
        if (uiCtx.contextMenu?.visible) uiCtx.contextMenu.close();
      };
    },
    get onPaste() {
      return async () => {
        const target = selection.anchor;
        if (!target) return;
        const result = await clipboard.paste(target, dataCtx.assets, colCtx.keys);
        if (result && result.changes.length > 0) {
          for (const change of result.changes) {
            changes.update(change);
          }
          history.recordBatch(result.changes);
        }
        if (uiCtx.contextMenu?.visible) uiCtx.contextMenu.close();
      };
    },
    get onUndo() {
      return () => {
        const batch = history.undo(dataCtx.assets);
        if (batch) {
          for (const action of batch) {
            changes.update({
              id: action.id,
              key: action.key,
              newValue: action.oldValue,
              oldValue: action.newValue,
            });
          }
        }
      };
    },
    get onRedo() {
      return () => {
        const batch = history.redo(dataCtx.assets);
        if (batch) {
          for (const action of batch) {
            changes.update(action);
          }
        }
      };
    },
    get onEscape() {
      return () => {
        if (editCtx.isEditing) {
          edit.cancel();
          return;
        }
        if (selection.hasSelection) {
          selection.resetAll();
        }
        clipboard.clear();
        if (uiCtx.contextMenu?.visible) uiCtx.contextMenu.close();
        if (uiCtx.headerMenu?.activeKey) uiCtx.headerMenu.close();
      };
    },
    get onEdit() {
      return () => {
        const target = selection.anchor;
        if (!target) return;
        const key = colCtx.keys[target.col];
        const asset = dataCtx.assets[target.row];
        if (!asset || !key || key === 'id') return;
        const currentValue = String(asset[key] ?? '');
        edit.startEdit(target.row, target.col, key, currentValue);
      };
    },
    get onScrollIntoView() {
      return (row: number, _col: number) => { viewCtx.scrollToRow = row; };
    },
    get getGridSize() {
      return () => ({ rows: dataCtx.assets.length, cols: colCtx.keys.length });
    },
  };

  // --- Overlay derivations ---

  const selectionOverlay = $derived(
    selection.computeVisualOverlay(
      selection.start,
      selection.end,
      viewCtx.virtualScroll.visibleRange,
      colCtx.keys,
      (key) => columns.getWidth(key),
      viewCtx.virtualScroll.rowHeight,
    )
  );

  const copyOverlay = $derived(
    selection.isCopyVisible
      ? selection.computeVisualOverlay(
          selection.copyStart,
          selection.copyEnd,
          viewCtx.virtualScroll.visibleRange,
          colCtx.keys,
          (key) => columns.getWidth(key),
          viewCtx.virtualScroll.rowHeight,
        )
      : null
  );

  const dirtyCellOverlays = $derived(
    selection.computeDirtyCellOverlays(
      viewCtx.virtualScroll.visibleRange,
      colCtx.keys,
      (key) => columns.getWidth(key),
      viewCtx.virtualScroll.rowHeight,
      (row, col) => {
        const asset = dataCtx.assets[row];
        if (!asset) return false;
        const key = colCtx.keys[col];
        const isNewRow = row >= dataCtx.filteredAssetsCount;
        if (isNewRow) {
          const newRowIndex = row - dataCtx.filteredAssetsCount;
          return rowGen.isNewRowFieldInvalid(newRowIndex, key);
        }
        return changes.isInvalid(asset.id, key);
      },
    )
  );

  const otherUserSelections = $derived(
    Object.entries(realtime.connectedUsers).reduce(
      (acc, [clientId, position]) => {
        // Map asset ID to current row index in combined assets array
        let rowIndex = -1;
        if (position.assetId !== undefined) {
          rowIndex = dataCtx.assets.findIndex((a: Record<string, any>) => a.id === position.assetId);
        } else {
          // Fallback for old clients: use position.row directly
          rowIndex = position.row;
        }
        if (rowIndex === -1) return acc;
        acc[clientId] = {
          ...position,
          row: rowIndex,
          initials: (
            (position.firstname?.[0] || '') + (position.lastname?.[0] || '')
          ).toUpperCase(),
          fullName: `${position.firstname?.[0]?.toUpperCase() || ''}${position.firstname?.slice(1) || ''} ${position.lastname?.[0]?.toUpperCase() || ''}${position.lastname?.slice(1) || ''}`.trim(),
          editing: Object.entries(realtime.lockedCells).some(
            ([, lock]) => lock.userId === clientId
          ),
        };
        return acc;
      },
      {} as Record<string, any>
    )
  );
</script>

<!--
  Root div: holds focus for keyboard capture (tabindex=-1).
  {@attach gridShortcuts(...)} mounts window listeners via createInteractionHandler
  and returns cleanup automatically on unmount.
  class="contents" — no layout box added; overlays position relative to parent positioned ancestor.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="contents"
  tabindex="-1"
  {@attach gridShortcuts(shortcutState, callbacks)}
>
  {#each Object.entries(otherUserSelections) as [clientId, position]}
    {@const otherUserOverlay = selection.computeVisualOverlay(
      position,
      position,
      viewCtx.virtualScroll.visibleRange,
      colCtx.keys,
      (key) => columns.getWidth(key),
      viewCtx.virtualScroll.rowHeight,
    )}
    {#if otherUserOverlay}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute pointer-events-none z-50"
        style="
            top: {otherUserOverlay.top}px;
            left: {otherUserOverlay.left}px;
            width: {otherUserOverlay.width}px;
            height: {otherUserOverlay.height}px;
            border: {position.editing ? '2px' : '1px'} solid {position.color};
            box-sizing: border-box;
          "
      >
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
          onmouseenter={() => hoveredUser = clientId}
          onmouseleave={() => hoveredUser = null}
        >
          <div class="{hoveredUser === clientId ? 'px-1' : ''} whitespace-nowrap">
            {#if position.editing}
              {hoveredUser === clientId ? `${position.fullName} editing...` : '...'}
            {:else}
              {hoveredUser === clientId ? position.fullName : position.initials}
            {/if}
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
      border-bottom-style: {copyOverlay.showBottomBorder ? 'dashed' : 'none'};
      border-left-style: {copyOverlay.showLeftBorder ? 'dashed' : 'none'};
      border-right-style: {copyOverlay.showRightBorder ? 'dashed' : 'none'};
      border-width: 2px;"
    ></div>
  {/if}

  {#if selectionOverlay && selCtx.selectionStart.row !== -1 && !selCtx.isHiddenAfterCopy}
    <div
      class="absolute pointer-events-none z-10 border-blue-600 dark:border-blue-500 bg-blue-900/10"
      style="
          top: {selectionOverlay.top}px;
          left: {selectionOverlay.left}px;
          width: {selectionOverlay.width}px;
          height: {selectionOverlay.height}px;
          border-top-style: {selectionOverlay.showTopBorder ? 'solid' : 'none'};
          border-bottom-style: {selectionOverlay.showBottomBorder ? 'solid' : 'none'};
          border-left-style: {selectionOverlay.showLeftBorder ? 'solid' : 'none'};
          border-right-style: {selectionOverlay.showRightBorder ? 'solid' : 'none'};
          border-width: 2px;"
    ></div>
  {/if}

  {#each dirtyCellOverlays as overlay}
    {@const overlayRowIndex = viewCtx.virtualScroll.visibleRange.startIndex + Math.floor(overlay.top / viewCtx.virtualScroll.rowHeight)}
    {@const overlayColIndex = (() => {
      let accWidth = 0;
      for (let c = 0; c < colCtx.keys.length; c++) {
        const colWidth = columns.getWidth(colCtx.keys[c]);
        if (overlay.left < accWidth + colWidth) return c;
        accWidth += colWidth;
      }
      return 0;
    })()}
    {@const overlayKey = colCtx.keys[overlayColIndex]}
    {@const overlayAsset = dataCtx.assets[overlayRowIndex]}
    {@const isNewRowOverlay = overlayRowIndex >= dataCtx.filteredAssetsCount}
    {@const isInvalid = isNewRowOverlay
      ? rowGen.isNewRowFieldInvalid(overlayRowIndex - dataCtx.filteredAssetsCount, overlayKey)
      : changes.isInvalid(overlayAsset?.id, overlayKey)}
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

  {#if editCtx.isEditing}
    <FloatingEditor onSave={(change) => {
      history.record(change.id, change.key, change.oldValue, change.newValue);
      changes.update(change);
    }} />
  {/if}
</div>
