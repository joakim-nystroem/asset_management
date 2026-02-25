<script lang="ts">
  import type { PageProps } from './$types';
  import InventoryGrid from '$lib/components/grid/InventoryGrid.svelte';

  let { data }: PageProps = $props();
</script>

<InventoryGrid
  assets={data.assets}
  keys={data.assets.length > 0 ? Object.keys(data.assets[0]) : []}
  user={data.user}
  locations={data.locations || []}
  statuses={data.statuses || []}
  conditions={data.conditions || []}
  departments={data.departments || []}
  initialView={data.initialView || 'default'}
  searchResults={data.searchResults ?? null}
/>
