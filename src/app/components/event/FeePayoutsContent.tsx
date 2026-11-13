import React from 'react';
import { Check, Pencil } from '@/app/components/icons';
import { DotText } from '@/app/components/bw';
import { IconButton } from '@/app/components/bw/Screen';
import { cn } from '@/app/components/ui/utils';
import { haptic } from '@/lib/haptics';
import { PaidBadge, memberRoleLabel, type ResolvedMember } from './parts';
import { useT } from '@/lib/i18n';

/**
 * Fee & payouts sheet body (Figma 23:1104, "iPad · 03 Fee & payouts"):
 * admins see the band fee, what is still due and every musician with a
 * paid toggle; a member sees their own fee and whether it was paid.
 */
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
  /** Admins: mark one musician paid / not paid (093). */
  onSetPaid?: (userId: string, paid: boolean) => void;
  /** The musician whose toggle is being saved. */
  settingPaid?: string | null;
  /** Members: their own paid status (null: not paid yet; undefined: unknown). */
  ownPaidAt?: string | null;
  error?: string | null;
}> = ({
  isAdmin,
  feeLabel,
  feeValue,
  members,
  bandFund,
  bandFundPct,
  paidSupported,
  formatMoney,
  onEditFee,
  onSetPaid,
  settingPaid,
  ownPaidAt,
  error,
}) => {
  const t = useT();
  const paidCount = members.filter((m) => !!m.paidAt).length;
  const due = members.filter((m) => !m.paidAt);
  const dueTotal = due.reduce((sum, m) => sum + (Number(m.fee) || 0), 0);
  return (
    <>
      <div className="flex items-end justify-between gap-3 pb-2">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="bw-label-sm">{feeLabel}</span>
          <DotText text={feeValue} size={32} label={feeValue} />
        </div>
        {isAdmin && onEditFee && <IconButton label={t('Edit fee')} variant="sheet" size="sm" icon={<Pencil />} onClick={onEditFee} />}
        {!isAdmin && paidSupported && ownPaidAt !== undefined && <PaidBadge paid={!!ownPaidAt} />}
      </div>

      {isAdmin && paidSupported && members.length > 0 && dueTotal > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-[20px] bg-accent text-accent-foreground px-4 py-3">
          <span className="bw-label-sm">{t('PAYOUTS DUE · {count}', { count: due.length })}</span>
          <span className="bw-label-md tabular-nums">{formatMoney(dueTotal)}</span>
        </div>
      )}

      {isAdmin && members.length > 0 && (
        <div className="flex flex-col gap-2">
          {paidSupported && (
            <span className="bw-label-xs text-muted-foreground pt-1">
              {t('MUSICIANS · {paid} OF {total} PAID', { paid: paidCount, total: members.length })}
            </span>
          )}
          {members.map((m, idx) => {
            const paid = !!m.paidAt;
            const canToggle = paidSupported && !!onSetPaid && !!m.userId;
            return (
              <div key={m.userId || idx} className="flex items-center justify-between gap-3 rounded-full bg-foreground/[0.08] pl-2 pr-2 py-2">
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
                  {paidSupported && <PaidBadge paid={paid} />}
                  {canToggle && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={paid}
                      aria-label={t('{name} paid', { name: m.name })}
                      disabled={!!settingPaid}
                      onClick={() => {
                        haptic.tap();
                        onSetPaid!(m.userId!, !paid);
                      }}
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-60 active:scale-[var(--press-scale)]',
                        paid ? 'bg-accent text-accent-foreground' : 'border-[1.5px] border-foreground/40',
                      )}
                    >
                      {paid && <Check className="w-4 h-4" />}
                    </button>
                  )}
                </span>
              </div>
            );
          })}
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
