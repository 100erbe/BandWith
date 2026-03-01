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
  bgColor = '#0147FF',
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
            <div className="flex flex-col gap-[40px] px-[16px] pt-[62px] pb-[40px]">
              {/* Header */}
              <div className="flex items-center gap-[20px]">
                <button
                  onClick={onClose}
                  className="w-[50px] h-[50px] rounded-full flex items-center justify-center border-2"
                  style={{
                    backgroundColor: 'rgba(216,216,216,0.2)',
                    borderColor: textColor,
                  }}
                >
                  <ArrowLeft className="w-[24px] h-[24px]" style={{ color: textColor }} />
                </button>
                <span
                  className="text-[32px] font-bold uppercase"
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
