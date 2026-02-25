import type { Attachment } from 'svelte/attachments';
import {
  createInteractionHandler,
  type InteractionCallbacks
} from '$lib/utils/interaction/interactionHandler';

// State shape expected by createInteractionHandler
type ShortcutState = Parameters<typeof createInteractionHandler>[0];

/**
 * Svelte 5 attachable factory for grid keyboard/mouse shortcuts.
 *
 * Usage in GridOverlays.svelte:
 *   <div {@attach gridShortcuts(shortcutState, callbacks)}>
 *
 * IMPORTANT: Create `shortcutState` as a stable object reference in the
 * component script (not inline in the template). Inline object literals
 * create new references on every render, causing the attachment to
 * re-run and re-register window listeners unnecessarily.
 *
 * The attachment mounts window listeners via createInteractionHandler
 * and returns the cleanup function. Svelte calls cleanup on element unmount.
 */
export function gridShortcuts(
  state: ShortcutState,
  callbacks: InteractionCallbacks
): Attachment<HTMLElement> {
  return (_element: HTMLElement) => {
    const mount = createInteractionHandler(state, callbacks);
    const removeListeners = mount(window);
    // Return cleanup: called by Svelte when the element is destroyed
    return removeListeners;
  };
}
