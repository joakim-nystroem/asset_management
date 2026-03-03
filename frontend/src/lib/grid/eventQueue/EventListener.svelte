<script lang="ts">
  import { page } from '$app/state';
  import {
    getUiContext,
    getPendingContext,
    getNewRowContext,
    getQueryContext,
    getSortContext,
  } from '$lib/context/gridContext.svelte';
  import { enqueue } from './eventQueue';

  const uiCtx = getUiContext();
  const pendingCtx = getPendingContext();
  const newRowCtx = getNewRowContext();
  const queryCtx = getQueryContext();
  const sortCtx = getSortContext();

  // ─── COMMIT_UPDATE: existing row edits ─────────────────────────────────────
  $effect(() => {
    if (uiCtx.commitRequested) {
      enqueue(
        {
          type: 'COMMIT_UPDATE',
          payload: {
            changes: $state.snapshot(pendingCtx.edits),
            hasInvalidChanges: pendingCtx.edits.some((e) => !e.isValid),
            user: page.data.user ?? null,
          },
        },
        { pendingCtx },
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
        { pendingCtx, newRowCtx },
      );
      uiCtx.discardRequested = false;
    }
  });

  // ─── QUERY: auto-fire on any queryCtx change (view, search, filters) ──────
  let queryInitialized = false;
  $effect(() => {
    const view = queryCtx.view;
    const q = queryCtx.q;
    const filters = $state.snapshot(queryCtx.filters);

    if (!queryInitialized) {
      queryInitialized = true;
      return;
    }

    sortCtx.key = null;
    enqueue(
      {
        type: 'QUERY',
        payload: { view, q, filters },
      },
      {},
    );
  });
</script>
