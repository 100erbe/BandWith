import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { setStatusBarTone, toneForBackground } from '@/lib/systemBars';
import { BackButton } from '@/app/components/bw/Form';
import { cn } from '@/app/components/ui/utils';
import { RailHeaderActions } from '@/lib/railActions';

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
  // The coloured background runs under the transparent status bar: match the
  // system icons to it while the card is open.
  useEffect(() => setStatusBarTone(toneForBackground(backgroundColor)), [backgroundColor]);

  // Slower, smoother animation curves
  const expandTransition: any = {
    type: "tween",
    duration: 0.8,
    ease: [0.32, 0.72, 0, 1],
  };

  const collapseTransition: any = {
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
          paddingTop: 'var(--safe-top)',
          paddingBottom: 'var(--safe-bottom)',
          paddingLeft: 'var(--safe-left)',
          paddingRight: 'var(--safe-right)',
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



/**
 * Figma "Top Bar" for the expanded metric screens (same as Events / Past
 * archive): back button + H2 title on one 56pt row, optional trailing
 * count/meta and actions. Sticky; it cancels the wrapper's safe-top padding
 * so the canvas runs under the status bar.
 */
export const ExpandedTopBar: React.FC<{
  title: React.ReactNode;
  onBack: () => void;
  backLabel?: string;
  /** Small trailing text/Tag next to the title (count, trend…). */
  meta?: React.ReactNode;
  /** Right-hand IconButtons. */
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, onBack, backLabel = 'Back', meta, actions, className }) => (
  <header
    className={cn('sticky z-30 bg-background text-foreground px-4', className)}
    // Sticky offsets are measured inside the scroller's padding, so pin at -safe-top
    // (where the bar's flow position is) or it would slide down over the content.
    style={{ top: 'calc(-1 * var(--safe-top))', marginTop: 'calc(-1 * var(--safe-top))', paddingTop: 'var(--safe-top)' }}
  >
    <div className="h-14 flex items-center gap-3">
      <BackButton onClick={onBack} label={backLabel} />
      <h1 className="bw-h2 flex-1 min-w-0 truncate">{title}</h1>
      {/* iPhone Duo: their IconButtons move into the side rail. */}
      <RailHeaderActions>
        {meta != null && <span className="shrink-0 flex items-center">{meta}</span>}
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </RailHeaderActions>
    </div>
  </header>
);
