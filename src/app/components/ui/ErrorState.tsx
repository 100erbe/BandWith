import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle } from '@/app/components/icons';
import { PillButton } from '@/app/components/bw/Form';
import { cn } from '@/app/components/ui/utils';

export interface ErrorStateProps {
  /** Default: "Couldn't load this". */
  title?: string;
  /** Short explanation; pass the Supabase error message when it is user-readable. */
  body?: string;
  /** Primary "Try again". Hidden when omitted. */
  onRetry?: () => void;
  /** Secondary "Go back". Hidden when omitted. */
  onBack?: () => void;
  retryLabel?: string;
  backLabel?: string;
  /** Shows a spinner on "Try again" while the retry is in flight. */
  retrying?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * Figma "State / Error": icon tile, title, body, primary "Try again" and
 * secondary "Go back". Centred in whatever container it is placed in.
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "Couldn't load this",
  body = 'Check your connection and try again.',
  onRetry,
  onBack,
  retryLabel = 'Try again',
  backLabel = 'Go back',
  retrying = false,
  icon,
  className,
}) => (
  <motion.div
    role="alert"
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25 }}
    className={cn('flex flex-col items-center justify-center text-center gap-6 px-6 py-12 w-full', className)}
  >
    <div className="flex flex-col items-center gap-4">
      <span
        className="w-16 h-16 rounded-[20px] bg-card text-destructive flex items-center justify-center"
        aria-hidden="true"
      >
        {icon || <AlertTriangle className="w-7 h-7" />}
      </span>
      <div className="flex flex-col items-center gap-2">
        <h2 className="bw-h2 text-foreground">{title}</h2>
        {body && <p className="bw-body-md text-muted-foreground max-w-[300px] [overflow-wrap:anywhere]">{body}</p>}
      </div>
    </div>
    {(onRetry || onBack) && (
      <div className="flex flex-col gap-2 w-full max-w-[320px]">
        {onRetry && (
          <PillButton variant="dark" onClick={onRetry} loading={retrying}>
            {retryLabel}
          </PillButton>
        )}
        {onBack && (
          <PillButton variant="outline" onClick={onBack}>
            {backLabel}
          </PillButton>
        )}
      </div>
    )}
  </motion.div>
);

export default ErrorState;
