<script lang="ts">
  import { page } from '$app/state';
  import {
    getUiContext,
    getEditContext,
    getNewRowContext,
    getViewContext,
  } from '$lib/context/gridContext.svelte';
  import { enqueue } from './eventQueue';
  import { searchManager } from '$lib/data/searchManager.svelte';

  const uiCtx = getUiContext();
  const editCtx = getEditContext();
  const newRowCtx = getNewRowContext();
  const viewCtx = getViewContext();

  // ─── COMMIT_UPDATE: existing row edits ─────────────────────────────────────
  $effect(() => {
    if (uiCtx.commitRequested) {
      enqueue(
        {
          type: 'COMMIT_UPDATE',
          payload: {
            changes: $state.snapshot(editCtx.edits),
            hasInvalidChanges: !editCtx.isValid,
            user: page.data.user ?? null,
          },
        },
        { editCtx },
      );
      uiCtx.commitRequested = false;
    }
  });

  // ─── COMMIT_CREATE: new row creation ───────────────────────────────────────
  $effect(() => {
    if (uiCtx.commitCreateRequested) {
      enqueue(
        {
          type: 'COMMIT_CREATE',
          payload: {
            rows: $state.snapshot(newRowCtx.newRows),
            user: page.data.user ?? null,
          },
        },
        { newRowCtx },
      );
      uiCtx.commitCreateRequested = false;
    }
  });

  // ─── DISCARD: revert uncommitted changes ───────────────────────────────────
  $effect(() => {
    if (uiCtx.discardRequested) {
      enqueue(
        {
          type: 'DISCARD',
          payload: {
            user: page.data.user ?? null,
          },
        },
        { editCtx, newRowCtx },
      );
      uiCtx.discardRequested = false;
    }
  });

  // ─── FILTER: search/filter request ─────────────────────────────────────────
  $effect(() => {
    if (uiCtx.searchRequested) {
      enqueue(
        {
          type: 'FILTER',
          payload: {
            q: searchManager.inputValue,
            filters: $state.snapshot(searchManager.selectedFilters),
            view: viewCtx.activeView,
          },
        },
        {},
      );
      uiCtx.searchRequested = false;
    }
  });
</script>
