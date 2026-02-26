<script lang="ts">
  import type { PageProps } from './$types';
  import GridContextProvider from '$lib/context/GridContextProvider.svelte';
  import DataController from '$lib/components/grid/DataController.svelte';
  import Toolbar from '$lib/components/grid/Toolbar.svelte';
  import GridContainer from '$lib/components/grid/GridContainer.svelte';
  import ContextMenu from '$lib/grid/components/context-menu/contextMenu.svelte';

  let { data }: PageProps = $props();
</script>

<GridContextProvider>
  <div class="px-4 py-2 flex-grow flex flex-col">
    <DataController {data} />
    <Toolbar />
    <GridContainer />
    <ContextMenu />
  </div>
</GridContextProvider>
