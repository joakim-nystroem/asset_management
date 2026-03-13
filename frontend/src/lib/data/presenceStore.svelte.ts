import type { PresenceEntry } from '$lib/context/gridContext.svelte';

export type PendingCellEntry = {
  userId: number;
  assetId: number;
  key: string;
  firstname: string;
  lastname: string;
  color: string;
};

export const presenceStore = $state({
  users: [] as PresenceEntry[],
  pendingCells: [] as PendingCellEntry[],
});
