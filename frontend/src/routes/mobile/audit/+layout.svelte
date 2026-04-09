<script lang="ts">
    import type { LayoutProps } from './$types';
    import { auditStore } from '$lib/data/auditStore.svelte';
    import { realtime } from '$lib/utils/realtimeManager.svelte';
    import { connectionStore } from '$lib/data/connectionStore.svelte';

    let { data, children }: LayoutProps = $props();

    // Seed audit store from layout data
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

    // Subscribe to audit room when WS connects
    $effect(() => {
        if (connectionStore.status === 'connected') {
            realtime.sendSubscribe('audit');
        }
    });
</script>

{@render children()}
