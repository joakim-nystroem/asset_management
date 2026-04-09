<script lang="ts">
    import type { LayoutProps } from './$types';
    import { assetStore } from '$lib/data/assetStore.svelte';
    import { realtime } from '$lib/utils/realtimeManager.svelte';
    import { connectionStore } from '$lib/data/connectionStore.svelte';

    let { data, children }: LayoutProps = $props();

    // Seed assetStore from layout data
    // svelte-ignore state_referenced_locally
    assetStore.baseAssets = data.assets;
    // svelte-ignore state_referenced_locally
    assetStore.displayedAssets = data.assets;

    // Subscribe to grid room when WS connects
    $effect(() => {
        if (connectionStore.status === 'connected') {
            realtime.sendSubscribe('grid');
        }
    });
</script>

{@render children()}
