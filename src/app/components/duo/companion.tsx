import React, { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { usePosture } from '@/lib/posture';

/**
 * Leading companion: on the book layout (two panes), a task open on the
 * trailing page can put something on the leading page next to it, e.g. the
 * new gig wizard shows the calendar / live gig card, the quote wizard a live
 * PDF summary, Home the next gig.
 *
 *   const shown = useLeadingCompanion(<LiveQuoteSummary quote={draft} />);
 *   // render <LeadingCompanionSlot /> once, near the root of the app
 *
 * The most recently mounted caller wins; when it unmounts the previous one
 * comes back. On one pane (phones, closed, Laptop pose) nothing is shown and
 * the hook returns false, so the caller keeps its own inline version.
 */

interface Entry {
  id: number;
  node: React.ReactNode;
}

let entries: Entry[] = [];
let top: React.ReactNode = null;
let seq = 0;
const listeners = new Set<() => void>();

function emit() {
  top = entries.length ? entries[entries.length - 1].node : null;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const getTop = () => top;
const getServerTop = () => null;

/** Whether the leading page is available for a companion right now. */
export function useCompanionAvailable(): boolean {
  const { posture, twoPane } = usePosture();
  return twoPane && (posture === 'book' || posture === 'open-flat');
}

/**
 * Shows `node` on the leading page while the caller is mounted and the book
 * layout is on. Returns true while it is shown.
 */
export function useLeadingCompanion(node: React.ReactNode, enabled = true): boolean {
  const available = useCompanionAvailable();
  const active = enabled && available && node != null && node !== false;
  const idRef = useRef(0);
  if (idRef.current === 0) idRef.current = ++seq;
  const nodeRef = useRef(node);
  nodeRef.current = node;

  useLayoutEffect(() => {
    if (!active) return;
    const id = idRef.current;
    entries = [...entries, { id, node: nodeRef.current }];
    emit();
    return () => {
      entries = entries.filter((e) => e.id !== id);
      emit();
    };
  }, [active]);

  // Keep the shown node current as the caller re-renders.
  useLayoutEffect(() => {
    if (!active) return;
    const id = idRef.current;
    const i = entries.findIndex((e) => e.id === id);
    if (i < 0 || entries[i].node === node) return;
    entries = entries.map((e) => (e.id === id ? { id, node } : e));
    emit();
  });

  return active;
}

/** Renders the current companion over the leading pane. Mount once. */
export const LeadingCompanionSlot: React.FC<{ label?: string }> = ({ label = 'Companion' }) => {
  const node = useSyncExternalStore(subscribe, getTop, getServerTop);
  const available = useCompanionAvailable();
  if (!node || !available || typeof document === 'undefined') return null;
  return createPortal(
    <aside className="bw-leading-companion" aria-label={label}>
      {node}
    </aside>,
    document.body,
  );
};
