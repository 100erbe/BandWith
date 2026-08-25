import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft } from 'lucide-react';

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
  bgColor = 'var(--accent-rehearsal)',
  textColor = 'white',
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100]"
            style={{ backgroundColor: bgColor }}
          />
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed inset-0 z-[101] flex flex-col overflow-y-auto"
            style={{ backgroundColor: bgColor }}
          >
            <div className="flex flex-col gap-10 px-4 pt-16 pb-10">
              {/* Header */}
              <div className="flex items-center gap-5">
                <button
                  onClick={onClose}
                  className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border-2"
                  style={{
                    borderColor: textColor,
                  }}
                >
                  <ArrowLeft className="w-6 h-6" style={{ color: textColor }} />
                </button>
                <span
                  className="text-3xl font-bold uppercase"
                  style={{ color: textColor }}
                >
                  {title}
                </span>
              </div>

              {/* Content */}
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
