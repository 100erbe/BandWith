import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2 } from '@/app/components/icons';
import { PillButton } from '@/app/components/bw';
import { Card, Tag } from '@/app/components/bw/Screen';
import { getBandMembers } from '@/lib/services/bands';
import { getMemberStats } from '@/lib/services/memberStats';
import { orderMemberStats, stillOwed, type MemberStats } from '@/lib/memberStats';
import { initialsOf } from '@/app/components/event/parts';
import { personName } from '@/lib/personName';
import { supabase } from '@/lib/supabase';
import { money } from '@/lib/currency';
import { toLocalDateString } from '@/lib/dates';
import { useT } from '@/lib/i18n';

type Row = MemberStats & { name: string; instrument?: string };

const hasActivity = (s: MemberStats) =>
  s.gigs_played + s.gigs_upcoming + s.rehearsals + s.declined + s.pending > 0 || s.earned > 0;

/**
 * This year per member (bw_member_stats, migration 083): gigs played and
 * coming up, rehearsals, declines, answers pending, fees earned and still
 * unpaid. Admins see the whole band; a member sees only their own row.
 */
export const MemberStatsCard: React.FC<{ bandId: string; isAdmin: boolean; currentUserId?: string }> = ({
  bandId,
  isAdmin,
  currentUserId,
}) => {
  const t = useT();
  const year = new Date().getFullYear();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    (async () => {
      const today = toLocalDateString(new Date());
      const [{ data: stats, error: statsError }, { data: roster }] = await Promise.all([
        getMemberStats(bandId, `${year}-01-01`, `${year}-12-31`, today),
        getBandMembers(bandId),
      ]);
      if (cancelled) return;
      if (statsError) {
        // Keep what is on screen; offer a retry.
        setError(true);
        setRows((prev) => prev ?? []);
        return;
      }
      const info = new Map((roster || []).map((m) => [m.user_id, m]));
      // Former members are not on the active roster: name them from profiles.
      const missing = stats.filter((s) => !info.has(s.user_id)).map((s) => s.user_id);
      const profileNames = new Map<string, string>();
      if (missing.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', missing);
        (profiles || []).forEach((p: any) => {
          const n = personName(p, '');
          if (n) profileNames.set(p.id, n);
        });
        if (cancelled) return;
      }
      const named: Row[] = stats
        .filter((s) => s.is_active || hasActivity(s))
        .map((s) => {
          const m = info.get(s.user_id);
          const name =
            personName(m?.profile as any, '') ||
            m?.stage_name ||
            profileNames.get(s.user_id) ||
            (s.user_id === currentUserId ? t('You') : t('Unknown musician'));
          return { ...s, is_active: s.is_active && !!m, name, instrument: m?.instrument || undefined };
        });
      setRows(orderMemberStats(named, currentUserId));
    })();
    return () => {
      cancelled = true;
    };
  }, [bandId, year, currentUserId, reloadKey, t]);

  return (
    <Card className="p-5 gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="bw-label-md">{isAdmin ? t('Members') : t('Your year')}</h2>
        <span className="bw-label-sm text-muted-foreground shrink-0">{year}</span>
      </div>

      {rows === null ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {error && (
            <div role="alert" className="flex items-center justify-between gap-3">
              <p className="bw-body-sm text-muted-foreground">{t("Couldn't load member stats.")}</p>
              <PillButton variant="outline" size="sm" fullWidth={false} onClick={retry}>
                {t('Try again')}
              </PillButton>
            </div>
          )}
          {rows.length > 0 && (
            <ul className="flex flex-col gap-4">
              {rows.map((s, i) => {
                const owed = stillOwed(s);
                const facts = [
                  t('{count} played', { count: s.gigs_played }),
                  t('{count} coming up', { count: s.gigs_upcoming }),
                  s.rehearsals === 1
                    ? t('{count} rehearsal', { count: s.rehearsals })
                    : t('{count} rehearsals', { count: s.rehearsals }),
                  s.declined > 0 ? t('{count} declined', { count: s.declined }) : null,
                  s.pending > 0 ? t('{count} awaiting reply', { count: s.pending }) : null,
                ].filter(Boolean) as string[];
                return (
                  <motion.li
                    key={s.user_id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="flex items-start gap-3 min-w-0"
                  >
                    <span
                      aria-hidden
                      className="w-10 h-10 shrink-0 rounded-full bg-background border border-border flex items-center justify-center bw-label-sm"
                    >
                      {initialsOf(s.name)}
                    </span>
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-3 min-w-0">
                        <span className="flex items-baseline gap-2 min-w-0">
                          <span className="bw-label-md truncate">{s.name}</span>
                          {s.instrument && (
                            <span className="bw-body-sm text-muted-foreground truncate">{s.instrument}</span>
                          )}
                        </span>
                        {s.earned > 0 && <span className="bw-label-md shrink-0 tabular-nums">{money(s.earned)}</span>}
                      </div>
                      <p className="bw-body-sm text-muted-foreground [overflow-wrap:anywhere]">{facts.join(' · ')}</p>
                      {(owed > 0 || !s.is_active) && (
                        <div className="flex flex-wrap items-center gap-2">
                          {owed > 0 && <Tag>{t('{amount} not paid yet', { amount: money(owed) })}</Tag>}
                          {!s.is_active && <Tag>{t('Former member')}</Tag>}
                        </div>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Card>
  );
};
