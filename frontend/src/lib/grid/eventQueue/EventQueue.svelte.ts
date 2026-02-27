import type { Filter } from '$lib/data/searchManager.svelte';

// ─── GridEvent discriminated union ────────────────────────────────────────────

// COMMIT mode:'update' — existing row changes (POST /api/update)
// COMMIT mode:'create' — new row creation (POST /api/create/asset)
// COMMIT subsumes ADD_ROWS — one event type, two modes
type CommitEvent = { type: 'COMMIT'; mode: 'update' | 'create' };

// FILTER — search/filter query changed
type FilterEvent = { type: 'FILTER'; q: string; filters: Filter[]; view: string };

// DISCARD — revert all pending changes
type DiscardEvent = { type: 'DISCARD' };

// VIEW_CHANGE carries q and filters because after loading the new view's base
// data, it may need to re-apply search/filter if URL params still have values
type ViewChangeEvent = { type: 'VIEW_CHANGE'; view: string; q: string; filters: Filter[] };

// WS_DELTA — incoming realtime update from another user
type WsDeltaEvent = { type: 'WS_DELTA'; payload: { id: number; key: string; value: any } };

export type GridEvent = CommitEvent | FilterEvent | DiscardEvent | ViewChangeEvent | WsDeltaEvent;

// ─── EventQueueInstance return type ───────────────────────────────────────────

export type EventQueueInstance = {
  enqueue: (event: GridEvent) => void;
  readonly isProcessing: boolean;
};

// ─── createEventQueue — Promise-chain serial FIFO enforcer ────────────────────

export function createEventQueue(handler: (event: GridEvent) => Promise<void>): EventQueueInstance {
  let chain: Promise<void> = Promise.resolve();
  let isProcessing = $state(false);

  function enqueue(event: GridEvent): void {
    chain = chain.then(async () => {
      isProcessing = true;
      try {
        console.log('[EventQueue] START:', event.type);
        // Artificial delay so serialization is visually confirmable in devtools
        await new Promise(r => setTimeout(r, 500));
        await handler(event);
        console.log('[EventQueue] DONE:', event.type);
      } catch (err) {
        console.error('[EventQueue] Unhandled error:', err);
      } finally {
        isProcessing = false;
      }
    });
  }

  return {
    enqueue,
    get isProcessing() { return isProcessing; },
  };
}
