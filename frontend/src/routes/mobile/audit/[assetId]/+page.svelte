<script lang="ts">
    import type { PageData } from './$types';
    import { presenceStore } from '$lib/data/presenceStore.svelte';
    import { enqueue } from '$lib/eventQueue/eventQueue';
    import { toastState } from '$lib/toast/toastState.svelte';
    import { goto } from '$app/navigation';
    import { base } from '$app/paths';
    import { untrack } from 'svelte';

    let { data }: { data: PageData } = $props();

    let asset: Record<string, any> = $derived(data.assignment);
    let locations: string[] = $derived(data.locations);
    let statuses: string[] = $derived(data.statuses);
    let conditions: string[] = $derived(data.conditions);
    let user = $derived(data.user);

    let view = $state<'detail' | 'edit' | 'confirm' | 'report'>('detail');
    let editField = $state<string | null>(null);
    let editValue = $state<string>('');
    let selectedIssue = $state('');
    let issueComment = $state('');

    const auditIssues = [
        'Item missing',
        'Item damaged',
        'Location incorrect',
        'Details incorrect',
        'Needs replacement',
        'Duplicate entry',
        'Not in use',
        'Other',
    ];

    const constrainedFields: Record<string, string[]> = $derived({
        location: locations,
        status: statuses,
        condition: conditions,
    });

    const fieldLabels: Record<string, string> = {
        id: 'ID',
        wbd_tag: 'WBD Tag',
        asset_type: 'Asset Type',
        asset_set_type: 'Asset Set Type',
        manufacturer: 'Manufacturer',
        model: 'Model',
        serial_number: 'Serial Number',
        bu_estate: 'BU / Estate',
        department: 'Department',
        location: 'Location',
        node: 'Node',
        shelf_cabinet_table: 'Shelf / Cabinet / Table',
        status: 'Status',
        condition: 'Condition',
        comment: 'Comment',
        audit_start_date: 'Audit Cycle Start',
        result: 'Audit Result',
    };

    const editableFields = [
        'wbd_tag', 'asset_type', 'asset_set_type', 'manufacturer', 'model',
        'serial_number', 'bu_estate', 'department', 'location', 'node',
        'shelf_cabinet_table', 'status', 'condition', 'comment',
    ];

    // Acquire row lock on mount, release on unmount
    $effect(() => {
        const assetId = untrack(() => asset.asset_id);
        const userId = untrack(() => user?.id);

        const existingLock = untrack(() => presenceStore.rowLocks[String(assetId)]);
        if (existingLock && existingLock.userId !== userId) {
            toastState.addToast(`Locked by ${existingLock.firstname} ${existingLock.lastname}`, 'error');
            history.back();
            return;
        }

        enqueue({ type: 'ROW_LOCK', payload: { assetId } });

        return () => {
            enqueue({ type: 'ROW_UNLOCK', payload: { assetId } });
        };
    });

    function openEdit(field: string) {
        editField = field;
        editValue = asset[field] ?? '';
        view = 'edit';
    }

    function openConfirm() {
        view = 'confirm';
    }

    function openReport() {
        selectedIssue = '';
        issueComment = '';
        view = 'report';
    }

    function backToDetail() {
        editField = null;
        view = 'detail';
    }

    function saveEdit() {
        if (!editField) return;

        const constrained = constrainedFields[editField];
        if (constrained && !constrained.includes(editValue)) {
            toastState.addToast('Select a valid option.', 'error');
            return;
        }

        enqueue({
            type: 'COMMIT_UPDATE',
            payload: {
                changes: [{
                    row: asset.asset_id,
                    col: editField,
                    value: editValue.trim(),
                    original: (asset as any)[editField] ?? '',
                }],
                user: { id: user!.id },
            },
        });

        (asset as any)[editField] = editValue.trim();
        editField = null;
        view = 'detail';
    }

    function completeAudit() {
        enqueue({
            type: 'AUDIT_COMPLETE',
            payload: { assetId: asset.asset_id, resultId: 1, userId: user!.id },
        });
        goto(`${base}/mobile/audit`);
    }

    function submitReport() {
        if (!selectedIssue) return;

        enqueue({
            type: 'AUDIT_COMPLETE',
            payload: { assetId: asset.asset_id, resultId: 2, userId: user!.id },
        });
        goto(`${base}/mobile/audit`);
    }

    function formatDate(val: Date | string | null): string {
        if (!val) return '-';
        try {
            return (val instanceof Date ? val : new Date(val)).toLocaleDateString();
        } catch {
            return String(val);
        }
    }
</script>

{#if view === 'confirm'}
    <!-- CONFIRM AUDIT VIEW -->
    <div class="flex flex-col items-center justify-center min-h-[60vh] px-4 gap-6">
        <div class="w-20 h-20 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
            <svg class="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </div>

        <div class="text-center">
            <h2 class="text-xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">Complete Audit?</h2>
            <p class="text-neutral-600 dark:text-neutral-400">
                Mark asset <span class="font-semibold">{asset.wbd_tag || asset.id}</span> as audited?
            </p>
            <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                All details are correct and up-to-date.
            </p>
        </div>

        <div class="flex gap-3 w-full max-w-sm">
            <button
                onclick={backToDetail}
                class="flex-1 py-3 px-4 border border-neutral-300 dark:border-neutral-600 rounded-lg font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 active:bg-neutral-100"
            >
                Cancel
            </button>
            <button
                onclick={completeAudit}
                class="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 active:bg-green-800"
            >
                Confirm
            </button>
        </div>
    </div>

{:else if view === 'report'}
    <!-- REPORT ISSUE VIEW -->
    <div class="flex flex-col gap-4 p-4 h-full">
        <div class="flex items-center gap-2 mb-1">
            <button onclick={backToDetail} class="flex items-center text-blue-600 dark:text-blue-400 font-medium text-sm">
                <svg class="w-5 h-5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                Back
            </button>
            <h1 class="text-xl font-bold flex-1 text-center pr-10">Report Issue</h1>
        </div>

        <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
            <p class="text-sm font-medium text-amber-800 dark:text-amber-300">
                Reporting issue for: <span class="font-bold">{asset.wbd_tag || asset.id}</span>
            </p>
        </div>

        <div class="bg-white dark:bg-neutral-800 rounded-xl border dark:border-neutral-700 p-4">
            <label class="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-3">
                Select Issue Type
            </label>
            <div class="flex flex-col gap-2">
                {#each auditIssues as issue}
                    <button
                        onclick={() => { selectedIssue = issue; }}
                        class="w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors {selectedIssue === issue ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-400 dark:border-amber-600 text-amber-800 dark:text-amber-300' : 'bg-white dark:bg-neutral-700 border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-600'}"
                    >
                        {issue}
                    </button>
                {/each}
            </div>

            {#if selectedIssue === 'Other'}
                <div class="mt-3">
                    <label class="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1">
                        Describe the issue
                    </label>
                    <textarea
                        bind:value={issueComment}
                        placeholder="Enter details..."
                        class="w-full p-3 border rounded-lg dark:bg-neutral-700 dark:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-amber-500 text-base resize-none"
                        rows="3"
                    ></textarea>
                </div>
            {/if}
        </div>

        <div class="flex gap-3 mt-2">
            <button
                onclick={backToDetail}
                class="flex-1 py-3 px-4 border border-neutral-300 dark:border-neutral-600 rounded-lg font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 active:bg-neutral-100"
            >
                Cancel
            </button>
            <button
                onclick={submitReport}
                disabled={!selectedIssue}
                class="flex-1 py-3 px-4 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Submit Report
            </button>
        </div>
    </div>

{:else if view === 'edit' && editField}
    <!-- EDIT FIELD VIEW -->
    <div class="flex flex-col gap-4 p-4 h-full">
        <div class="flex items-center gap-2 mb-1">
            <button onclick={backToDetail} class="flex items-center text-blue-600 dark:text-blue-400 font-medium text-sm">
                <svg class="w-5 h-5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                Back
            </button>
            <h1 class="text-xl font-bold flex-1 text-center pr-10">Edit {fieldLabels[editField] || editField}</h1>
        </div>

        <div class="bg-white dark:bg-neutral-800 rounded-xl border dark:border-neutral-700 p-4">
            <label class="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                {fieldLabels[editField] || editField}
            </label>

            {#if constrainedFields[editField]}
                <select
                    bind:value={editValue}
                    class="w-full p-3 border rounded-lg dark:bg-neutral-700 dark:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                >
                    <option value="">-- Select --</option>
                    {#each constrainedFields[editField] as option}
                        <option value={option}>{option}</option>
                    {/each}
                </select>
            {:else}
                <input
                    type="text"
                    bind:value={editValue}
                    class="w-full p-3 border rounded-lg dark:bg-neutral-700 dark:border-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                />
            {/if}

            <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                Current value: <span class="font-medium">{asset[editField] ?? 'empty'}</span>
            </p>
        </div>

        <div class="flex gap-3 mt-2">
            <button
                onclick={backToDetail}
                class="flex-1 py-3 px-4 border border-neutral-300 dark:border-neutral-600 rounded-lg font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 active:bg-neutral-100"
            >
                Cancel
            </button>
            <button
                onclick={saveEdit}
                class="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800"
            >
                Save
            </button>
        </div>
    </div>

{:else}
    <!-- DETAIL VIEW -->
    <div class="flex flex-col gap-3 p-4 h-full">
        <div class="flex items-center gap-2 mb-1">
            <button onclick={() => history.back()} class="flex items-center text-blue-600 dark:text-blue-400 font-medium text-sm">
                <svg class="w-5 h-5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                Back
            </button>
            <h1 class="text-xl font-bold flex-1 text-center pr-10">Audit Review</h1>
        </div>

        <!-- Action buttons at top -->
        <div class="flex gap-3">
            <button
                onclick={openConfirm}
                class="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 active:bg-green-800 text-sm"
            >
                Complete Audit
            </button>
            <button
                onclick={openReport}
                class="flex-1 py-3 px-4 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 active:bg-amber-700 text-sm"
            >
                Report Issue
            </button>
        </div>

        <div class="flex-grow overflow-y-auto">
            <div class="bg-white dark:bg-neutral-800 rounded-xl border dark:border-neutral-700 divide-y dark:divide-neutral-700">
                {#each Object.entries(fieldLabels) as [key, label]}
                    <div class="flex items-center justify-between px-4 py-3 gap-2">
                        <div class="min-w-0 flex-1">
                            <p class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">{label}</p>
                            <p class="text-sm mt-0.5 break-words">{key === 'audit_start_date' ? formatDate(asset[key]) : (asset[key] ?? '-')}</p>
                        </div>
                        {#if editableFields.includes(key)}
                            <button
                                onclick={() => openEdit(key)}
                                class="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 active:bg-blue-200"
                            >
                                Edit
                            </button>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    </div>
{/if}
