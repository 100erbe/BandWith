import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from '@/app/components/icons';
import { APP_COPY } from '@/app/constants/copy';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = APP_COPY.events.emptyState.title,
  description = APP_COPY.events.emptyState.description,
  icon,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="flex flex-col items-center justify-center py-16 px-6 text-center"
  >
    <div className="w-16 h-16 rounded-2xl bg-foreground/5 border border-foreground/10 flex items-center justify-center mb-4 text-foreground/40">
      {icon || <Sparkles className="w-8 h-8" />}
    </div>
    <h4 className="text-base font-bold text-foreground uppercase tracking-wider mb-1">
      {title}
    </h4>
    <p className="text-xs text-foreground/50 max-w-xs leading-relaxed">
      {description}
    </p>
  </motion.div>
);
