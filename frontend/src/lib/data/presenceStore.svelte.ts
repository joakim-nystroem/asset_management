type PresenceEntry = {
  id: number;
  firstname: string;
  lastname: string;
  color: string;
  row: number;
  col: string;
  isLocked: boolean;
};

type PendingCellEntry = {
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
