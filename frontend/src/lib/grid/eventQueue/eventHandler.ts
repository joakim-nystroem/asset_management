// frontend/src/lib/grid/eventQueue/eventHandler.ts
// Pure TypeScript event router. No Svelte, no getContext(), no runes.
// Receives event + context proxies. Target functions mutate proxies directly.

import { toastState } from '$lib/toast/toastState.svelte';
import { assetStore } from '$lib/data/assetStore.svelte';

// ─── API helpers ────────────────────────────────────────────────────────────

type ApiResult = { success: true; data: any } | { success: false; data: null };

async function apiFetch(endpoint: string, params?: URLSearchParams): Promise<ApiResult> {
  try {
    const url = params ? `${endpoint}?${params.toString()}` : endpoint;
    const response = await fetch(url);
    if (!response.ok) return { success: false, data: null };
    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    console.error(`Fetch failed for ${endpoint}:`, err);
    return { success: false, data: null };
  }
}

async function apiPost(endpoint: string, body: any): Promise<ApiResult> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) return { success: false, data: null };
    const data = await response.json();
    return { success: true, data };
  } catch (err) {
    console.error(`Post failed for ${endpoint}:`, err);
    return { success: false, data: null };
  }
}

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

    case 'QUERY':
      await handleQuery(event.payload, contexts);
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
  const { pendingCtx } = contexts;
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
    rowId: c.row,
    columnId: c.col,
    newValue: c.value,
    oldValue: c.original,
  }));

  const res = await apiPost('/api/update', apiChanges);
  if (!res.success) {
    toastState.addToast('Failed to commit changes.', 'error');
    return;
  }

  // Apply committed values to the live assets
  for (const change of changes) {
    const filtered = assetStore.filteredAssets.find((a: any) => a.id === change.row);
    if (filtered) filtered[change.col] = change.value;
    const base = assetStore.baseAssets.find((a: any) => a.id === change.row);
    if (base) base[change.col] = change.value;
  }

  pendingCtx.edits = [];
  toastState.addToast('Changes saved successfully.', 'success');
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

  const res = await apiPost('/api/create/asset', rowsToSave);
  if (!res.success) {
    toastState.addToast('Failed to save new rows.', 'error');
    return;
  }

  newRowCtx.newRows = [];
  newRowCtx.hasNewRows = false;
  assetStore.baseAssets = assetStore.filteredAssets.map((a: Record<string, any>) => ({ ...a }));
  toastState.addToast(`${rows.length} new rows saved successfully.`, 'success');
}

async function handleQuery(
  payload: Record<string, any>,
  _contexts: Record<string, any>,
): Promise<void> {
  const { view, q, filters } = payload;

  const params = new URLSearchParams();
  params.set('view', view || 'default');
  if (q) params.set('q', q);
  if (filters) {
    for (const f of filters) {
      params.append('filter', `${f.key}:${f.value}`);
    }
  }

  const hasFilters = q || (filters && filters.length > 0);
  const res = await apiFetch('/api/assets', params);

  if (!res.success) {
    toastState.addToast('Query failed. Please try again.', 'error');
    return;
  }

  if (hasFilters) {
    assetStore.filteredAssets = res.data.assets;
  } else {
    assetStore.baseAssets = res.data.assets;
    assetStore.filteredAssets = res.data.assets;
  }
}

function handleDiscard(
  payload: Record<string, any>,
  contexts: Record<string, any>,
): void {
  const { pendingCtx, newRowCtx } = contexts;
  const { user } = payload;

  if (!user) {
    toastState.addToast('Log in to edit.', 'warning');
    return;
  }

  pendingCtx.edits = [];
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
