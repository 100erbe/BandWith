import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/app/components/ui/utils';
import { LucideIcon } from '@/app/components/icons';

interface NavButtonProps {
  icon: LucideIcon;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export const NavButton: React.FC<NavButtonProps> = ({ 
  icon: Icon, 
  label, 
  isActive, 
  onClick 
}) => {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 w-12 transition-all duration-300 group",
        isActive ? "text-[var(--fg)]" : "text-[var(--muted-fg)] hover:text-[var(--fg)]"
      )}
    >
      <Icon className={cn("w-6 h-6 transition-all", isActive && "stroke-[2.5]")} />
      {isActive && (
        <motion.div 
          layoutId="nav-dot"
          className="w-1 h-1 bg-accent rounded-full"
        />
      )}
    </button>
  );
};
