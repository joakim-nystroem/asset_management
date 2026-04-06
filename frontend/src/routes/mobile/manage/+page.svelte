<script lang="ts">
    import type { PageData } from './$types';
    import { base } from '$app/paths';
    import { onDestroy } from 'svelte';
    import { realtime } from '$lib/utils/realtimeManager.svelte';
    import { connectionStore } from '$lib/data/connectionStore.svelte';
    import { assetStore } from '$lib/data/assetStore.svelte';

    let { data }: { data: PageData } = $props();

    // Subscribe to grid WS room
    $effect(() => {
        if (connectionStore.status === 'connected') {
            realtime.sendSubscribe('grid');
        }
    });

    // Seed assetStore from server data
    // svelte-ignore state_referenced_locally
    assetStore.baseAssets = data.assets;
    // svelte-ignore state_referenced_locally
    assetStore.displayedAssets = data.assets;

    let user = $derived(data.user);

    // Search state
    let searchTerm = $state('');
    let searchInput = $state('');

    // Scanner state
    let html5QrCode: any = $state(null);
    let isScanning = $state(false);
    const scannerId = "barcode-reader-manage";
    let currentZoom = $state(1);

    // Derive from assetStore
    let results = $derived.by(() => {
        if (!searchTerm) return [...assetStore.displayedAssets];
        const q = searchTerm.toLowerCase();
        return assetStore.displayedAssets.filter((a: Record<string, any>) => {
            return Object.values(a).some(v =>
                v != null && String(v).toLowerCase().includes(q)
            );
        });
    });

    // Virtual scrolling
    let container: HTMLDivElement | null = $state(null);
    let scrollTop = $state(0);
    let containerHeight = $state(0);
    const rowHeight = 120;
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
</script>

<!-- LIST VIEW -->
<div class="flex flex-col gap-3 p-4 h-full">
    <div class="flex items-center gap-2 mb-1">
        <a href="{base}/mobile" class="flex items-center text-blue-600 dark:text-blue-400 font-medium text-sm">
            <svg class="w-5 h-5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back
        </a>
        <h1 class="text-xl font-bold flex-1 text-center pr-10">Manage Assets</h1>
    </div>

    <div class="flex flex-col gap-2">
        <input
            type="text"
            placeholder="Search assets..."
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

    <p class="text-sm text-neutral-500 dark:text-neutral-400">{results.length} assets</p>

    <div bind:this={container} class="flex-grow overflow-y-auto" onscroll={(e) => scrollTop = e.currentTarget.scrollTop}>
        <div style="height: {totalHeight}px; position: relative;">
            <div style="position: absolute; top: {offsetY}px; left: 0; right: 0; width: 100%;">
                {#each visibleItems as asset (asset.id)}
                    <a
                        href="/mobile/manage/{asset.id}"
                        class="block w-full text-left p-4 border rounded-lg shadow-sm bg-white dark:bg-neutral-800 dark:border-neutral-700 mb-2 active:bg-neutral-50 dark:active:bg-neutral-700 transition-colors"
                        style="height: {rowHeight - 8}px;"
                    >
                        <div class="flex justify-between items-start">
                            <div class="min-w-0 flex-1">
                                <p class="font-bold text-base truncate">{asset.wbd_tag || 'No Tag'}</p>
                                <p class="text-sm text-neutral-600 dark:text-neutral-300 truncate">{asset.asset_type} - {asset.manufacturer} {asset.model}</p>
                                <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate">{asset.location} | {asset.node}</p>
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
</div>

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
        </div>
    </div>
{/if}
