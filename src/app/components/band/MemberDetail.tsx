import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Copy, Check, Crown, Mail, MessageCircle, Mic, Phone, Trash2, UserCog } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { DotText, PillButton, Tag } from '@/app/components/bw';
import { ScreenHeader } from '@/app/components/bw/Screen';
import { LineupStatusTag } from '@/app/components/event/LineupSoFar';
import { supabase } from '@/lib/supabase';
import { getMemberStats } from '@/lib/services/memberStats';
import { stillOwed, type MemberStats } from '@/lib/memberStats';
import { memberNext, type MemberNextItem } from '@/lib/memberNext';
import { money, moneyShort } from '@/lib/currency';
import { toLocalDateString } from '@/lib/dates';
import { personFirstName, personName } from '@/lib/personName';
import { useT, intlLocale } from '@/lib/i18n';
import type { BandMember } from '@/lib/services/bands';

/** Gigs drawn in the "Gigs this year" meter (Figma: 2 rows of 12). */
const METER = 24;

/**
 * Member detail (Figma "Phone · Next / Band / Member detail – stats",
 * "Duo · Next / Members", "iPad · 08 / Band / Members & deputies"): who they
 * are, this year's gigs and what they were paid, their next events, contacts.
 *
 * Privacy: the stats come from bw_member_stats (083), which gives admins every
 * member and a member only their own row. The screen asks only when the viewer
 * is an admin or is looking at themselves, so a member never sees another
 * member's money. A `bw-pane-detail`: full screen on a phone and the closed
 * Duo, the trailing page on the open Duo, the detail column on a tablet.
 */
export const MemberDetail: React.FC<{
  member: BandMember;
  bandId: string;
  viewerId?: string;
  viewerIsAdmin: boolean;
  isPro: boolean;
  initials: string;
  onClose: () => void;
  onMessage?: () => void;
  onToggleRole?: () => void;
  onRemove?: () => void;
  canBeAdmin: boolean;
}> = ({ member, bandId, viewerId, viewerIsAdmin, isPro, initials, onClose, onMessage, onToggleRole, onRemove, canBeAdmin }) => {
  const t = useT();
  const isSelf = !!viewerId && member.user_id === viewerId;
  const canSeeMoney = viewerIsAdmin || isSelf;
  const year = new Date().getFullYear();
  const name = member.stage_name || personName(member.profile, t('Unknown'));
  const firstName = member.stage_name || personFirstName(member.profile, t('Member'));
  const roleLabel = member.role === 'admin' ? t('Admin') : t('Member');
  const email = member.profile?.email || null;
  const phone = ((member.profile as { phone?: string | null } | null)?.phone || '').trim() || null;

  const [stats, setStats] = useState<MemberStats | null | undefined>(undefined);
  const [next, setNext] = useState<MemberNextItem[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStats(undefined);
    if (!canSeeMoney) return;
    const today = toLocalDateString(new Date());
    getMemberStats(bandId, `${year}-01-01`, `${year}-12-31`, today).then(({ data, error }) => {
      if (cancelled) return;
      setStats(error ? null : data.find((s) => s.user_id === member.user_id) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [bandId, member.user_id, canSeeMoney, year]);

  useEffect(() => {
    let cancelled = false;
    setNext(null);
    (async () => {
      const today = toLocalDateString(new Date());
      const { data: rows, error } = await supabase
        .from('event_members')
        .select('event_id, status, role')
        .eq('user_id', member.user_id);
      if (cancelled || error) return;
      const ids = (rows || []).map((r: { event_id: string }) => r.event_id);
      if (ids.length === 0) {
        setNext([]);
        return;
      }
      const { data: events } = await supabase
        .from('events')
        .select('id, band_id, title, event_type, status, event_date, start_time')
        .in('id', ids)
        .eq('band_id', bandId)
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(20);
      if (cancelled) return;
      setNext(memberNext(rows || [], events || [], { bandId, today }));
    })();
    return () => {
      cancelled = true;
    };
  }, [bandId, member.user_id]);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied((c) => (c === value ? null : c)), 2000);
    } catch {
      /* clipboard blocked: nothing to undo */
    }
  };

  const gigs = stats ? stats.gigs_played + stats.gigs_upcoming : 0;
  const paid = stats?.paid ?? 0;
  const owed = stats ? stillOwed(stats) : 0;
  const dayLabel = (day: string) =>
    new Date(`${day}T12:00:00`).toLocaleDateString(intlLocale('en-GB'), { weekday: 'short', day: 'numeric', month: 'short' });
  const kindVar = (type: string, status: string) =>
    type === 'rehearsal' ? 'rehearsal' : type === 'personal' ? 'personal' : status === 'tentative' || status === 'pending' || status === 'quote' ? 'quote' : 'gig';

  return createPortal(
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'tween', duration: 0.3, ease: 'easeOut' }}
      className="bw-pane-detail bw-member-detail fixed inset-0 z-[72] bg-background text-foreground flex flex-col overflow-y-auto overflow-x-hidden"
      style={{ overscrollBehaviorX: 'none', touchAction: 'pan-y' }}
      role="dialog"
      aria-label={name}
    >
      <ScreenHeader pane onBack={onClose} overline={t('Member')} title={null} />

      <div className="flex flex-col gap-6 px-4 pt-2 w-full max-w-2xl mx-auto" style={{ paddingBottom: 'calc(var(--safe-bottom) + 32px)' }}>
        {/* Who */}
        <div className="flex items-center gap-4 min-w-0">
          <span className="w-[76px] h-[76px] rounded-full bg-white text-black flex items-center justify-center overflow-hidden shrink-0 bw-h2" aria-hidden>
            {member.profile?.avatar_url ? <img src={member.profile.avatar_url} alt="" className="w-full h-full object-cover" /> : initials}
          </span>
          <div className="flex flex-col gap-1 min-w-0">
            <h1 className="bw-display-lg uppercase [overflow-wrap:anywhere]">{name}</h1>
            <span className="flex items-center gap-2 min-w-0 bw-body-md text-muted-foreground">
              {member.instrument && <Mic className="w-4 h-4 shrink-0" aria-hidden />}
              <span className="truncate">{[member.instrument, roleLabel].filter(Boolean).join(' · ')}</span>
              {isPro && <Tag variant="solid">Pro</Tag>}
            </span>
          </div>
        </div>

        {/* This year: admins for everyone, a member only for themselves */}
        {canSeeMoney && stats !== undefined && (
          stats === null ? (
            <p className="bw-body-sm text-muted-foreground">{t('Stats are not available right now.')}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <section className="flex flex-col gap-3 p-4 rounded-[24px] bg-accent text-accent-foreground min-w-0" aria-label={t('Gigs this year: {count}', { count: gigs })}>
                <span className="bw-label-sm uppercase">{t('Gigs this year')}</span>
                <DotText text={String(gigs)} size={32} label={String(gigs)} />
                <span className="grid grid-cols-12 gap-1 w-full max-w-[180px]" aria-hidden>
                  {Array.from({ length: METER }).map((_, i) => (
                    <span
                      key={i}
                      className="aspect-square rounded-full"
                      style={{
                        backgroundColor:
                          i < Math.min(stats.gigs_played, METER)
                            ? 'currentColor'
                            : i < Math.min(gigs, METER)
                              ? 'color-mix(in srgb, currentColor 35%, transparent)'
                              : 'color-mix(in srgb, currentColor 12%, transparent)',
                      }}
                    />
                  ))}
                </span>
              </section>
              <section
                className="flex flex-col gap-3 p-4 rounded-[24px] bg-surface-inverse text-surface-inverse-foreground min-w-0"
                aria-label={t('Paid {year}: {amount}, {owed} owed', { year, amount: money(paid, 'auto'), owed: money(owed, 'auto') })}
              >
                <span className="bw-label-sm uppercase">{t('Paid · {year}', { year })}</span>
                <DotText text={moneyShort(paid, 'K')} size={32} label={money(paid, 'auto')} />
                <span className="bw-label-xs text-accent">{t('{amount} · {owed} owed', { amount: money(paid, 'auto'), owed: money(owed, 'auto') })}</span>
              </section>
            </div>
          )
        )}

        {/* Next for … */}
        {next && next.length > 0 && (
          <section className="flex flex-col gap-3" aria-label={t('Next for {name}', { name: firstName })}>
            <h2 className="bw-h1 uppercase">{t('Next for {name}', { name: firstName })}</h2>
            <ul className="flex flex-col px-4 rounded-[24px] bg-card text-card-foreground divide-y divide-border">
              {next.map((e) => (
                <li key={e.eventId} className="flex items-center gap-3 py-3 min-w-0">
                  <span
                    aria-hidden
                    className="w-2 self-stretch rounded-full shrink-0"
                    style={{ backgroundColor: `var(--accent-${kindVar(e.eventType, e.eventStatus)})` }}
                  />
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="bw-label-md truncate">{e.title || t('Event')}</span>
                    <span className="bw-label-xs uppercase text-muted-foreground truncate">
                      {[dayLabel(e.day), e.start, e.part && e.part.toLowerCase() !== (member.instrument || '').toLowerCase() ? e.part : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <LineupStatusTag status={e.answer} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Contacts */}
        {(email || phone) && (
          <section className="flex flex-col gap-3" aria-label={t('Contacts')}>
            <h2 className="bw-h1 uppercase">{t('Contacts')}</h2>
            <ul className="flex flex-col px-4 rounded-[24px] bg-card text-card-foreground divide-y divide-border">
              {[email && { v: email, icon: <Mail className="w-4 h-4" />, href: `mailto:${email}` }, phone && { v: phone, icon: <Phone className="w-4 h-4" />, href: `tel:${phone}` }]
                .filter(Boolean)
                .map((c) => {
                  const item = c as { v: string; icon: React.ReactNode; href: string };
                  return (
                    <li key={item.v} className="flex items-center gap-3 py-3 min-w-0">
                      <span className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shrink-0" aria-hidden>
                        {item.icon}
                      </span>
                      <a href={item.href} className="flex-1 min-w-0 truncate bw-body-md">
                        {item.v}
                      </a>
                      <button
                        type="button"
                        onClick={() => void copy(item.v)}
                        aria-label={t('Copy {value}', { value: item.v })}
                        className="-m-2 p-2 shrink-0 text-muted-foreground"
                      >
                        {copied === item.v ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </section>
        )}

        {/* Actions */}
        {(onMessage || onToggleRole) && (
          <div className={cn('grid gap-2', onMessage && onToggleRole ? 'grid-cols-2' : 'grid-cols-1')}>
            {onMessage && (
              <PillButton variant="dark" icon={<MessageCircle className="w-[18px] h-[18px]" />} onClick={onMessage}>
                {t('Message')}
              </PillButton>
            )}
            {onToggleRole &&
              (member.role === 'admin' ? (
                <PillButton variant="outline" icon={<UserCog className="w-[18px] h-[18px]" />} onClick={onToggleRole}>
                  {t('Make member')}
                </PillButton>
              ) : (
                <PillButton variant="outline" icon={<Crown className="w-[18px] h-[18px]" />} disabled={!canBeAdmin} onClick={onToggleRole}>
                  {t('Make admin')}
                </PillButton>
              ))}
          </div>
        )}
        {onRemove && (
          <PillButton variant="danger" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={onRemove}>
            {t('Remove from band')}
          </PillButton>
        )}
      </div>
    </motion.div>,
    document.body,
  );
};
