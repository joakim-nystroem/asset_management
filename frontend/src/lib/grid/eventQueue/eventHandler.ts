// frontend/src/lib/grid/eventQueue/eventHandler.ts
// Pure TypeScript event router. No Svelte, no getContext(), no runes.
// Receives event + context proxies. Target functions mutate proxies directly.

import { toastState } from '$lib/components/toast/toastState.svelte';
import { assetStore } from '$lib/data/assetStore.svelte';

// ─── Router ─────────────────────────────────────────────────────────────────

export async function processEvent(
  event: { type: string; payload: Record<string, any> },
  contexts: Record<string, any>,
): Promise<void> {
  switch (event.type) {
    case 'COMMIT_UPDATE':
      await handleCommitUpdate(event.payload, contexts);
      break;

    case 'COMMIT_CREATE':
      await handleCommitCreate(event.payload, contexts);
      break;

    case 'FILTER':
      await handleFilter(event.payload, contexts);
      break;

    case 'VIEW_CHANGE':
      await handleViewChange(event.payload, contexts);
      break;

    case 'DISCARD':
      handleDiscard(event.payload, contexts);
      break;

    case 'WS_DELTA':
      handleWsDelta(event.payload, contexts);
      break;

    default:
      console.warn(`[EventHandler] unhandled event type: ${event.type}`);
  }
}

// ─── Target Functions ───────────────────────────────────────────────────────
// Each receives a self-contained payload + only the context proxies it needs.
// Mutates proxies directly on success — UI updates instantly.

async function handleCommitUpdate(
  payload: Record<string, any>,
  contexts: Record<string, any>,
): Promise<void> {
  const { editCtx } = contexts;
  const { changes, hasInvalidChanges, user } = payload;

  if (!user) {
    toastState.addToast('Log in to edit.', 'warning');
    return;
  }
  if (hasInvalidChanges) {
    toastState.addToast('Cannot commit: Fix all invalid values first.', 'error');
    return;
  }
  if (!changes || changes.length === 0) return;

  const apiChanges = changes.map((c: any) => ({
    rowId: c.id,
    columnId: c.key,
    newValue: c.newValue,
    oldValue: c.oldValue,
  }));

  try {
    const response = await fetch('/api/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(apiChanges),
    });

    if (!response.ok) {
      console.error('Commit failed:', await response.text());
      toastState.addToast('Failed to commit changes. See console for details.', 'error');
      return;
    }

    // Mutate the Svelte 5 proxy directly — UI updates instantly
    editCtx.edits = [];
    editCtx.hasUnsavedChanges = false;
    editCtx.isValid = true;
    toastState.addToast('Changes saved successfully.', 'success');
  } catch (error) {
    console.error('Commit failed:', error);
    toastState.addToast('Network error while committing changes.', 'error');
  }
}

async function handleCommitCreate(
  payload: Record<string, any>,
  contexts: Record<string, any>,
): Promise<void> {
  const { newRowCtx } = contexts;
  const { rows, user } = payload;

  if (!user) {
    toastState.addToast('Log in to edit.', 'warning');
    return;
  }
  if (!rows || rows.length === 0) return;

  const rowsToSave = rows.map((row: any) => {
    const { id, ...fields } = row;
    return fields;
  });

  try {
    const response = await fetch('/api/create/asset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rowsToSave),
    });

    if (!response.ok) {
      const errorData = await response.json();
      toastState.addToast(errorData.error || 'Failed to save new rows.', 'error');
      return;
    }

    // Mutate the Svelte 5 proxy directly
    newRowCtx.newRows = [];
    newRowCtx.hasNewRows = false;
    toastState.addToast(`${rows.length} new rows saved successfully.`, 'success');
  } catch (error) {
    console.error('Add rows failed:', error);
    toastState.addToast('Network error while adding new rows.', 'error');
  }
}

async function handleFilter(
  payload: Record<string, any>,
  _contexts: Record<string, any>,
): Promise<void> {
  const { q, filters, view } = payload;

  if (!q && (!filters || filters.length === 0)) {
    assetStore.filteredAssets = assetStore.baseAssets;
    return;
  }

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (filters) {
    for (const f of filters) {
      params.append('filter', `${f.key}:${f.value}`);
    }
  }
  params.set('view', view || 'default');

  try {
    const response = await fetch(`/api/assets?${params.toString()}`);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const result = await response.json();

    assetStore.filteredAssets = result.assets;
  } catch (err) {
    console.error('Search failed:', err);
    toastState.addToast('Search failed. Please try again.', 'error');
  }
}

async function handleViewChange(
  payload: Record<string, any>,
  _contexts: Record<string, any>,
): Promise<void> {
  const { view, q, filters } = payload;
  const validViews = ['default', 'audit', 'ped', 'galaxy', 'network'];

  if (!validViews.includes(view)) return;

  try {
    const response = await fetch(`/api/assets?view=${view}`);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const result = await response.json();

    assetStore.baseAssets = result.assets;

    if (!q && (!filters || filters.length === 0)) {
      assetStore.filteredAssets = result.assets;
      return;
    }

    const filterParams = new URLSearchParams();
    if (q) filterParams.set('q', q);
    if (filters) {
      for (const f of filters) {
        filterParams.append('filter', `${f.key}:${f.value}`);
      }
    }
    filterParams.set('view', view);

    const filterResponse = await fetch(`/api/assets?${filterParams.toString()}`);
    if (!filterResponse.ok) throw new Error(`API Error: ${filterResponse.status}`);
    const filterResult = await filterResponse.json();

    assetStore.filteredAssets = filterResult.assets;
  } catch (err) {
    console.error(`Failed to load ${view} view:`, err);
    toastState.addToast(`Failed to load ${view} view.`, 'error');
  }
}

function handleDiscard(
  payload: Record<string, any>,
  contexts: Record<string, any>,
): void {
  const { editCtx, newRowCtx } = contexts;
  const { user } = payload;

  if (!user) {
    toastState.addToast('Log in to edit.', 'warning');
    return;
  }

  // Mutate proxies directly
  editCtx.edits = [];
  editCtx.hasUnsavedChanges = false;
  editCtx.isValid = true;
  newRowCtx.newRows = [];
  newRowCtx.hasNewRows = false;
  toastState.addToast('Changes discarded.', 'info');
}

function handleWsDelta(
  payload: Record<string, any>,
  _contexts: Record<string, any>,
): void {
  const { id, key, value } = payload;
  const row = assetStore.filteredAssets.find((a: any) => a.id === id);
  if (row) row[key] = value;

  const baseRow = assetStore.baseAssets.find((a: any) => a.id === id);
  if (baseRow) baseRow[key] = value;
}
