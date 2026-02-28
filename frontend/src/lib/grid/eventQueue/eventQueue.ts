// frontend/src/lib/grid/eventQueue/eventQueue.ts
// Pure TypeScript FIFO queue. No Svelte, no runes, no reactivity.
// Receives events + context proxies, processes them serially.

import { processEvent } from './eventHandler';

type QueueItem = {
  event: { type: string; payload: Record<string, any> };
  contexts: Record<string, any>;
};

let queue: QueueItem[] = [];
let isProcessing = false;

export function enqueue(
  event: { type: string; payload: Record<string, any> },
  contexts: Record<string, any>,
) {
  queue.push({ event, contexts });
  processNext();
}

async function processNext() {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;
  const { event, contexts } = queue.shift()!;

  try {
    await processEvent(event, contexts);
  } catch (error) {
    console.error('[EventQueue] recovered from event failure:', error);
  } finally {
    isProcessing = false;
    processNext();
  }
}
