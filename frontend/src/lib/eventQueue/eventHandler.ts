// frontend/src/lib/grid/eventQueue/eventHandler.ts
// Imports stores directly. Target functions mutate stores directly.

import { toastState } from '$lib/toast/toastState.svelte';
import { assetStore } from '$lib/data/assetStore.svelte';
import { queryStore } from '$lib/data/queryStore.svelte';
import { realtime } from '$lib/utils/realtimeManager.svelte';
import { presenceStore } from '$lib/data/presenceStore.svelte';
import { urlStore } from '$lib/data/urlStore.svelte';
import { scrollStore } from '$lib/data/scrollStore.svelte';
import { pendingStore } from '$lib/data/cellStore.svelte';
import { newRowStore } from '$lib/data/newRowStore.svelte';
import { auditStore } from '$lib/data/auditStore.svelte';
import { auditUiStore } from '$lib/data/auditUiStore.svelte';

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
): Promise<void> {
  switch (event.type) {
    case 'COMMIT_UPDATE':
      await handleCommitUpdate(event.payload);
      break;

    case 'COMMIT_CREATE':
      await handleCommitCreate(event.payload);
      break;

    case 'QUERY':
      await handleQuery(event.payload);
      break;

    case 'VIEW_CHANGE':
      await handleViewChange(event.payload);
      break;

    case 'DISCARD':
      handleDiscard(event.payload);
      break;

    // ─── Incoming WS events ────────────────────────────────────────────────
    case 'WS_WELCOME':
      break;

    case 'WS_EXISTING_USERS':
      handleWsExistingUsers(event.payload);
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
      handleWsClientStateReconciled(event.payload);
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

    // ─── Audit outbound events ─────────────────────────────────────────────
    case 'AUDIT_ASSIGN':
      await handleAuditAssign(event.payload);
      break;

    case 'AUDIT_COMPLETE':
      await handleAuditComplete(event.payload);
      break;

    case 'AUDIT_START':
      await handleAuditStart(event.payload);
      break;

    case 'AUDIT_CLOSE':
      await handleAuditClose(event.payload);
      break;

    case 'AUDIT_QUERY':
      await handleAuditQuery(event.payload);
      break;

    // ─── Audit incoming WS events ──────────────────────────────────────────
    case 'WS_AUDIT_ASSIGN_BROADCAST':
      handleWsAuditAssign(event.payload);
      break;

    case 'WS_AUDIT_COMPLETE_BROADCAST':
      handleWsAuditComplete(event.payload);
      break;

    case 'WS_AUDIT_START_BROADCAST':
      await handleWsAuditStart();
      break;

    case 'WS_AUDIT_CLOSE_BROADCAST':
      handleWsAuditClose();
      break;

    case 'WS_ROW_LOCKED':
      handleWsRowLocked(event.payload);
      break;

    case 'WS_ROW_UNLOCKED':
      handleWsRowUnlocked(event.payload);
      break;

    case 'WS_ROW_LOCK_REJECTED':
      handleWsRowLockRejected(event.payload);
      break;

    case 'ROW_LOCK':
      realtime.sendRowLock(event.payload.assetId);
      break;

    case 'ROW_UNLOCK':
      realtime.sendRowUnlock(event.payload.assetId);
      break;

    default:
      console.warn(`[EventHandler] unhandled event type: ${event.type}`);
  }
}

// ─── Target Functions ───────────────────────────────────────────────────────
// Each receives a self-contained payload. Imports stores directly.
// Mutates stores directly on success — UI updates instantly.

async function handleCommitUpdate(
  payload: Record<string, any>,
): Promise<void> {
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

  pendingStore.edits = [];
  realtime.sendCommitBroadcast(changes.map((c: any) => ({ assetId: c.row, key: c.col, value: c.value })));
  toastState.addToast('Changes saved successfully.', 'success');
}

async function handleCommitCreate(
  payload: Record<string, any>,
): Promise<void> {
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

  newRowStore.newRows = [];
  newRowStore.hasNewRows = false;
  pendingStore.edits = [];

  // Refetch using current view/search/filter state
  const hasFilters = queryStore.q || queryStore.filters.length > 0;
  const params = buildQueryParams(queryStore.view, queryStore.q, queryStore.filters);

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
): Promise<void> {
  const { view, q, filters } = payload;
  const hasFilters = q || (filters && filters.length > 0);

  if (!hasFilters) {
    assetStore.displayedAssets = assetStore.baseAssets;
    scrollStore.scrollTop = 0;
    scrollStore.scrollLeft = 0;
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
  scrollStore.scrollTop = 0;
  scrollStore.scrollLeft = 0;
  urlStore.url = `?${params}`;
}

async function handleViewChange(
  payload: Record<string, any>,
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
  scrollStore.scrollTop = 0;
  scrollStore.scrollLeft = 0;
  urlStore.url = `?${params}`;
}

function handleDiscard(
  _payload: Record<string, any>,
): void {
  pendingStore.edits = [];
  newRowStore.newRows = [];
  newRowStore.hasNewRows = false;
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

  // Row locks
  if (payload.rowLocks) {
    presenceStore.rowLocks = {};
    for (const [assetId, info] of Object.entries(payload.rowLocks as Record<string, any>)) {
      presenceStore.rowLocks[assetId] = {
        userId: info.userId,
        firstname: info.firstname,
        lastname: info.lastname,
        color: info.color,
      };
    }
  }
}

function handleWsUserPositionUpdate(
  payload: Record<string, any>,
): void {
  const userId = Number(payload.userId);
  const keys = Object.keys(assetStore.displayedAssets[0] ?? {});
  const colKey = keys[payload.col] ?? '';
  const assetId = payload.assetId ?? payload.row ?? -1;
  const existing = presenceStore.users.find((u: any) => u.id === userId);

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
  presenceStore.users = presenceStore.users.filter((u: any) => u.id !== userId);
  presenceStore.pendingCells = presenceStore.pendingCells.filter((p) => p.userId !== userId);
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

  // Apply each committed change to local assetStore + auditStore
  for (const change of changes) {
    const assetId = Number(change.assetId);
    const key = change.key;
    const value = change.value;

    const filtered = assetStore.displayedAssets.find((a: any) => a.id === assetId);
    if (filtered) filtered[key] = value;
    const base = assetStore.baseAssets.find((a: any) => a.id === assetId);
    if (base) base[key] = value;

    // Update audit views if the changed asset is in scope
    for (const arr of [auditStore.baseAssignments, auditStore.displayedAssignments]) {
      const audit = arr.find(a => a.asset_id === assetId);
      if (audit && key in audit) (audit as any)[key] = value;
    }
  }

  // Remove all pending entries for the committing user
  presenceStore.pendingCells = presenceStore.pendingCells.filter(
    (p) => p.userId !== userId,
  );
}

function handleWsClientStateReconciled(
  payload: Record<string, any>,
): void {
  const conflicts = payload.conflicts || [];
  if (conflicts.length === 0) return;

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
      pendingStore.edits = pendingStore.edits.filter(
        (e: any) => !(e.row === Number(conflict.assetId) && e.col === conflict.key),
      );
    }
  }
}

// ─── Audit Handlers ──────────────────────────────────────────────────────────

async function handleAuditAssign(payload: Record<string, any>): Promise<void> {
  const { assetIds, userId } = payload;
  const res = await apiPost('/api/audit/assign', { assetIds, userId });
  if (!res.success) {
    toastState.addToast('Failed to assign auditor.', 'error');
    return;
  }

  const user = auditStore.users.find(u => u.id === userId);
  const auditorName = user ? `${user.lastname}, ${user.firstname}` : null;
  const idSet = new Set(assetIds as number[]);
  for (const arr of [auditStore.baseAssignments, auditStore.displayedAssignments]) {
    for (const a of arr) {
      if (idSet.has(a.asset_id)) {
        a.assigned_to = userId;
        a.auditor_name = auditorName;
      }
    }
  }
  toastState.addToast(`Assigned ${assetIds.length} item${assetIds.length === 1 ? '' : 's'}.`, 'success');
  realtime.sendAuditAssign(assetIds, userId, auditorName ?? '');
}

async function handleAuditComplete(payload: Record<string, any>): Promise<void> {
  const { assetId, result, comment, userId } = payload;
  const res = await apiPost('/api/audit/complete', { assetId, auditResult: result, comment });
  if (!res.success) {
    toastState.addToast('Failed to complete audit.', 'error');
    return;
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  for (const arr of [auditStore.baseAssignments, auditStore.displayedAssignments]) {
    const a = arr.find(a => a.asset_id === assetId);
    if (a) { a.completed_at = now; a.result = result; }
  }
  updateProgressOnComplete(userId);
  toastState.addToast('Audit completed.', 'success');
  realtime.sendAuditComplete(assetId, result, now, userId);
}

async function handleAuditStart(payload: Record<string, any>): Promise<void> {
  if (!confirm('Start a new audit cycle? This will snapshot all current inventory items.')) return;
  const res = await apiPost('/api/audit/start', {});
  if (!res.success) {
    toastState.addToast('Failed to start audit cycle.', 'error');
    return;
  }
  const cycle = res.data?.cycle ?? null;
  auditStore.cycle = cycle;
  // Fetch the freshly created snapshot assignments
  const assignRes = await apiFetch('/api/audit/assignments');
  if (assignRes.success) {
    auditStore.baseAssignments = assignRes.data.assignments;
    auditStore.displayedAssignments = assignRes.data.assignments;
  }
  toastState.addToast(`Audit started. ${res.data?.count ?? 0} items in scope.`, 'success');
  realtime.sendAuditStart();
}

async function handleAuditClose(payload: Record<string, any>): Promise<void> {
  if (!confirm('Close the audit cycle? All completed items will be archived.')) return;
  const res = await apiPost('/api/audit/close', {});
  if (!res.success) {
    toastState.addToast('Failed to close audit cycle.', 'error');
    return;
  }
  toastState.addToast(`Cycle closed. ${res.data?.archived ?? 0} items archived.`, 'success');
  auditStore.baseAssignments = [];
  auditStore.displayedAssignments = [];
  auditStore.cycle = null;
  realtime.sendAuditClose();
}

async function handleAuditQuery(payload: Record<string, any>): Promise<void> {
  const filters = auditUiStore.filters;
  const q = auditUiStore.searchTerm.trim();
  if (filters.length === 0 && !q) {
    auditStore.displayedAssignments = auditStore.baseAssignments;
    return;
  }
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  for (const f of filters) params.append('filter', `${f.key}:${f.value}`);
  const res = await apiFetch('/api/audit/assignments', params);
  if (res.success) {
    auditStore.displayedAssignments = res.data.assignments;
  } else {
    toastState.addToast('Failed to filter assignments.', 'error');
  }
}

// ─── Audit incoming WS handlers ─────────────────────────────────────────────

function handleWsAuditAssign(payload: Record<string, any>): void {
  const { assetIds, userId, auditorName } = payload;
  const idSet = new Set(assetIds as number[]);
  for (const arr of [auditStore.baseAssignments, auditStore.displayedAssignments]) {
    for (const a of arr) {
      if (idSet.has(a.asset_id)) {
        a.assigned_to = userId;
        a.auditor_name = auditorName;
      }
    }
  }
}

function handleWsAuditComplete(payload: Record<string, any>): void {
  const { assetId, result, completedAt, userId } = payload;
  for (const arr of [auditStore.baseAssignments, auditStore.displayedAssignments]) {
    const a = arr.find(a => a.asset_id === assetId);
    if (a) { a.completed_at = completedAt; a.result = result; }
  }
  updateProgressOnComplete(userId);
}

async function handleWsAuditStart(): Promise<void> {
  const [cycleRes, statusRes, progressRes] = await Promise.all([
    apiFetch('/api/audit/cycle'),
    apiFetch('/api/audit/status'),
    apiFetch('/api/audit/user-progress'),
  ]);
  auditStore.cycle = cycleRes.success ? cycleRes.data.cycle : null;
  if (statusRes.success) auditStore.progress = statusRes.data;
  if (progressRes.success) auditStore.userProgress = progressRes.data;
}

function handleWsAuditClose(): void {
  auditStore.baseAssignments = [];
  auditStore.displayedAssignments = [];
  auditStore.cycle = null;
  auditStore.progress = { total: 0, pending: 0, completed: 0 };
  auditStore.userProgress = [];
}

function updateProgressOnComplete(userId: number): void {
  const completed = auditStore.progress.completed + 1;
  const pending = auditStore.progress.pending - 1;
  auditStore.progress = { total: auditStore.progress.total, completed, pending };

  const user = auditStore.userProgress.find(u => u.userId === userId);
  if (user) user.completed++;
}

// ─── Row Lock handlers ──────────────────────────────────────────────────────

function handleWsRowLocked(payload: Record<string, any>): void {
  const { assetId, userId, firstname, lastname, color } = payload;
  presenceStore.rowLocks[String(assetId)] = { userId, firstname, lastname, color };
}

function handleWsRowUnlocked(payload: Record<string, any>): void {
  const { assetId } = payload;
  delete presenceStore.rowLocks[String(assetId)];
}

function handleWsRowLockRejected(payload: Record<string, any>): void {
  const { firstname, lastname, reason } = payload;
  if (reason === 'row_being_edited') {
    toastState.addToast(`Row is being edited by ${firstname} ${lastname}.`, 'warning');
  } else {
    toastState.addToast(`Row is locked by ${firstname} ${lastname}.`, 'warning');
  }
}
