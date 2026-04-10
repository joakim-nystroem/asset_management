<script lang="ts">
  import type { PageProps } from './$types';
  import { replaceState } from '$app/navigation';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import { queryStore } from '$lib/data/queryStore.svelte';
  import { urlStore } from '$lib/data/urlStore.svelte';
  import { realtime } from '$lib/utils/realtimeManager.svelte';
  import { connectionStore } from '$lib/data/connectionStore.svelte';
  import { resetEditState } from '$lib/utils/gridHelpers';

  // Reset selection/edit state when navigating away from grid
  $effect(() => {
    return () => resetEditState();
  });
  import KeyboardHandler from '$lib/grid/components/keyboard-handler/KeyboardHandler.svelte';
  import Toolbar from '$lib/grid/components/toolbar/Toolbar.svelte';
  import GridContainer from '$lib/grid/components/grid-container/GridContainer.svelte';
  let { data }: PageProps = $props();

  // Seed URL store from server data
  // svelte-ignore state_referenced_locally
  urlStore.url = data.initialUrl;

  // Sync URL store changes to browser URL (skip initial — URL is already correct)
  let urlSeeded = false;
  $effect(() => {
    const url = urlStore.url;
    if (!urlSeeded) { urlSeeded = true; return; }
    if (url) replaceState(url, {});
  });

  // Seed the store with server load data

  // svelte-ignore state_referenced_locally
  assetStore.baseAssets = data.assets ?? [];
  // svelte-ignore state_referenced_locally
  assetStore.displayedAssets = data.searchResults ?? data.assets ?? [];

  // Seed query store from URL params (server-resolved)
  // svelte-ignore state_referenced_locally
  queryStore.view = data.initialView ?? 'default';
  // svelte-ignore state_referenced_locally
  queryStore.q = data.initialQ ?? '';
  // svelte-ignore state_referenced_locally
  queryStore.filters = (data.initialFilters ?? []).flatMap((f: string) => {
    const i = f.indexOf(':');
    return i > 0 ? [{ key: f.slice(0, i), value: f.slice(i + 1) }] : [];
  });
  // svelte-ignore state_referenced_locally
  queryStore.hiddenStatuses = data.hiddenStatuses ?? ['Retired'];

  // Subscribe to grid room when WS connects (re-subscribes after logout/reconnect)
  $effect(() => {
    if (connectionStore.status === 'connected') {
      realtime.sendSubscribe('grid');
    }
  });

</script>

<div class="px-4 h-full">
  <KeyboardHandler>
    <div class="flex flex-col">
      <Toolbar />
      <GridContainer />
    </div>
  </KeyboardHandler>
</div>
