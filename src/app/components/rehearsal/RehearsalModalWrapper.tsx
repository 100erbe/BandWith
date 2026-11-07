import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft } from '@/app/components/icons';
import { usePeekingScroll } from '@/app/components/ui/PeekingScrollContainer';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  icon?: React.ElementType;
  bgColor?: string;
  textColor?: string;
}

export const RehearsalModalWrapper: React.FC<Props> = ({
  isOpen,
  onClose,
  title,
  children,
  bgColor = 'var(--wizard-accent, var(--accent-rehearsal))',
  textColor = 'var(--wizard-accent-fg, var(--surface-inverse-fg, white))',
}) => {
  const { containerRef, maskStyle } = usePeekingScroll<HTMLDivElement>();

  return (
    <AnimatePresence>
      {isOpen && (
        <div data-wizard-type="rehearsal">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]"
            style={{ backgroundColor: bgColor }}
          />
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed inset-0 z-[101] flex flex-col overflow-y-auto"
            style={{
              backgroundColor: bgColor,
              ...maskStyle,
            }}
          >
            <div
              className="flex flex-col gap-8 px-4 pb-8 max-w-2xl mx-auto w-full"
              style={{ paddingTop: 'calc(var(--wizard-header-pt, max(env(safe-area-inset-top, 0px), 56px)) + 8px)' }}
            >
              {/* Header */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-11 h-11 rounded-full flex items-center justify-center border-2 border-current/20 bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-colors"
                  style={{ color: textColor }}
                  aria-label="Back"
                >
                  <ArrowLeft className="w-5 h-5" style={{ color: textColor }} />
                </button>
                <span
                  className="text-2xl sm:text-3xl font-bold uppercase tracking-tight"
                  style={{ color: textColor }}
                >
                  {title}
                </span>
              </div>

              {/* Content */}
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
