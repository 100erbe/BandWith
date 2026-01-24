import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  icon?: React.ElementType;
}

export const RehearsalModalWrapper: React.FC<Props> = ({ isOpen, onClose, title, children, icon: Icon }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <motion.div 
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="fixed inset-x-4 top-[10%] bottom-[10%] md:inset-x-auto md:w-[600px] md:left-1/2 md:-translate-x-1/2 bg-[#E6E5E1] rounded-3xl z-[101] shadow-2xl flex flex-col overflow-hidden border border-white/20"
          >
             <div className="flex items-center justify-between p-6 border-b border-black/5">
                <div className="flex items-center gap-3">
                   {Icon && <Icon className="w-6 h-6 text-black" />}
                   <h2 className="text-xl font-black uppercase text-black">{title}</h2>
                </div>
                <button 
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition-colors"
                >
                   <X className="w-4 h-4 text-black" />
                </button>
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {children}
             </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
