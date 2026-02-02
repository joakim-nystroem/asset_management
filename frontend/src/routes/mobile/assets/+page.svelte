<script lang="ts">
    import type { PageData } from './$types';
    import { searchManager } from '$lib/utils/data/searchManager.svelte';
    import { onDestroy } from 'svelte';

    let { data }: { data: PageData } = $props();
    let assets = $state(data.assets);
    let results = $state([...assets]);

    // Scanner state
    let html5QrCode: any = $state(null);
    let isScanning = $state(false);
    const scannerId = "barcode-reader";

    $effect(() => {
        searchManager.term; 
        searchManager.selectedFilters; 

        performSearch();
    });

    async function performSearch() {
        const newResults = await searchManager.search(assets);
        results = newResults;
    };

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
                    { fps: 10, qrbox: { width: 250, height: 150 } },
                    (decodedText: string) => {
                        searchManager.inputValue = decodedText;
                        searchManager.executeSearch();
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

    onDestroy(() => {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop();
        }
    });

    // Virtual Scrolling
    let container: HTMLDivElement | null = $state(null);
    let scrollTop = $state(0);
    let containerHeight = $state(0);
    const rowHeight = 120; // Fixed height for each asset item
    const overscan = 10;   // Render 10 items above and below the viewport

    $effect(() => {
        if (!container) return;
        containerHeight = container.clientHeight;
        const resizeObserver = new ResizeObserver(() => {
            if(container) containerHeight = container.clientHeight;
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

    // Modal state
    let selectedAsset = $state<Record<string, any> | null>(null);

</script>

<div class="flex flex-col gap-4 p-4 h-full">
    <div class="flex gap-2">
        <input
            type="text"
            placeholder="Search assets..."
            class="flex-1 p-2 border rounded dark:bg-neutral-800 focus:outline-none"
            bind:value={searchManager.inputValue}
            onkeyup={() => searchManager.executeSearch()}
        />
        <button 
            onclick={toggleScanner}
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
            {isScanning ? 'Close' : 'Scan'}
        </button>
    </div>

    {#if isScanning}
        <div class="overflow-hidden rounded-lg border-2 border-blue-500 bg-black">
            <div id={scannerId}></div>
        </div>
    {/if}

    <div bind:this={container} class="flex-grow overflow-y-auto" onscroll={(e) => scrollTop = e.currentTarget.scrollTop}>
        <div style="height: {totalHeight}px; position: relative;">
            <div style="position: absolute; top: {offsetY}px; left: 0; right: 0; width: 100%;">
                {#each visibleItems as asset, i (asset.id)}
                    <div class="p-4 border rounded shadow-sm bg-white dark:bg-neutral-900 mb-2 flex justify-between items-center" style="height: {rowHeight - 8}px;">
                        <div>
                            <h2 class="font-bold text-lg">{asset.name}</h2>
                            <p>{asset.asset_type}</p>
                            <p class="text-sm">{asset.node}</p>
                            <p class="text-sm">{asset.location}</p>
                        </div>
                        <button onclick={() => selectedAsset = asset} class="bg-blue-500 text-white px-3 py-1.5 rounded text-sm">
                            Details
                        </button>
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>

{#if selectedAsset}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center" onclick={() => selectedAsset = null}>
    <div class="bg-white dark:bg-neutral-800 rounded-lg shadow-xl p-6 m-4 w-full max-w-lg max-h-[90dvh] flex flex-col" onclick={(e) => e.stopPropagation()}>
        <div class="flex justify-between items-center border-b dark:border-neutral-700 pb-3 mb-4">
            <h3 class="text-2xl font-bold">Asset Details</h3>
            <button onclick={() => selectedAsset = null} class="text-3xl font-light leading-none -mt-1">&times;</button>
        </div>
        <div class="overflow-y-auto">
            <dl>
                {#each Object.entries(selectedAsset) as [key, value]}
                    <div class="flex flex-wrap border-b dark:border-neutral-700 py-2">
                        <dt class="w-1/3 font-semibold text-gray-600 dark:text-neutral-400 capitalize">{key.replace(/_/g, ' ')}</dt>
                        <dd class="w-2/3">{value}</dd>
                    </div>
                {/each}
            </dl>
        </div>
        <div class="mt-6 text-right">
            <button onclick={() => selectedAsset = null} class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Close
            </button>
        </div>
    </div>
</div>
{/if}