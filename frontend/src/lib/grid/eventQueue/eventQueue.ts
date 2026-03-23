// frontend/src/lib/grid/eventQueue/eventQueue.ts
// Pure TypeScript FIFO queue. No Svelte, no runes, no reactivity.
// Receives events, processes them serially.

import { processEvent } from './eventHandler';

type QueueItem = {
  event: { type: string; payload: Record<string, any> };
};

let queue: QueueItem[] = [];
let isProcessing = false;

export function enqueue(
  event: { type: string; payload: Record<string, any> },
) {
  queue.push({ event });
  processNext();
}

async function processNext() {
  if (isProcessing || queue.length === 0) return;

  isProcessing = true;
  const { event } = queue.shift()!;

  try {
    await processEvent(event);
  } catch (error) {
    console.error('[EventQueue] recovered from event failure:', error);
  } finally {
    isProcessing = false;
    processNext();
  }
}
