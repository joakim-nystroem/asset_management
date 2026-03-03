<script lang="ts">
  import type { PageProps } from './$types';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import GridContextProvider from '$lib/context/GridContextProvider.svelte';
  import EventListener from '$lib/grid/eventQueue/EventListener.svelte';
  import Toolbar from '$lib/grid/components/toolbar/Toolbar.svelte';
  import GridContainer from '$lib/grid/components/grid-container/GridContainer.svelte';

  let { data }: PageProps = $props();

  // Seed the store with server load data

  // svelte-ignore state_referenced_locally
  assetStore.baseAssets = data.assets ?? [];
  // svelte-ignore state_referenced_locally
  assetStore.filteredAssets = data.searchResults ?? data.assets ?? [];
  // svelte-ignore state_referenced_locally
  assetStore.locations = data.locations ?? [];
  // svelte-ignore state_referenced_locally
  assetStore.statuses = data.statuses ?? [];
  // svelte-ignore state_referenced_locally
  assetStore.conditions = data.conditions ?? [];
  // svelte-ignore state_referenced_locally
  assetStore.departments = data.departments ?? [];
</script>

<GridContextProvider>
  <div class="px-4 py-2 flex-grow flex flex-col">
    <EventListener />
    <Toolbar />
    <GridContainer />
  </div>
</GridContextProvider>
