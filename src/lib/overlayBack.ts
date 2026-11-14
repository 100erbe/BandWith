import { useEffect, useRef } from 'react';

/**
 * Sheets and dialogs that are open on top of a screen. Android Back (and
 * Escape) closes the top one first, instead of leaving the whole screen
 * underneath (onboarding: Terms/Privacy, invite a member, "Enable Face ID?").
 */
const stack: Array<() => void> = [];

/** Closes the sheet opened last. False when none is open. */
export function closeTopOverlay(): boolean {
  const close = stack[stack.length - 1];
  if (!close) return false;
  close();
  return true;
}

/** While `open`, Back / Escape calls `close` (the latest one given). */
export function useCloseOnBack(open: boolean, close: () => void) {
  const ref = useRef(close);
  ref.current = close;
  useEffect(() => {
    if (!open) return;
    const entry = () => ref.current();
    stack.push(entry);
    return () => {
      const i = stack.lastIndexOf(entry);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [open]);
}

/** Escape typed in a field belongs to the field (clearing it, closing a picker). */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable === true;
}
