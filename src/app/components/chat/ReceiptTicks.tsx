import React from 'react';
import { Check, CheckCheck, Clock } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import type { ReceiptStatus } from '@/lib/services/chats';

const LABEL: Record<ReceiptStatus, string> = {
  sending: 'Sending',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
};

/**
 * WhatsApp-style message status:
 * clock = sending · ✓ = sent · ✓✓ grey = delivered · ✓✓ coloured = read.
 */
export const ReceiptTicks: React.FC<{ status: ReceiptStatus; className?: string }> = ({
  status,
  className,
}) => {
  const base = cn('shrink-0', className);
  if (status === 'sending') return <Clock aria-label={LABEL.sending} className={cn(base, 'text-muted-foreground')} />;
  if (status === 'sent') return <Check aria-label={LABEL.sent} className={cn(base, 'text-muted-foreground')} />;
  if (status === 'delivered') {
    return <CheckCheck aria-label={LABEL.delivered} className={cn(base, 'text-muted-foreground')} />;
  }
  return (
    <CheckCheck
      aria-label={LABEL.read}
      className={base}
      style={{ color: 'var(--accent-rehearsal-ink)' }}
    />
  );
};
