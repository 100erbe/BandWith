import React from 'react';
import { Pencil } from '@/app/components/icons';
import { DotText } from '@/app/components/bw';
import { IconButton } from '@/app/components/bw/Screen';
import { PaidBadge, memberRoleLabel, type ResolvedMember } from './parts';
import { useT } from '@/lib/i18n';

/** Fee & payouts sheet body (Figma 23:1104). */
export const FeePayoutsContent: React.FC<{
  isAdmin: boolean;
  feeLabel: string;
  feeValue: string;
  /** Members who are paid out (declined members excluded). */
  members: ResolvedMember[];
  bandFund: number;
  bandFundPct: number | null;
  /** event_members.paid_at is available (057). */
  paidSupported: boolean;
  formatMoney: (n: number) => string;
  onEditFee?: () => void;
  error?: string | null;
}> = ({ isAdmin, feeLabel, feeValue, members, bandFund, bandFundPct, paidSupported, formatMoney, onEditFee, error }) => {
  const t = useT();
  return (
    <>
      <div className="flex items-end justify-between gap-3 pb-2">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="bw-label-sm">{feeLabel}</span>
          <DotText text={feeValue} size={32} label={feeValue} />
        </div>
        {isAdmin && onEditFee && (
          <IconButton label={t('Edit fee')} variant="sheet" size="sm" icon={<Pencil />} onClick={onEditFee} />
        )}
      </div>

      {isAdmin && members.length > 0 && (
        <div className="flex flex-col gap-2">
          {members.map((m, idx) => (
            <div
              key={m.userId || idx}
              className="flex items-center justify-between gap-3 rounded-full bg-foreground/[0.08] pl-2 pr-3 py-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center bw-label-sm shrink-0">
                  {m.initials}
                </span>
                <span className="bw-label-sm truncate">
                  {m.name} · {memberRoleLabel(m.role, t)}
                </span>
              </div>
              <span className="flex items-center gap-2 shrink-0">
                <span className="bw-label-md">{formatMoney(m.fee)}</span>
                {paidSupported && <PaidBadge paid={!!m.paidAt} />}
              </span>
            </div>
          ))}
          {bandFund > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-full border-[1.5px] border-foreground/30 pl-4 pr-4 py-2 min-h-12">
              <span className="bw-label-sm">{bandFundPct != null ? t('Band fund ({pct}%)', { pct: bandFundPct }) : t('Band fund')}</span>
              <span className="bw-label-md shrink-0">{formatMoney(bandFund)}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="bw-body-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
};
