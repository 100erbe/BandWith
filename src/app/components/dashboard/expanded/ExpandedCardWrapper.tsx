import React from 'react';
import { motion } from 'motion/react';

interface CardOrigin {
  top: string;
  left: string;
  right: string;
  bottom: string;
}

interface ExpandedCardWrapperProps {
  children: React.ReactNode;
  backgroundColor: string;
  onClose: () => void;
  borderRadius?: string;
  origin?: CardOrigin;
}

export const ExpandedCardWrapper: React.FC<ExpandedCardWrapperProps> = ({
  children,
  backgroundColor,
  borderRadius = "2.5rem",
  origin = { top: '12%', left: '3%', right: '45%', bottom: '60%' },
}) => {
  // Slower, smoother animation curves
  const expandTransition = {
    type: "tween",
    duration: 0.8,
    ease: [0.32, 0.72, 0, 1],
  };

  const collapseTransition = {
    type: "tween",
    duration: 0.5,
    ease: [0.32, 0, 0.67, 0],
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Card Background - starts as card shape and expands to full screen */}
      <motion.div
        className="absolute"
        style={{ 
          backgroundColor,
          willChange: 'transform, border-radius, inset',
        }}
        initial={{ 
          top: origin.top,
          left: origin.left,
          right: origin.right,
          bottom: origin.bottom,
          borderRadius,
        }}
        animate={{ 
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: '0px',
        }}
        exit={{ 
          top: origin.top,
          left: origin.left,
          right: origin.right,
          bottom: origin.bottom,
          borderRadius,
          transition: collapseTransition,
        }}
        transition={expandTransition}
      />
      
      {/* Content Container - fades in as card expands */}
      <motion.div
        className="absolute inset-0 overflow-y-auto overflow-x-hidden flex flex-col"
        style={{ 
          willChange: 'opacity',
        }}
        initial={{ 
          opacity: 0,
        }}
        animate={{ 
          opacity: 1,
        }}
        exit={{ 
          opacity: 0,
          transition: { duration: 0.2 },
        }}
        transition={{ 
          duration: 0.4,
          delay: 0.25,
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
};
