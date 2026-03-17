// frontend/src/lib/data/assetStore.svelte.ts
// Module-level $state singleton for asset data.
// Seeded by +page.svelte on init. Mutated by EventHandler after API calls.
// Imported directly by grid components and handlers — no context needed.

export const assetStore = $state({
  baseAssets: [] as Record<string, any>[],
  displayedAssets: [] as Record<string, any>[],
  locations: [] as string[],
  statuses: [] as string[],
  conditions: [] as string[],
  departments: [] as string[],
});
