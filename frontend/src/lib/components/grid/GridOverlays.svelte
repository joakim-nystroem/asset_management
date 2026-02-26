<script lang="ts">
  import { getGridContext } from '$lib/context/gridContext.svelte.ts';
  import { createSelectionController } from '$lib/grid/utils/gridSelection.svelte.ts';
  import { createColumnController } from '$lib/grid/utils/gridColumns.svelte.ts';
  import { createChangeController } from '$lib/grid/utils/gridChanges.svelte.ts';
  import { createRowGenerationController } from '$lib/grid/utils/rowGeneration.svelte.ts';
  import { realtime } from '$lib/utils/interaction/realtimeManager.svelte';
  import { gridShortcuts } from '$lib/grid/utils/gridShortcuts.svelte.ts';
  import FloatingEditor from '$lib/grid/components/floating-editor/FloatingEditor.svelte';

  const ctx = getGridContext();
  const selection = createSelectionController();
  const columns = createColumnController();
  const changes = createChangeController();
  const rowGen = createRowGenerationController();

  // GridOverlays accepts no data props. F2.5: 0 data props.
  // onHoverUser is a local interaction — handled entirely within this component.
  let hoveredUser: string | null = $state(null);

  // --- Stable shortcutState object (must NOT be an inline literal in template) ---
  // Properties are reactive objects; the wrapper object reference stays stable.
  // This prevents the {@attach} from re-running on every render.
  const shortcutState = {
    get selection() { return selection; },
    get columns() { return columns; },
    get contextMenu() { return ctx.contextMenu; },
    get headerMenu() { return ctx.headerMenu; },
  };

  // Callbacks come from ctx.pageActions (set by +page.svelte after controller init)
  const callbacks = {
    get onCopy() { return ctx.pageActions?.onCopy ?? (() => {}); },
    get onPaste() { return ctx.pageActions?.onPaste ?? (() => {}); },
    get onUndo() { return ctx.pageActions?.onUndo ?? (() => {}); },
    get onRedo() { return ctx.pageActions?.onRedo ?? (() => {}); },
    get onEscape() { return ctx.pageActions?.onEscape ?? (() => {}); },
    get onEdit() {
      return ctx.pageActions?.onEditAction
        ? () => ctx.pageActions!.onEditAction('f2', ctx.selectionStart.row, ctx.selectionStart.col)
        : () => {};
    },
    get onScrollIntoView() {
      return (row: number, _col: number) => { ctx.scrollToRow = row; };
    },
    get getGridSize() {
      return () => ({ rows: ctx.assets.length, cols: ctx.keys.length });
    },
  };

  // --- Overlay derivations ---

  const selectionOverlay = $derived(
    selection.computeVisualOverlay(
      selection.start,
      selection.end,
      ctx.virtualScroll.visibleRange,
      ctx.keys,
      (key) => columns.getWidth(key),
      ctx.virtualScroll.rowHeight,
    )
  );

  const copyOverlay = $derived(
    selection.isCopyVisible
      ? selection.computeVisualOverlay(
          selection.copyStart,
          selection.copyEnd,
          ctx.virtualScroll.visibleRange,
          ctx.keys,
          (key) => columns.getWidth(key),
          ctx.virtualScroll.rowHeight,
        )
      : null
  );

  const dirtyCellOverlays = $derived(
    selection.computeDirtyCellOverlays(
      ctx.virtualScroll.visibleRange,
      ctx.keys,
      (key) => columns.getWidth(key),
      ctx.virtualScroll.rowHeight,
      (row, col) => {
        const asset = ctx.assets[row];
        if (!asset) return false;
        const key = ctx.keys[col];
        const isNewRow = row >= ctx.filteredAssetsCount;
        if (isNewRow) {
          const newRowIndex = row - ctx.filteredAssetsCount;
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
          rowIndex = ctx.assets.findIndex((a: Record<string, any>) => a.id === position.assetId);
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
      ctx.virtualScroll.visibleRange,
      ctx.keys,
      (key) => columns.getWidth(key),
      ctx.virtualScroll.rowHeight,
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

  {#if selectionOverlay && ctx.selectionStart.row !== -1 && !ctx.isHiddenAfterCopy}
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
    {@const overlayRowIndex = ctx.virtualScroll.visibleRange.startIndex + Math.floor(overlay.top / ctx.virtualScroll.rowHeight)}
    {@const overlayColIndex = (() => {
      let accWidth = 0;
      for (let c = 0; c < ctx.keys.length; c++) {
        const colWidth = columns.getWidth(ctx.keys[c]);
        if (overlay.left < accWidth + colWidth) return c;
        accWidth += colWidth;
      }
      return 0;
    })()}
    {@const overlayKey = ctx.keys[overlayColIndex]}
    {@const overlayAsset = ctx.assets[overlayRowIndex]}
    {@const isNewRowOverlay = overlayRowIndex >= ctx.filteredAssetsCount}
    {@const isInvalid = isNewRowOverlay
      ? rowGen.isNewRowFieldInvalid(overlayRowIndex - ctx.filteredAssetsCount, overlayKey)
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

  {#if ctx.isEditing}
    <FloatingEditor />
  {/if}
</div>
