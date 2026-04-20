import { DEFAULT_ROW_HEIGHT } from '$lib/grid/gridConfig';

// Writable client state for the user's grid preferences. Seeded from
// page.data.user.settings in the root layout; mutated directly by UI (e.g.
// the segmented row-height picker in the settings dropdown) for optimistic
// updates, then POSTed to the server to persist.
export const gridPrefsStore = $state<{ rowHeight: number }>({
    rowHeight: DEFAULT_ROW_HEIGHT,
});

export const ROW_HEIGHT_PRESETS = [24, 32, 40] as const;
export type RowHeight = typeof ROW_HEIGHT_PRESETS[number];
