import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from '@/app/components/icons';
import { useT } from '@/lib/i18n';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
}) => {
  const t = useT();
  return (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className="flex flex-col items-center justify-center py-16 px-6 text-center"
  >
    <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center mb-4 text-muted-foreground">
      {icon || <Sparkles className="w-8 h-8" />}
    </div>
    <h4 className="bw-h3 text-foreground mb-1">
      {title ?? t('No items scheduled')}
    </h4>
    <p className="bw-body-sm text-muted-foreground max-w-xs">
      {description ?? t('When new items are created or confirmed, they will show up here.')}
    </p>
  </motion.div>
  );
};
