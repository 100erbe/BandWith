import React from 'react';
import { motion } from 'motion/react';
import { cn } from '@/app/components/ui/utils';
import { LucideIcon } from 'lucide-react';

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
        isActive ? "text-[#E6E5E1]" : "text-stone-500 hover:text-stone-300"
      )}
    >
      <Icon className={cn("w-6 h-6 transition-all", isActive && "stroke-[2.5]")} />
      {isActive && (
        <motion.div 
          layoutId="nav-dot"
          className="w-1 h-1 bg-[#D4FB46] rounded-full"
        />
      )}
    </button>
  );
};
