<script lang="ts">
  import type { PageProps } from './$types';
  import { assetStore } from '$lib/data/assetStore.svelte';
  import GridContextProvider from '$lib/context/GridContextProvider.svelte';
  import EventOwner from '$lib/grid/eventQueue/EventOwner.svelte';
  import Toolbar from '$lib/components/grid/Toolbar.svelte';
  import GridContainer from '$lib/components/grid/GridContainer.svelte';
  import ContextMenu from '$lib/grid/components/context-menu/contextMenu.svelte';

  let { data }: PageProps = $props();

  // Seed the store with server load data
  assetStore.baseAssets = data.assets ?? [];
  assetStore.filteredAssets = data.searchResults ?? data.assets ?? [];
  assetStore.locations = data.locations ?? [];
  assetStore.statuses = data.statuses ?? [];
  assetStore.conditions = data.conditions ?? [];
  assetStore.departments = data.departments ?? [];
</script>

<GridContextProvider>
  <div class="px-4 py-2 flex-grow flex flex-col">
    <EventOwner />
    <Toolbar />
    <GridContainer />
    <ContextMenu />
  </div>
</GridContextProvider>
