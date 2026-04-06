<script lang="ts">
    import type { PageData } from './$types';
    import { base } from '$app/paths';
    import { onDestroy } from 'svelte';
    import { realtime } from '$lib/utils/realtimeManager.svelte';
    import { connectionStore } from '$lib/data/connectionStore.svelte';
    import { auditStore } from '$lib/data/auditStore.svelte';
    import { presenceStore } from '$lib/data/presenceStore.svelte';
    import { toastState } from '$lib/toast/toastState.svelte';

    let { data }: { data: PageData } = $props();

    // Subscribe to audit WS room
    $effect(() => {
        if (connectionStore.status === 'connected') {
            realtime.sendSubscribe('audit');
        }
    });

    // Seed auditStore from server data
    // svelte-ignore state_referenced_locally
    auditStore.baseAssignments = data.assets;
    // svelte-ignore state_referenced_locally
    auditStore.displayedAssignments = data.assets;
    // svelte-ignore state_referenced_locally
    auditStore.users = data.users;
    // svelte-ignore state_referenced_locally
    auditStore.cycle = data.cycle;
    // svelte-ignore state_referenced_locally
    auditStore.progress = data.status ?? { total: 0, pending: 0, completed: 0 };
    // svelte-ignore state_referenced_locally
    auditStore.userProgress = data.userProgress;

    let user = $derived(data.user);

    // Search state
    let searchTerm = $state('');
    let searchInput = $state('');

    // Scanner state
    let html5QrCode: any = $state(null);
    let isScanning = $state(false);
    const scannerId = "barcode-reader-audit";
    let currentZoom = $state(1);

    // Derive from auditStore
    let myAssignments = $derived(
        auditStore.displayedAssignments.filter(a => a.assigned_to === user?.id && !a.completed_at)
    );

    let results = $derived.by(() => {
        if (!searchTerm) return [...myAssignments];
        const q = searchTerm.toLowerCase();
        return myAssignments.filter((a) => {
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

    function executeSearch() {
        searchTerm = searchInput;
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
            const { Html5QrcodeSupportedFormats } = await import('html5-qrcode');
            html5QrCode = new Html5Qrcode(scannerId, {
                verbose: false,
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.ITF,
                    Html5QrcodeSupportedFormats.CODE_93,
                ],
            });
            try {
                await html5QrCode.start(
                    { facingMode: "environment" },
                    { fps: 30, aspectRatio: 1.777778, disableFlip: true },
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

    function formatDate(val: Date | string | null): string {
        if (!val) return '-';
        try {
            return (val instanceof Date ? val : new Date(val)).toLocaleDateString();
        } catch {
            return String(val);
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

{:else}
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
                {myAssignments.length} asset{myAssignments.length !== 1 ? 's' : ''} assigned to you for audit
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
                        {#each visibleItems as asset (asset.asset_id)}
                            {@const lockKey = String(asset.asset_id)}
                            {@const lock = presenceStore.rowLocks[lockKey]}
                            <a
                                href="/mobile/audit/{asset.asset_id}"
                                onclick={(e) => {
                                    if (lock) {
                                        e.preventDefault();
                                        toastState.addToast(`Locked by ${lock.firstname} ${lock.lastname}`, 'error');
                                    }
                                }}
                                class="block w-full text-left p-4 border rounded-lg shadow-sm mb-2 transition-colors
                                    {lock ? 'border-l-4' : 'bg-white dark:bg-neutral-800 dark:border-neutral-700 active:bg-neutral-50 dark:active:bg-neutral-700'}"
                                style="{lock ? `background-color: ${lock.color}15; border-left-color: ${lock.color};` : ''}"
                                style:height="{rowHeight - 8}px"
                            >
                                <div class="flex justify-between items-start">
                                    <div class="min-w-0 flex-1">
                                        <p class="font-bold text-base truncate">{asset.wbd_tag || 'No Tag'}</p>
                                        <p class="text-sm text-neutral-600 dark:text-neutral-300 truncate">{asset.asset_type} - {asset.manufacturer} {asset.model}</p>
                                        <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">{asset.location} | {asset.node}</p>
                                        {#if asset.audit_start_date}
                                            <p class="text-xs mt-1 font-medium text-amber-600 dark:text-amber-400">
                                                Audit started: {formatDate(asset.audit_start_date)}
                                            </p>
                                        {/if}
                                        {#if lock}
                                            <div class="flex items-center gap-1 text-xs mt-1" style="color: {lock.color}">
                                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2">
                                                    <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                                </svg>
                                                <span>{lock.firstname} {lock.lastname}</span>
                                            </div>
                                        {/if}
                                    </div>
                                    <svg class="w-5 h-5 text-neutral-400 flex-shrink-0 ml-2 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </a>
                        {/each}
                    </div>
                </div>
            </div>
        {/if}
    </div>
{/if}

{#if isScanning}
    <!-- FULL-SCREEN SCANNER OVERLAY -->
    <div class="fixed inset-0 z-50 bg-black flex flex-col">
        <div class="flex items-center justify-between px-4 py-3 bg-black/80">
            <h2 class="text-white font-semibold text-lg">Scan Barcode</h2>
            <button
                onclick={toggleScanner}
                class="px-4 py-2 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 active:bg-red-800"
            >
                Close
            </button>
        </div>

        <div class="flex-grow relative overflow-hidden">
            <div id={scannerId} class="w-full h-full"></div>
            <div class="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 opacity-80 pointer-events-none z-10"></div>
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-44 pointer-events-none z-10">
                <div class="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/60 rounded-tl"></div>
                <div class="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/60 rounded-tr"></div>
                <div class="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/60 rounded-bl"></div>
                <div class="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/60 rounded-br"></div>
            </div>
        </div>

        <div class="flex gap-3 justify-center px-4 py-4 bg-black/80">
            <button onclick={() => applyZoom(0.5)} class="px-5 py-2.5 text-sm font-medium rounded-lg {currentZoom === 0.5 ? 'bg-blue-600 text-white' : 'bg-neutral-700 text-neutral-300'}">
                x0.5
            </button>
            <button onclick={() => applyZoom(1)} class="px-5 py-2.5 text-sm font-medium rounded-lg {currentZoom === 1 ? 'bg-blue-600 text-white' : 'bg-neutral-700 text-neutral-300'}">
                x1
            </button>
            <button onclick={() => applyZoom(2)} class="px-5 py-2.5 text-sm font-medium rounded-lg {currentZoom === 2 ? 'bg-blue-600 text-white' : 'bg-neutral-700 text-neutral-300'}">
                x2
            </button>
            <button onclick={() => applyZoom(5)} class="px-5 py-2.5 text-sm font-medium rounded-lg {currentZoom === 5 ? 'bg-blue-600 text-white' : 'bg-neutral-700 text-neutral-300'}">
                x5
            </button>
        </div>
    </div>
{/if}
