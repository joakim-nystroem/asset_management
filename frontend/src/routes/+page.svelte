<script lang="ts">
  import type { PageProps } from './$types';
  import { replaceState } from '$app/navigation';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import { queryStore } from '$lib/data/queryStore.svelte';
  import { urlStore } from '$lib/data/urlStore.svelte';
  import EventListener from '$lib/grid/eventQueue/EventListener.svelte';
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
  // svelte-ignore state_referenced_locally
  assetStore.locations = data.locations ?? [];
  // svelte-ignore state_referenced_locally
  assetStore.statuses = data.statuses ?? [];
  // svelte-ignore state_referenced_locally
  assetStore.conditions = data.conditions ?? [];
  // svelte-ignore state_referenced_locally
  assetStore.departments = data.departments ?? [];


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


</script>

<div class="px-4 py-2 h-full">
  <EventListener>
    <div class="flex flex-col gap-2">
      <Toolbar />
      <GridContainer />
    </div>
  </EventListener>
</div>
