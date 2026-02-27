<script lang="ts">
  import type { PageProps } from './$types';
  import GridContextProvider from '$lib/context/GridContextProvider.svelte';
  import EventListener from '$lib/grid/eventQueue/EventListener.svelte';
  import Toolbar from '$lib/components/grid/Toolbar.svelte';
  import GridContainer from '$lib/components/grid/GridContainer.svelte';
  import ContextMenu from '$lib/grid/components/context-menu/contextMenu.svelte';

  let { data }: PageProps = $props();

  // Data ownership — ALL server load data lives here as $state
  // svelte-ignore state_referenced_locally
  let baseAssets: Record<string, any>[] = $state(data.assets ?? []);
  // svelte-ignore state_referenced_locally
  let filteredAssets: Record<string, any>[] = $state(data.searchResults ?? data.assets ?? []);
  // svelte-ignore state_referenced_locally
  let user = $state(data.user ?? null);
  // svelte-ignore state_referenced_locally
  let locations = $state(data.locations ?? []);
  // svelte-ignore state_referenced_locally
  let statuses = $state(data.statuses ?? []);
  // svelte-ignore state_referenced_locally
  let conditions = $state(data.conditions ?? []);
  // svelte-ignore state_referenced_locally
  let departments = $state(data.departments ?? []);
</script>

<GridContextProvider>
  <div class="px-4 py-2 flex-grow flex flex-col">
    <EventListener
      {user}
      {baseAssets}
      {filteredAssets}
      setBaseAssets={(v) => { baseAssets = v; }}
      setFilteredAssets={(v) => { filteredAssets = v; }}
      {locations}
      {statuses}
      {conditions}
      {departments}
    />
    <Toolbar />
    <GridContainer />
    <ContextMenu />
  </div>
</GridContextProvider>
