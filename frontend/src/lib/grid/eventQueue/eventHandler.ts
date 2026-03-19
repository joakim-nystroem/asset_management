// frontend/src/lib/grid/eventQueue/eventHandler.ts
// Pure TypeScript event router. No Svelte, no getContext(), no runes.
// Receives event + context proxies. Target functions mutate proxies directly.

import { toastState } from '$lib/toast/toastState.svelte';
import { assetStore } from '$lib/data/assetStore.svelte';
import { queryStore } from '$lib/data/queryStore.svelte';
import { realtime } from '$lib/utils/realtimeManager.svelte';
import { presenceStore } from '$lib/data/presenceStore.svelte';
import { urlStore } from '$lib/data/urlStore.svelte';

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

    case 'VIEW_CHANGE':
      await handleViewChange(event.payload, contexts);
      break;

    case 'DISCARD':
      handleDiscard(event.payload, contexts);
      break;

    // ─── Incoming WS events ────────────────────────────────────────────────
    case 'WS_WELCOME':
      break;

    case 'WS_EXISTING_USERS':
      handleWsExistingUsers(event.payload, contexts);
      break;

    case 'WS_USER_POSITION_UPDATE':
      handleWsUserPositionUpdate(event.payload);
      break;

    case 'WS_USER_LEFT':
      handleWsUserLeft(event.payload);
      break;

    case 'WS_CELL_LOCKED':
      handleWsCellLocked(event.payload);
      break;

    case 'WS_CELL_UNLOCKED':
      handleWsCellUnlocked(event.payload);
      break;

    case 'WS_PENDING_BROADCAST':
      handleWsPendingBroadcast(event.payload);
      break;

    case 'WS_PENDING_CLEAR_BROADCAST':
      handleWsPendingClearBroadcast(event.payload);
      break;

    case 'WS_COMMIT_BROADCAST':
      handleWsCommitBroadcast(event.payload);
      break;

    case 'WS_CLIENT_STATE_RECONCILED':
      handleWsClientStateReconciled(event.payload, contexts);
      break;

    // ─── Outbound WS events ───────────────────────────────────────────────
    case 'POSITION_UPDATE':
      handlePositionUpdate(event.payload);
      break;

    case 'POSITION_DESELECT':
      realtime.sendDeselect();
      break;

    case 'CELL_EDIT_START':
      realtime.sendEditStart(event.payload.assetId, event.payload.key);
      break;

    case 'CELL_EDIT_END':
      realtime.sendEditEnd();
      break;

    case 'CELL_PENDING':
      realtime.sendCellPending(event.payload.assetId, event.payload.key, event.payload.value);
      break;

    case 'CELL_PENDING_CLEAR':
      realtime.sendCellPendingClear(event.payload.assetId, event.payload.key);
      break;

    case 'PENDING_CLEAR_ALL':
      realtime.sendPendingClearAll();
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
  const { changes, user } = payload;

  if (!user) {
    toastState.addToast('Log in to edit.', 'warning');
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
    const filtered = assetStore.displayedAssets.find((a: any) => a.id === change.row);
    if (filtered) filtered[change.col] = change.value;
    const base = assetStore.baseAssets.find((a: any) => a.id === change.row);
    if (base) base[change.col] = change.value;
  }

  pendingCtx.edits = [];
  realtime.sendCommitBroadcast(changes.map((c: any) => ({ assetId: c.row, key: c.col, value: c.value })));
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

  console.log('[CommitCreate] rows payload:', JSON.stringify(rows));
  console.log('[CommitCreate] rowsToSave:', JSON.stringify(rowsToSave));
  const res = await apiPost('/api/create/asset', rowsToSave);
  console.log('[CommitCreate] response:', JSON.stringify(res));
  if (!res.success) {
    toastState.addToast('Failed to save new rows.', 'error');
    return;
  }

  const { pendingCtx } = contexts;
  newRowCtx.newRows = [];
  newRowCtx.hasNewRows = false;
  if (pendingCtx) pendingCtx.edits = [];

  // Refetch using current view/search/filter state
  const params = new URLSearchParams();
  params.set('view', queryStore.view || 'default');
  if (queryStore.q) params.set('q', queryStore.q);
  for (const f of queryStore.filters) params.append('filter', `${f.key}:${f.value}`);
  const hasFilters = queryStore.q || queryStore.filters.length > 0;

  const refetch = await apiFetch('/api/assets', params);
  if (refetch.success) {
    if (hasFilters) {
      assetStore.displayedAssets = refetch.data.assets;
    } else {
      assetStore.baseAssets = refetch.data.assets;
      assetStore.displayedAssets = refetch.data.assets;
    }

  } else {
    assetStore.displayedAssets = assetStore.displayedAssets.filter((a: any) => a.id > 0);

  }
  toastState.addToast(`${rows.length} new rows saved successfully.`, 'success');
}

function buildQueryParams(view: string, q?: string, filters?: { key: string; value: string }[]): URLSearchParams {
  const params = new URLSearchParams();
  params.set('view', view || 'default');
  if (q) params.set('q', q);
  if (filters) {
    for (const f of filters) params.append('filter', `${f.key}:${f.value}`);
  }
  return params;
}

async function handleQuery(
  payload: Record<string, any>,
  _contexts: Record<string, any>,
): Promise<void> {
  const { view, q, filters } = payload;
  const hasFilters = q || (filters && filters.length > 0);

  if (!hasFilters) {
    assetStore.displayedAssets = assetStore.baseAssets;

    urlStore.url = `?${buildQueryParams(view)}`;
    return;
  }

  const params = buildQueryParams(view, q, filters);
  const res = await apiFetch('/api/assets', params);

  if (!res.success) {
    toastState.addToast('Query failed. Please try again.', 'error');
    return;
  }

  assetStore.displayedAssets = res.data.assets;

  urlStore.url = `?${params}`;
}

async function handleViewChange(
  payload: Record<string, any>,
  _contexts: Record<string, any>,
): Promise<void> {
  const { view } = payload;
  const params = buildQueryParams(view);
  const res = await apiFetch('/api/assets', params);

  if (!res.success) {
    toastState.addToast('Failed to load view. Please try again.', 'error');
    return;
  }

  assetStore.baseAssets = res.data.assets;
  assetStore.displayedAssets = res.data.assets;

  urlStore.url = `?${params}`;
}

function handleDiscard(
  _payload: Record<string, any>,
  contexts: Record<string, any>,
): void {
  const { pendingCtx, newRowCtx } = contexts;

  pendingCtx.edits = [];
  newRowCtx.newRows = [];
  newRowCtx.hasNewRows = false;
  assetStore.displayedAssets = assetStore.displayedAssets.filter((a: any) => a.id > 0);
  realtime.sendPendingClearAll();
  toastState.addToast('Changes discarded.', 'info');
}

// ─── Outbound Presence ─────────────────────────────────────────────────────

function handlePositionUpdate(payload: Record<string, any>): void {
  const { assetId, key } = payload;
  const keys = Object.keys(assetStore.displayedAssets[0] ?? {});
  const colIdx = keys.indexOf(key);
  if (colIdx === -1) return;
  realtime.sendPositionUpdate(assetId, colIdx, assetId);
}

// ─── WS Presence Handlers ──────────────────────────────────────────────────

function handleWsExistingUsers(
  payload: Record<string, any>,
  contexts: Record<string, any>,
): void {
  const users = payload.users || payload;
  const lockedCells = payload.lockedCells || {};

  // Build a set of locked cells keyed by userId for merging
  const locksByUser = new Map<string, { assetId: string; key: string }>();
  for (const [lockKey, lock] of Object.entries(lockedCells) as [string, any][]) {
    const [assetId, key] = lockKey.split(':');
    locksByUser.set(lock.userId, { assetId, key });
  }

  const keys = Object.keys(assetStore.displayedAssets[0] ?? {});
  const entries: typeof presenceStore.users = [];
  for (const [, user] of Object.entries(users) as [string, any][]) {
    const lock = locksByUser.get(String(user.userId));
    entries.push({
      id: Number(user.userId),
      firstname: user.firstname || '',
      lastname: user.lastname || '',
      color: user.color || '#6b7280',
      row: lock ? Number(lock.assetId) : user.assetId ?? user.row ?? -1,
      col: lock ? lock.key : keys[user.col] ?? '',
      isLocked: !!lock,
    });
  }
  presenceStore.users = entries;
  console.log('[Presence] EXISTING_USERS populated', entries.length, 'users');

  // Hydrate pending cells from other users
  const pendingCells = payload.pendingCells || {};
  const pendingEntries: typeof presenceStore.pendingCells = [];
  for (const [, cellInfo] of Object.entries(pendingCells) as [string, any][]) {
    pendingEntries.push({
      userId: Number(cellInfo.userId),
      assetId: Number(cellInfo.assetId),
      key: cellInfo.key,
      firstname: cellInfo.firstname || '',
      lastname: cellInfo.lastname || '',
      color: cellInfo.color || '#6b7280',
    });
  }
  presenceStore.pendingCells = pendingEntries;
}

function handleWsUserPositionUpdate(
  payload: Record<string, any>,
): void {
  const userId = Number(payload.userId);
  const keys = Object.keys(assetStore.displayedAssets[0] ?? {});
  const colKey = keys[payload.col] ?? '';
  const assetId = payload.assetId ?? payload.row ?? -1;
  const existing = presenceStore.users.find((u: any) => u.id === userId);

  console.log('[Presence] USER_POSITION_UPDATE', { userId, assetId, colKey, payload, currentUsers: presenceStore.users.length });

  if (existing) {
    existing.row = assetId;
    existing.col = colKey;
    existing.isLocked = false;
    existing.firstname = payload.firstname || existing.firstname;
    existing.lastname = payload.lastname || existing.lastname;
    existing.color = payload.color || existing.color;
  } else {
    presenceStore.users.push({
      id: userId,
      firstname: payload.firstname || '',
      lastname: payload.lastname || '',
      color: payload.color || '#6b7280',
      row: assetId,
      col: colKey,
      isLocked: false,
    });
  }
}

function handleWsUserLeft(
  payload: Record<string, any>,
): void {
  const userId = Number(payload.clientId);
  const idx = presenceStore.users.findIndex((u: any) => u.id === userId);
  if (idx === -1) { console.warn('[Presence] USER_LEFT for unknown user', userId); return; }
  presenceStore.users.splice(idx, 1);
}

function handleWsCellLocked(
  payload: Record<string, any>,
): void {
  const userId = Number(payload.userId);
  const assetId = Number(payload.assetId);
  const key = payload.key;

  const user = presenceStore.users.find((u: any) => u.id === userId);
  if (user) {
    user.isLocked = true;
    user.row = assetId;
    user.col = key;
  }
}

function handleWsCellUnlocked(
  payload: Record<string, any>,
): void {
  const assetId = Number(payload.assetId);
  const key = payload.key;

  const user = presenceStore.users.find(
    (u: any) => u.isLocked && u.row === assetId && u.col === key,
  );
  if (user) user.isLocked = false;
}

function handleWsPendingBroadcast(
  payload: Record<string, any>,
): void {
  const userId = Number(payload.userId);
  const assetId = Number(payload.assetId);
  const key = payload.key;

  presenceStore.pendingCells = [
    ...presenceStore.pendingCells.filter(
      (p) => !(p.assetId === assetId && p.key === key),
    ),
    {
      userId,
      assetId,
      key,
      firstname: payload.firstname || '',
      lastname: payload.lastname || '',
      color: payload.color || '#6b7280',
    },
  ];
}

function handleWsPendingClearBroadcast(
  payload: Record<string, any>,
): void {
  if (payload.cells) {
    // Batch clear (from PENDING_CLEAR_ALL or disconnect cleanup)
    const cellSet = new Set(
      (payload.cells as any[]).map((c) => `${c.assetId}:${c.key}`),
    );
    presenceStore.pendingCells = presenceStore.pendingCells.filter(
      (p) => !cellSet.has(`${p.assetId}:${p.key}`),
    );
  } else {
    // Single cell clear
    const assetId = Number(payload.assetId);
    const key = payload.key;
    presenceStore.pendingCells = presenceStore.pendingCells.filter(
      (p) => !(p.assetId === assetId && p.key === key),
    );
  }
}

function handleWsCommitBroadcast(
  payload: Record<string, any>,
): void {
  const userId = Number(payload.userId);
  const changes = payload.changes || [];

  // Apply each committed change to local assetStore
  for (const change of changes) {
    const assetId = Number(change.assetId);
    const key = change.key;
    const value = change.value;

    const filtered = assetStore.displayedAssets.find((a: any) => a.id === assetId);
    if (filtered) filtered[key] = value;
    const base = assetStore.baseAssets.find((a: any) => a.id === assetId);
    if (base) base[key] = value;
  }

  // Remove all pending entries for the committing user
  presenceStore.pendingCells = presenceStore.pendingCells.filter(
    (p) => p.userId !== userId,
  );
}

function handleWsClientStateReconciled(
  payload: Record<string, any>,
  contexts: Record<string, any>,
): void {
  const conflicts = payload.conflicts || [];
  if (conflicts.length === 0) return;

  const { pendingCtx } = contexts;

  for (const conflict of conflicts) {
    const name = conflict.firstname && conflict.lastname
      ? `${conflict.firstname} ${conflict.lastname}`.trim()
      : 'another user';
    const cellRef = `${conflict.assetId}:${conflict.key}`;

    if (conflict.type === 'lock') {
      toastState.addToast(`Cell ${cellRef} is locked by ${name}`, 'warning');
    } else if (conflict.type === 'pending') {
      toastState.addToast(`Cell ${cellRef} has pending changes by ${name}`, 'warning');
      // Revert the local pending edit for this cell
      if (pendingCtx) {
        pendingCtx.edits = pendingCtx.edits.filter(
          (e: any) => !(e.row === Number(conflict.assetId) && e.col === conflict.key),
        );
      }
    }
  }
}
