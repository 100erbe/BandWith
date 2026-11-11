import React from 'react';
import { cn } from '@/app/components/ui/utils';
import { Tag } from '@/app/components/bw/Screen';

/* Figma kit pieces shared by the event detail screens (Figma 22:674 · 22:895 · 23:862 · 23:993 · 23:1104). */

/** Figma Button / Ghost SM: text-only action under the main CTAs. */
export const LINK_CLASS =
  'h-9 inline-flex items-center gap-2 bw-button-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50';

export const KeyValueRow: React.FC<{ label: React.ReactNode; value: React.ReactNode; muted?: boolean; strong?: boolean }> = ({
  label,
  value,
  muted,
  strong,
}) => (
  <span className="flex items-baseline justify-between gap-3 w-full min-w-0">
    <span className={cn(strong ? 'bw-label-sm' : 'bw-body-md', 'min-w-0 truncate', muted && 'text-muted-foreground')}>{label}</span>
    <span className={cn(strong ? 'bw-value-md' : 'bw-label-md', 'shrink-0 text-right')}>{value}</span>
  </span>
);

export const SectionTitle: React.FC<{ title: string; actionLabel?: string; onAction?: () => void }> = ({
  title,
  actionLabel,
  onAction,
}) => (
  <div className="flex items-center justify-between gap-3 min-h-10">
    <h2 className="bw-h1 min-w-0">{title}</h2>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        aria-label={`${actionLabel}: ${title}`}
        className="shrink-0 h-9 inline-flex items-center bw-button-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export interface ResolvedMember {
  userId?: string;
  name: string;
  initials: string;
  /** "Guitar" or "Guitar · Band leader". */
  role: string;
  fee: number;
  status: 'confirmed' | 'pending' | 'declined' | 'maybe';
  /** event_members.paid_at (057). undefined when the column is not available. */
  paidAt?: string | null;
}

export const MEMBER_STATUS: Record<ResolvedMember['status'], { label: string; color: string }> = {
  confirmed: { label: 'CONFIRMED', color: 'var(--success)' },
  pending: { label: 'PENDING', color: 'var(--warning)' },
  maybe: { label: 'MAYBE', color: 'var(--warning)' },
  declined: { label: 'DECLINED', color: 'var(--destructive-solid)' },
};

/** A quote's availability check: the answer is about the date only. */
const AVAILABILITY_LABEL: Record<ResolvedMember['status'], string> = {
  confirmed: 'FREE',
  pending: 'NO ANSWER',
  maybe: 'MAYBE',
  declined: 'NOT FREE',
};

export const MemberRow: React.FC<{ member: ResolvedMember; availability?: boolean }> = ({ member, availability }) => {
  const base = MEMBER_STATUS[member.status] || MEMBER_STATUS.pending;
  const status = availability ? { ...base, label: AVAILABILITY_LABEL[member.status] || base.label } : base;
  const declined = member.status === 'declined';
  return (
    <span className="flex items-center gap-3 flex-1 min-w-0 w-full">
      <span
        className={cn(
          'w-11 h-11 rounded-full bg-white text-black border-[1.5px] border-black/15 flex items-center justify-center bw-h3 shrink-0',
          declined && 'opacity-50',
        )}
      >
        {member.initials}
      </span>
      <span className={cn('flex flex-col gap-1 flex-1 min-w-0', declined && 'opacity-60')}>
        <span className="bw-label-md truncate">{member.name}</span>
        <span className="bw-body-sm text-muted-foreground truncate">{member.role}</span>
      </span>
      <span
        className={cn('inline-flex items-center gap-2 bw-label-sm shrink-0', declined && 'text-destructive-solid')}
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color }} />
        {status.label}
      </span>
    </span>
  );
};

/** PAID (accent) / PENDING (outline) payout badge. */
export const PaidBadge: React.FC<{ paid: boolean }> = ({ paid }) =>
  paid ? <Tag variant="accent">PAID</Tag> : <Tag variant="outline">PENDING</Tag>;

export const initialsOf = (name: string): string =>
  name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
