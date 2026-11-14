import { handleBackFromStack, useSystemBack } from './backStack';

/**
 * Sheets and dialogs that are open on top of a screen. Android Back (and
 * Escape) closes the top one first, instead of leaving the whole screen
 * underneath (onboarding: Terms/Privacy, invite a member, "Enable Face ID?").
 *
 * They share the app's one back stack (lib/backStack), so the same sheet
 * closes on one press in onboarding and in the signed-in app (Settings).
 */

/** Closes the sheet opened last. False when none is open. */
export function closeTopOverlay(): boolean {
  return handleBackFromStack();
}

/** While `open`, Back / Escape calls `close` (the latest one given). */
export function useCloseOnBack(open: boolean, close: () => void) {
  useSystemBack(open, () => {
    close();
  });
}

/** Escape typed in a field belongs to the field (clearing it, closing a picker). */
export { isEditableTarget } from './backStack';
