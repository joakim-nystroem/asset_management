<script lang="ts">
    import type { PageProps } from './$types';
    import { presenceStore } from '$lib/data/presenceStore.svelte';
    import { assetStore } from '$lib/data/assetStore.svelte';
    import { enqueue } from '$lib/eventQueue/eventQueue';
    import { toastState } from '$lib/toast/toastState.svelte';

    let { data }: PageProps = $props();

    let asset: Record<string, any> = $derived(
        assetStore.displayedAssets.find((a: any) => a.id === data.assetId) as Record<string, any>
    );
    let locations: string[] = $derived(data.locations.map(l => l.location_name));
    let statuses: string[] = $derived(data.statuses.map(s => s.status_name));
    let conditions: string[] = $derived(data.conditions.map(c => c.condition_name));

    let editField = $state<string | null>(null);
    let editValue = $state<string>('');

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
        under_warranty_until: 'Under Warranty Until',
        warranty_details: 'Warranty Details',
    };

    const editableFields = [
        'wbd_tag', 'asset_type', 'asset_set_type', 'manufacturer', 'model',
        'serial_number', 'bu_estate', 'department', 'location', 'node',
        'shelf_cabinet_table', 'status', 'condition', 'comment',
        'under_warranty_until', 'warranty_details',
    ];

    // Release cell lock on unmount (e.g. back button while editing)
    $effect(() => {
        return () => {
            if (editField) {
                enqueue({ type: 'CELL_EDIT_END', payload: {} });
            }
        };
    });

    function openEdit(field: string) {
        const rowLock = presenceStore.rowLocks[String(asset.id)];
        if (rowLock) {
            toastState.addToast(`Row locked by ${rowLock.firstname} ${rowLock.lastname}`, 'error');
            return;
        }

        const cellLock = presenceStore.users.find(
            u => u.row === asset.id && u.col === field && u.isLocked
        );
        if (cellLock) {
            toastState.addToast(`Being edited by ${cellLock.firstname} ${cellLock.lastname}`, 'error');
            return;
        }

        const pending = presenceStore.pendingCells.find(
            p => p.assetId === asset.id && p.key === field
        );
        if (pending) {
            toastState.addToast(`Pending changes by ${pending.firstname} ${pending.lastname}`, 'error');
            return;
        }

        editField = field;
        editValue = asset[field] ?? '';
        enqueue({ type: 'CELL_EDIT_START', payload: { assetId: asset.id, key: field } });
    }

    function backToDetail() {
        if (editField) {
            enqueue({ type: 'CELL_EDIT_END', payload: {} });
        }
        editField = null;
    }

    function saveEdit() {
        if (!editField) return;

        const constrained = constrainedFields[editField];
        if (constrained && editValue && !constrained.includes(editValue)) {
            toastState.addToast('Select a valid option.', 'error');
            return;
        }

        enqueue({
            type: 'COMMIT_UPDATE',
            payload: {
                changes: [{
                    row: asset.id,
                    col: editField,
                    value: editValue.trim(),
                    original: asset[editField] ?? '',
                }],
            },
        });

        enqueue({ type: 'CELL_EDIT_END', payload: {} });
        asset[editField] = editValue.trim();
        editField = null;
    }
</script>

{#if editField}
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

        <div class="bg-bg-card rounded-xl border border-border p-4">
            <label class="block text-sm font-medium text-text-secondary mb-2">
                {fieldLabels[editField] || editField}
            </label>

            {#if constrainedFields[editField]}
                <select
                    bind:value={editValue}
                    class="w-full p-3 border rounded-lg bg-bg-input border-border-strong focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
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
                    class="w-full p-3 border rounded-lg bg-bg-input border-border-strong focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                />
            {/if}

            <p class="text-xs text-text-muted mt-2">
                Current value: <span class="font-medium">{asset[editField] ?? 'empty'}</span>
            </p>
        </div>

        <div class="flex gap-3 mt-2">
            <button
                onclick={backToDetail}
                class="flex-1 py-3 px-4 border border-border-strong rounded-lg font-medium text-text-secondary hover:bg-neutral-50 dark:hover:bg-neutral-700 active:bg-neutral-100"
            >
                Cancel
            </button>
            <button
                onclick={saveEdit}
                class="flex-1 py-3 px-4 bg-btn-primary text-white text-shadow-warm rounded-lg font-medium hover:bg-btn-primary-hover active:bg-blue-800"
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
            <h1 class="text-xl font-bold flex-1 text-center pr-10">Asset Details</h1>
        </div>

        {#if presenceStore.rowLocks[String(asset.id)]}
            {@const rowLock = presenceStore.rowLocks[String(asset.id)]}
            <div class="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium"
                style="background-color: {rowLock.color}15; color: {rowLock.color};">
                <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <span>Being audited by {rowLock.firstname} {rowLock.lastname}</span>
            </div>
        {/if}

        <div class="flex-grow overflow-y-auto">
            <div class="bg-bg-card rounded-xl border border-border divide-y divide-border">
                {#each Object.entries(fieldLabels) as [key, label]}
                    {@const cellLock = presenceStore.users.find(u => u.row === asset.id && u.col === key && u.isLocked)}
                    {@const pendingCell = presenceStore.pendingCells.find(p => p.assetId === asset.id && p.key === key)}
                    {@const lockInfo = cellLock || pendingCell}
                    <div
                        class="flex items-center justify-between px-4 py-3 gap-2"
                        style="{lockInfo ? `background-color: ${lockInfo.color}15;` : ''}"
                    >
                        <div class="min-w-0 flex-1">
                            <p class="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</p>
                            <p class="text-sm mt-0.5 break-words">{asset[key] ?? '-'}</p>
                        </div>
                        {#if lockInfo}
                            <div class="flex items-center gap-1 text-xs flex-shrink-0" style="color: {lockInfo.color}">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                </svg>
                            </div>
                        {/if}
                        {#if editableFields.includes(key) && !lockInfo && !presenceStore.rowLocks[String(asset.id)]}
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
