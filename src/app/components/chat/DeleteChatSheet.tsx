import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Trash2 } from '@/app/components/icons';
import { RailCover } from '@/lib/railActions';

/**
 * Bottom-sheet confirmation for removing a chat from the list. Lives at the
 * bottom so it never sits under the front camera (iPhone Duo, notch, island).
 */
export const DeleteChatSheet: React.FC<{
  open: boolean;
  chatName?: string;
  deleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** Other deletions reuse the sheet with their own wording. */
  title?: string;
  body?: string;
  confirmLabel?: string;
}> = ({ open, chatName, deleting, onCancel, onConfirm, title, body, confirmLabel = 'Delete' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <React.Fragment key="delete-chat">
          <RailCover sheet />
          <motion.div
            key="delete-chat-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="bw-rail-sheet fixed inset-0 z-[200] bg-black/60"
          />
          <motion.div
            key="delete-chat-sheet"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-chat-title"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 360 }}
            className="bw-rail-sheet fixed bottom-0 left-0 right-0 z-[201] bg-sheet text-sheet-foreground rounded-t-[32px] sm:rounded-[32px] px-5 pt-3 sm:max-w-lg sm:mx-auto sm:bottom-6 flex flex-col gap-4"
            style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)' }}
          >
            <span className="mx-auto w-10 h-[5px] rounded-full bg-sheet-foreground/85" aria-hidden />
            <div className="flex flex-col gap-1">
              <span id="delete-chat-title" className="bw-label-md [overflow-wrap:anywhere]">
                {title ?? (chatName ? `Delete chat with ${chatName}?` : 'Delete this chat?')}
              </span>
              <span className="bw-body-sm text-sheet-foreground/70">
                {body ??
                  'It disappears from your list. The others keep the conversation, and it comes back if someone writes again.'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="min-h-12 rounded-full border border-sheet-foreground/25 bw-button-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={deleting}
                className="flex items-center justify-center gap-2 min-h-12 rounded-full bg-destructive-solid text-white bw-button-sm disabled:opacity-60"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Trash2 className="w-4 h-4" aria-hidden />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>,
    document.body
  );
};
