<script lang="ts">
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    // svelte-ignore state_referenced_locally
    let assignments = $state(data.assignments);
    let summary = $derived(data.summary);

    let reassignModal = $state<{ assetId: number; assetLabel: string; currentUserId: number } | null>(null);
    let reassignUserId = $state<number | null>(null);
    let saving = $state(false);
    let closing = $state(false);
    let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);

    let selectedAssetIds = $state<Set<number>>(new Set());
    let bulkUserId = $state<number | null>(null);
    let bulkAssigning = $state(false);

    let progressPct = $derived(
        summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0
    );

    let allSelected = $derived(
        assignments.length > 0 && assignments.every(a => selectedAssetIds.has(a.asset_id))
    );

    function formatDate(val: Date | string | null): string {
        if (!val) return '—';
        const d = val instanceof Date ? val : new Date(val);
        return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function formatDateTime(val: Date | string | null): string {
        if (!val) return '—';
        const d = val instanceof Date ? val : new Date(val);
        return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function dismissMessage() {
        message = null;
    }

    function openReassign(assignment: { asset_id: number; wbd_tag: string | null; asset_type: string | null; assigned_to: number }) {
        reassignModal = {
            assetId: assignment.asset_id,
            assetLabel: `${assignment.wbd_tag || '—'} · ${assignment.asset_type || '—'}`,
            currentUserId: assignment.assigned_to,
        };
        reassignUserId = assignment.assigned_to;
    }

    function closeReassign() {
        reassignModal = null;
        reassignUserId = null;
    }

    async function reassign(assetId: number) {
        if (!reassignUserId) return;
        saving = true;
        message = null;
        try {
            const res = await fetch('/api/audit/assign', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assetId, userId: reassignUserId }),
            });
            if (res.ok) {
                const assignment = assignments.find(a => a.asset_id === assetId);
                if (assignment) {
                    assignment.assigned_to = reassignUserId!;
                    const user = data.users.find(u => u.id === reassignUserId);
                    if (user) assignment.auditor_name = `${user.lastname}, ${user.firstname}`;
                }
                closeReassign();
                message = { type: 'success', text: 'Auditor reassigned successfully.' };
            } else {
                const err = await res.json();
                message = { type: 'error', text: err.error ?? 'Failed to reassign auditor.' };
            }
        } finally {
            saving = false;
        }
    }

    async function closeCycle() {
        if (!confirm('Close the audit cycle? All completed items will be archived.')) return;
        closing = true;
        message = null;
        try {
            const res = await fetch('/api/audit/close', { method: 'POST' });
            const json = await res.json();
            if (res.ok) {
                message = { type: 'success', text: `Cycle closed. ${json.archived} items archived.` };
                assignments = [];
            } else {
                message = { type: 'error', text: json.error ?? 'Failed to close audit cycle.' };
            }
        } finally {
            closing = false;
        }
    }

    function toggleAll() {
        if (allSelected) {
            selectedAssetIds = new Set();
        } else {
            selectedAssetIds = new Set(assignments.map(a => a.asset_id));
        }
    }

    function toggleOne(assetId: number) {
        const next = new Set(selectedAssetIds);
        if (next.has(assetId)) {
            next.delete(assetId);
        } else {
            next.add(assetId);
        }
        selectedAssetIds = next;
    }

    async function bulkAssign() {
        if (selectedAssetIds.size === 0 || !bulkUserId) return;
        bulkAssigning = true;
        message = null;
        try {
            const res = await fetch('/api/audit/bulk-assign', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assetIds: [...selectedAssetIds], userId: bulkUserId }),
            });
            const json = await res.json();
            if (res.ok) {
                const user = data.users.find(u => u.id === bulkUserId);
                const auditorName = user ? `${user.lastname}, ${user.firstname}` : '—';
                for (const a of assignments) {
                    if (selectedAssetIds.has(a.asset_id)) {
                        a.assigned_to = bulkUserId!;
                        a.auditor_name = auditorName;
                    }
                }
                message = { type: 'success', text: `Assigned ${selectedAssetIds.size} item${selectedAssetIds.size === 1 ? '' : 's'}.` };
                selectedAssetIds = new Set();
                bulkUserId = null;
            } else {
                message = { type: 'error', text: json.error ?? 'Bulk assign failed.' };
            }
        } finally {
            bulkAssigning = false;
        }
    }
</script>

<div class="px-4 py-6">

    <!-- Page header -->
    <div class="mb-6 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
            <h1 class="text-2xl font-bold text-neutral-800 dark:text-neutral-100">Audit Management</h1>
            {#if summary.auditStartDate}
                <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    Cycle started {formatDate(summary.auditStartDate)}
                    {#if data.nextAuditDate}
                        &nbsp;·&nbsp; Next audit: {formatDate(data.nextAuditDate)}
                    {/if}
                </p>
            {:else}
                <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">No active audit cycle.</p>
            {/if}
        </div>

        <div class="relative group mt-2 sm:mt-0">
            <button
                onclick={closeCycle}
                disabled={closing || summary.pending > 0}
                class="px-4 py-2 rounded-lg text-sm font-semibold transition-colors
                    {summary.pending > 0
                        ? 'bg-neutral-200 dark:bg-slate-700 text-neutral-400 dark:text-neutral-500 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'}"
            >
                {closing ? 'Closing…' : 'Close Cycle'}
            </button>
            {#if summary.pending > 0}
                <div class="absolute right-0 top-full mt-1 w-48 bg-neutral-800 dark:bg-slate-900 text-white text-xs rounded px-2 py-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {summary.pending} item{summary.pending === 1 ? '' : 's'} still pending
                </div>
            {/if}
        </div>
    </div>

    <!-- Message banner -->
    {#if message}
        <div class="mb-4 flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium
            {message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'}">
            <span class="flex-1">{message.text}</span>
            <button onclick={dismissMessage} class="text-current opacity-60 hover:opacity-100 cursor-pointer text-lg leading-none">&times;</button>
        </div>
    {/if}

    <!-- Summary bar -->
    {#if summary.total > 0}
        <div class="mb-6 bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm px-5 py-4">
            <div class="flex flex-wrap gap-6 items-center mb-3">
                <div class="text-center">
                    <p class="text-2xl font-bold text-neutral-800 dark:text-neutral-100">{summary.total}</p>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Total</p>
                </div>
                <div class="text-center">
                    <p class="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.pending}</p>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Pending</p>
                </div>
                <div class="text-center">
                    <p class="text-2xl font-bold text-green-600 dark:text-green-400">{summary.completed}</p>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Completed</p>
                </div>
                <div class="ml-auto text-right">
                    <p class="text-2xl font-bold text-blue-600 dark:text-blue-400">{progressPct}%</p>
                    <p class="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">Progress</p>
                </div>
            </div>
            <!-- Progress bar -->
            <div class="w-full h-2 bg-neutral-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                    class="h-full rounded-full transition-all duration-500
                        {progressPct === 100 ? 'bg-green-500' : 'bg-blue-500'}"
                    style="width: {progressPct}%"
                ></div>
            </div>
        </div>
    {/if}

    <!-- Assignments table -->
    {#if assignments.length === 0}
        <div class="flex flex-col items-center justify-center py-24 text-neutral-400 dark:text-neutral-500">
            <svg class="w-12 h-12 mb-4 opacity-40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <p class="text-lg font-medium">No active audit cycle</p>
            <p class="text-sm mt-1">All items have been archived or no cycle has been started.</p>
        </div>
    {:else}
        <!-- Bulk assignment toolbar -->
        <div class="mb-3 flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm px-4 py-3">
            <span class="text-sm text-neutral-600 dark:text-neutral-400 font-medium">
                Bulk assign:
            </span>
            <select
                bind:value={bulkUserId}
                class="rounded-lg border border-neutral-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-neutral-800 dark:text-neutral-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value={null} disabled selected>Select auditor…</option>
                {#each data.users as user (user.id)}
                    <option value={user.id}>{user.lastname}, {user.firstname}</option>
                {/each}
            </select>
            <button
                onclick={bulkAssign}
                disabled={bulkAssigning || selectedAssetIds.size === 0 || !bulkUserId}
                class="px-4 py-1.5 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
                {bulkAssigning ? 'Assigning…' : `Assign${selectedAssetIds.size > 0 ? ` (${selectedAssetIds.size})` : ''}`}
            </button>
            {#if selectedAssetIds.size > 0}
                <button
                    onclick={() => selectedAssetIds = new Set()}
                    class="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                >
                    Clear selection
                </button>
                <span class="text-sm text-neutral-500 dark:text-neutral-400">
                    {selectedAssetIds.size} selected
                </span>
            {/if}
        </div>

        <div class="bg-white dark:bg-slate-800 rounded-xl border border-neutral-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b border-neutral-200 dark:border-slate-700 bg-neutral-50 dark:bg-slate-700/50">
                            <th class="px-4 py-3 w-10">
                                <input type="checkbox" checked={allSelected} onchange={toggleAll} class="rounded cursor-pointer" />
                            </th>
                            <th class="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300 whitespace-nowrap">WBD Tag</th>
                            <th class="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300 whitespace-nowrap">Asset Type</th>
                            <th class="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300 whitespace-nowrap">Model</th>
                            <th class="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300 whitespace-nowrap">Location</th>
                            <th class="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300 whitespace-nowrap">Auditor</th>
                            <th class="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300 whitespace-nowrap">Status</th>
                            <th class="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300 whitespace-nowrap">Completed</th>
                            <th class="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300 whitespace-nowrap">Result</th>
                            <th class="text-left px-4 py-3 font-semibold text-neutral-600 dark:text-neutral-300 whitespace-nowrap">Reassign</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each assignments as assignment (assignment.asset_id)}
                            {@const isPending = !assignment.completed_at}
                            <tr class="border-b border-neutral-100 dark:border-slate-700 hover:bg-neutral-50 dark:hover:bg-slate-700/30 transition-colors">
                                <td class="px-4 py-3 w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedAssetIds.has(assignment.asset_id)}
                                        onchange={() => toggleOne(assignment.asset_id)}
                                        class="rounded cursor-pointer"
                                    />
                                </td>
                                <td class="px-4 py-3 font-mono text-xs text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                                    {assignment.wbd_tag || '—'}
                                </td>
                                <td class="px-4 py-3 text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                                    {assignment.asset_type || '—'}
                                </td>
                                <td class="px-4 py-3 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                                    {assignment.model || '—'}
                                </td>
                                <td class="px-4 py-3 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                                    {assignment.location || '—'}
                                </td>
                                <td class="px-4 py-3 text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                                    {assignment.auditor_name || '—'}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap">
                                    {#if isPending}
                                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                                            <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                            Pending
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                            <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                            Completed
                                        </span>
                                    {/if}
                                </td>
                                <td class="px-4 py-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap text-xs">
                                    {formatDateTime(assignment.completed_at)}
                                </td>
                                <td class="px-4 py-3 text-neutral-600 dark:text-neutral-400 max-w-xs">
                                    {#if assignment.result}
                                        <span class="truncate block max-w-[160px]" title={assignment.result}>{assignment.result}</span>
                                    {:else}
                                        <span class="text-neutral-300 dark:text-neutral-600">—</span>
                                    {/if}
                                </td>
                                <td class="px-4 py-3 whitespace-nowrap">
                                    <button
                                        onclick={() => openReassign(assignment)}
                                        class="px-3 py-1.5 rounded-md text-xs font-medium border border-neutral-300 dark:border-slate-600 text-neutral-600 dark:text-neutral-300 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500 dark:hover:text-blue-400 transition-colors cursor-pointer"
                                    >
                                        Reassign
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>

        <p class="mt-2 ml-1 text-xs text-neutral-500 dark:text-neutral-400">
            {assignments.length} assignment{assignments.length === 1 ? '' : 's'} in current cycle
        </p>
    {/if}

    <!-- Reassign modal -->
    {#if reassignModal}
        <div
            class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onclick={closeReassign}
            role="dialog"
            aria-modal="true"
        >
            <div
                class="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6"
                onclick={(e) => e.stopPropagation()}
            >
                <h3 class="text-base font-semibold text-neutral-800 dark:text-neutral-100 mb-1">Reassign Auditor</h3>
                <p class="text-sm text-neutral-500 dark:text-neutral-400 mb-4">{reassignModal.assetLabel}</p>

                <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1.5">Assign to</label>
                <select
                    bind:value={reassignUserId}
                    class="w-full rounded-lg border border-neutral-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-neutral-800 dark:text-neutral-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                >
                    <option value={null} disabled>Select auditor…</option>
                    {#each data.users as user (user.id)}
                        <option value={user.id}>{user.lastname}, {user.firstname}</option>
                    {/each}
                </select>

                <div class="flex gap-2 justify-end">
                    <button
                        onclick={closeReassign}
                        class="px-4 py-2 rounded-lg text-sm text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onclick={() => reassign(reassignModal!.assetId)}
                        disabled={saving || !reassignUserId}
                        class="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors cursor-pointer disabled:cursor-not-allowed"
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>
