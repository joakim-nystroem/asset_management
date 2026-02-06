<script lang="ts">
    import type { PageData } from './$types';
    import { base } from '$app/paths';
    import { onDestroy } from 'svelte';

    let { data }: { data: PageData } = $props();
    let assets = $state(data.assets);
    let locations: string[] = $state(data.locations);
    let statuses: string[] = $state(data.statuses);
    let conditions: string[] = $state(data.conditions);
    let user = $derived(data.user);

    // Search state
    let searchTerm = $state('');
    let searchInput = $state('');

    // View state: 'list' | 'detail' | 'edit' | 'confirm' | 'report'
    let view = $state<'list' | 'detail' | 'edit' | 'confirm' | 'report'>('list');
    let selectedAsset = $state<Record<string, any> | null>(null);
    let editField = $state<string | null>(null);
    let editValue = $state<string>('');
    let saving = $state(false);
    let completing = $state(false);
    let saveMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
    let selectedIssue = $state('');
    let issueComment = $state('');

    // Audit issue categories
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

    // Scanner state
    let html5QrCode: any = $state(null);
    let isScanning = $state(false);
    const scannerId = "barcode-reader-audit";
    let currentZoom = $state(1);

    // Filtered results
    let results = $derived.by(() => {
        if (!searchTerm) return [...assets];
        const q = searchTerm.toLowerCase();
        return assets.filter((a: Record<string, any>) => {
            return Object.values(a).some(v =>
                v != null && String(v).toLowerCase().includes(q)
            );
        });
    });

    // Virtual scrolling
    let container: HTMLDivElement | null = $state(null);
    let scrollTop = $state(0);
    let containerHeight = $state(0);
    const rowHeight = 140;
    const overscan = 10;

    $effect(() => {
        if (!container) return;
        containerHeight = container.clientHeight;
        const resizeObserver = new ResizeObserver(() => {
            if (container) containerHeight = container.clientHeight;
        });
        resizeObserver.observe(container);
        return () => resizeObserver.disconnect();
    });

    const { startIndex, endIndex } = $derived.by(() => {
        const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
        const end = Math.min(results.length, start + Math.ceil(containerHeight / rowHeight) + overscan * 2);
        return { startIndex: start, endIndex: end };
    });

    const visibleItems = $derived(results.slice(startIndex, endIndex));
    const totalHeight = $derived(results.length * rowHeight + 60);
    const offsetY = $derived(startIndex * rowHeight);

    // Constrained fields
    const constrainedFields: Record<string, string[]> = $derived({
        location: locations,
        status: statuses,
        condition: conditions,
    });

    // Fields to display
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
        last_audited_on: 'Last Audited On',
        last_audited_by: 'Last Audited By',
        next_audit_on: 'Next Audit On',
        to_be_audited_by_date: 'Audit Deadline',
        to_be_audited_by: 'Assigned To',
        audit_result: 'Audit Result',
    };

    const editableFields = [
        'wbd_tag', 'asset_type', 'asset_set_type', 'manufacturer', 'model',
        'serial_number', 'bu_estate', 'department', 'location', 'node',
        'shelf_cabinet_table', 'status', 'condition', 'comment',
    ];

    function executeSearch() {
        searchTerm = searchInput;
    }

    function openDetail(asset: Record<string, any>) {
        selectedAsset = { ...asset };
        view = 'detail';
        saveMessage = null;
    }

    function openEdit(field: string) {
        editField = field;
        editValue = selectedAsset?.[field] ?? '';
        view = 'edit';
        saveMessage = null;
    }

    function openConfirm() {
        view = 'confirm';
        saveMessage = null;
    }

    function openReport() {
        selectedIssue = '';
        issueComment = '';
        view = 'report';
        saveMessage = null;
    }

    async function submitReport() {
        if (!selectedAsset || !selectedIssue) return;
        completing = true;
        saveMessage = null;

        const auditResult = selectedIssue === 'Other' && issueComment
            ? `Issue: ${selectedIssue} - ${issueComment}`
            : `Issue: ${selectedIssue}`;

        try {
            const response = await fetch(`${base}/api/audit/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assetId: selectedAsset.id,
                    auditResult,
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Report submission failed');
            }

            assets = assets.filter((a: Record<string, any>) => a.id !== selectedAsset!.id);
            saveMessage = { type: 'success', text: 'Issue reported successfully' };
            setTimeout(() => backToList(), 1000);
        } catch (err) {
            saveMessage = { type: 'error', text: err instanceof Error ? err.message : 'Failed to report issue' };
            view = 'detail';
        } finally {
            completing = false;
        }
    }

    function backToList() {
        selectedAsset = null;
        editField = null;
        view = 'list';
        saveMessage = null;
    }

    function backToDetail() {
        editField = null;
        view = 'detail';
        saveMessage = null;
    }

    async function saveEdit() {
        if (!selectedAsset || !editField) return;
        saving = true;
        saveMessage = null;

        try {
            const response = await fetch(`${base}/api/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([{
                    rowId: String(selectedAsset.id),
                    columnId: editField,
                    oldValue: selectedAsset[editField] ?? null,
                    newValue: editValue,
                }]),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Update failed');
            }

            // Update local state
            selectedAsset[editField] = editValue;
            const idx = assets.findIndex((a: Record<string, any>) => a.id === selectedAsset!.id);
            if (idx !== -1) {
                assets[idx] = { ...assets[idx], [editField!]: editValue };
            }

            saveMessage = { type: 'success', text: 'Saved successfully' };
            setTimeout(() => backToDetail(), 800);
        } catch (err) {
            saveMessage = { type: 'error', text: err instanceof Error ? err.message : 'Save failed' };
        } finally {
            saving = false;
        }
    }

    async function completeAudit() {
        if (!selectedAsset) return;
        completing = true;
        saveMessage = null;

        try {
            const response = await fetch(`${base}/api/audit/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assetId: selectedAsset.id,
                    auditResult: 'Record is up-to-date and correct',
                }),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Audit completion failed');
            }

            // Remove from list
            assets = assets.filter((a: Record<string, any>) => a.id !== selectedAsset!.id);
            saveMessage = { type: 'success', text: 'Audit completed successfully' };
            setTimeout(() => backToList(), 1000);
        } catch (err) {
            saveMessage = { type: 'error', text: err instanceof Error ? err.message : 'Failed to complete audit' };
            view = 'detail';
        } finally {
            completing = false;
        }
    }

    // Scanner
    async function toggleScanner() {
        if (isScanning) {
            await stopScanner();
        } else {
            startScanner();
        }
    }

    async function startScanner() {
        const { Html5Qrcode } = await import('html5-qrcode');
        isScanning = true;

        setTimeout(async () => {
            if (!document.getElementById(scannerId)) return;
            html5QrCode = new Html5Qrcode(scannerId);
            try {
                await html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 20, qrbox: { width: 280, height: 160 }, aspectRatio: 1.777778, disableFlip: true },
                    (decodedText: string) => {
                        searchInput = decodedText;
                        searchTerm = decodedText;
                        stopScanner();
                    },
                    () => {}
                );
            } catch (err) {
                console.error("Scanner failed", err);
                isScanning = false;
            }
        }, 50);
    }

    async function stopScanner() {
        if (html5QrCode && html5QrCode.isScanning) {
            await html5QrCode.stop();
        }
        html5QrCode = null;
        isScanning = false;
    }

    async function applyZoom(zoom: number) {
        currentZoom = zoom;
        if (html5QrCode && html5QrCode.isScanning) {
            try {
                const capabilities = html5QrCode.getRunningTrackCameraCapabilities();
                const zoomFeature = capabilities.zoomFeature();
                if (zoomFeature.isSupported()) {
                    const min = zoomFeature.min();
                    const max = zoomFeature.max();
                    const targetZoom = Math.min(max, Math.max(min, zoom));
                    await zoomFeature.apply(targetZoom);
                }
            } catch (err) {
                // Zoom not supported on this device
            }
        }
    }

    onDestroy(() => {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop();
        }
    });

    function formatDate(val: string | null): string {
        if (!val) return '-';
        try {
            return new Date(val).toLocaleDateString();
        } catch {
            return val;
        }
    }
</script>

{#if !user}
    <!-- NOT LOGGED IN -->
    <div class="flex flex-col items-center justify-center min-h-[60vh] px-4 gap-4">
        <div class="w-16 h-16 bg-neutral-200 dark:bg-neutral-700 rounded-full flex items-center justify-center">
            <svg class="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
        </div>
        <h2 class="text-xl font-bold text-neutral-800 dark:text-neutral-100">Login Required</h2>
        <p class="text-neutral-500 dark:text-neutral-400 text-center">Please log in to view your audit assignments.</p>
        <a href="{base}/login" class="mt-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
            Log In
        </a>
    </div>

{:else if view === 'list'}
    <!-- LIST VIEW -->
    <div class="flex flex-col gap-3 p-4 h-full">
        <div class="flex items-center gap-2 mb-1">
            <a href="{base}/mobile" class="flex items-center text-blue-600 dark:text-blue-400 font-medium text-sm">
                <svg class="w-5 h-5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                Back
            </a>
            <h1 class="text-xl font-bold flex-1 text-center pr-10">Audit Assignments</h1>
        </div>

        <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3">
            <p class="text-sm font-medium text-green-800 dark:text-green-300">
                {assets.length} asset{assets.length !== 1 ? 's' : ''} assigned to you for audit
            </p>
        </div>

        <div class="flex flex-col gap-2">
            <input
                type="text"
                placeholder="Search audit items..."
                class="w-full p-3 border rounded-lg dark:bg-neutral-800 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                bind:value={searchInput}
                onkeydown={(e) => { if (e.key === 'Enter') executeSearch(); }}
            />
            <div class="flex gap-2">
                <button
                    onclick={executeSearch}
                    class="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 font-medium"
                >
                    Search
                </button>
                <button
                    onclick={toggleScanner}
                    class="flex-1 py-3 bg-neutral-600 text-white rounded-lg hover:bg-neutral-700 active:bg-neutral-800 font-medium"
                >
                    {isScanning ? 'Close' : 'Scan'}
                </button>
            </div>
        </div>

        {#if isScanning}
            <div class="relative overflow-hidden rounded-lg border-2 border-blue-500 bg-black">
                <div id={scannerId}></div>
                <!-- Red alignment bar -->
                <div class="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 opacity-70 pointer-events-none z-10"></div>
            </div>
            <!-- Zoom controls -->
            <div class="flex gap-2 justify-center">
                <button onclick={() => applyZoom(0.5)} class="px-4 py-2 text-sm font-medium rounded-lg {currentZoom === 0.5 ? 'bg-blue-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'}">
                    x0.5
                </button>
                <button onclick={() => applyZoom(1)} class="px-4 py-2 text-sm font-medium rounded-lg {currentZoom === 1 ? 'bg-blue-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'}">
                    x1
                </button>
                <button onclick={() => applyZoom(2)} class="px-4 py-2 text-sm font-medium rounded-lg {currentZoom === 2 ? 'bg-blue-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'}">
                    x2
                </button>
            </div>
        {/if}

        {#if results.length === 0}
            <div class="flex flex-col items-center justify-center py-12 text-neutral-500 dark:text-neutral-400">
                <svg class="w-12 h-12 mb-3 text-neutral-300 dark:text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="font-medium">No audit assignments found</p>
                <p class="text-sm mt-1">All caught up!</p>
            </div>
        {:else}
            <div bind:this={container} class="flex-grow overflow-y-auto" onscroll={(e) => scrollTop = e.currentTarget.scrollTop}>
                <div style="height: {totalHeight}px; position: relative;">
                    <div style="position: absolute; top: {offsetY}px; left: 0; right: 0; width: 100%;">
                        {#each visibleItems as asset (asset.id)}
                            <button
                                onclick={() => openDetail(asset)}
                                class="w-full text-left p-4 border rounded-lg shadow-sm bg-white dark:bg-neutral-800 dark:border-neutral-700 mb-2 active:bg-neutral-50 dark:active:bg-neutral-700 transition-colors"
                                style="height: {rowHeight - 8}px;"
                            >
                                <div class="flex justify-between items-start">
                                    <div class="min-w-0 flex-1">
                                        <p class="font-bold text-base truncate">{asset.wbd_tag || 'No Tag'}</p>
                                        <p class="text-sm text-neutral-600 dark:text-neutral-300 truncate">{asset.asset_type} - {asset.manufacturer} {asset.model}</p>
                                        <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">{asset.location} | {asset.node}</p>
                                        {#if asset.to_be_audited_by_date}
                                            <p class="text-xs mt-1 font-medium text-amber-600 dark:text-amber-400">
                                                Deadline: {formatDate(asset.to_be_audited_by_date)}
                                            </p>
                                        {/if}
                                    </div>
                                    <svg class="w-5 h-5 text-neutral-400 flex-shrink-0 ml-2 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </button>
                        {/each}
                    </div>
                </div>
            </div>
        {/if}
    </div>

{:else if view === 'detail' && selectedAsset}
    <!-- DETAIL VIEW -->
    <div class="flex flex-col gap-3 p-4 h-full">
        <div class="flex items-center gap-2 mb-1">
            <button onclick={backToList} class="flex items-center text-blue-600 dark:text-blue-400 font-medium text-sm">
                <svg class="w-5 h-5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                Back
            </button>
            <h1 class="text-xl font-bold flex-1 text-center pr-10">Audit Review</h1>
        </div>

        {#if saveMessage}
            <div class="p-3 rounded-lg text-sm font-medium {saveMessage.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}">
                {saveMessage.text}
            </div>
        {/if}

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
                            <p class="text-sm mt-0.5 break-words">{selectedAsset[key] ?? '-'}</p>
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

{:else if view === 'confirm' && selectedAsset}
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
                Mark asset <span class="font-semibold">{selectedAsset.wbd_tag || selectedAsset.id}</span> as audited?
            </p>
            <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                All details are correct and up-to-date.
            </p>
        </div>

        {#if saveMessage}
            <div class="w-full max-w-sm p-3 rounded-lg text-sm font-medium {saveMessage.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}">
                {saveMessage.text}
            </div>
        {/if}

        <div class="flex gap-3 w-full max-w-sm">
            <button
                onclick={backToDetail}
                disabled={completing}
                class="flex-1 py-3 px-4 border border-neutral-300 dark:border-neutral-600 rounded-lg font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 active:bg-neutral-100"
            >
                Cancel
            </button>
            <button
                onclick={completeAudit}
                disabled={completing}
                class="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {completing ? 'Completing...' : 'Confirm'}
            </button>
        </div>
    </div>

{:else if view === 'report' && selectedAsset}
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
                Reporting issue for: <span class="font-bold">{selectedAsset.wbd_tag || selectedAsset.id}</span>
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

        {#if saveMessage}
            <div class="p-3 rounded-lg text-sm font-medium {saveMessage.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}">
                {saveMessage.text}
            </div>
        {/if}

        <div class="flex gap-3 mt-2">
            <button
                onclick={backToDetail}
                class="flex-1 py-3 px-4 border border-neutral-300 dark:border-neutral-600 rounded-lg font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 active:bg-neutral-100"
            >
                Cancel
            </button>
            <button
                onclick={submitReport}
                disabled={!selectedIssue || completing}
                class="flex-1 py-3 px-4 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 active:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {completing ? 'Submitting...' : 'Submit Report'}
            </button>
        </div>
    </div>

{:else if view === 'edit' && selectedAsset && editField}
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
                Current value: <span class="font-medium">{selectedAsset[editField] ?? 'empty'}</span>
            </p>
        </div>

        {#if saveMessage}
            <div class="p-3 rounded-lg text-sm font-medium {saveMessage.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}">
                {saveMessage.text}
            </div>
        {/if}

        <div class="flex gap-3 mt-2">
            <button
                onclick={backToDetail}
                class="flex-1 py-3 px-4 border border-neutral-300 dark:border-neutral-600 rounded-lg font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 active:bg-neutral-100"
            >
                Cancel
            </button>
            <button
                onclick={saveEdit}
                disabled={saving}
                class="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {saving ? 'Saving...' : 'Save'}
            </button>
        </div>
    </div>
{/if}
