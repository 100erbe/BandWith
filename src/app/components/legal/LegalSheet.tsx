import React from 'react';
import { createPortal } from 'react-dom';
import { X } from '@/app/components/icons';
import { IconButton } from '@/app/components/bw/Screen';

export type LegalDoc = 'terms' | 'privacy';

const TITLES: Record<LegalDoc, string> = { terms: 'Terms of Service', privacy: 'Privacy Policy' };

/** Bundled with the app (public/legal) and served on the web domains too. */
export const legalUrl = (doc: LegalDoc) => `/legal/${doc}.html`;

/**
 * Terms / Privacy viewer. The documents are static pages shipped in the app
 * bundle, so they open offline and inside the native WebView without leaving
 * the app.
 */
export const LegalSheet: React.FC<{ doc: LegalDoc | null; onClose: () => void }> = ({ doc, onClose }) => {
  if (!doc || typeof document === 'undefined') return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={TITLES[doc]}
      className="bw-pane-detail fixed inset-0 z-[200] flex flex-col bg-background text-foreground"
      style={{ paddingTop: 'var(--safe-top, env(safe-area-inset-top))' }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 bw-status-clear">
        <span className="bw-label-sm">{TITLES[doc]}</span>
        <IconButton label="Close" variant="filled" icon={<X />} onClick={onClose} />
      </div>
      <iframe title={TITLES[doc]} src={legalUrl(doc)} className="flex-1 w-full border-0 bg-background" />
    </div>,
    document.body,
  );
};
