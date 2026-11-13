import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { initialsOf, type ResolvedMember } from './parts';
import { personName } from '@/lib/personName';
import { getEventMemberMoney, markEventPaid } from '@/lib/services/eventMemberMoney';
import { PAYOUTS_CHANGED } from '@/lib/payoutsDue';
import { useT } from '@/lib/i18n';

interface BandLike {
  id?: string;
  members?: any[];
}

interface Options {
  eventId?: string;
  bandId?: string;
  createdBy?: string;
  currentUserId?: string;
  /** Skip loading (personal gigs, quotes). */
  disabled?: boolean;
  bands?: BandLike[] | null;
  selectedBand?: BandLike | null;
}

/**
 * The event's lineup from event_members, names resolved against the band
 * roster (then profiles). Declined members are kept so the lineup can show
 * them. Per-member payout status (paid_at, migration 057) degrades to
 * `paidSupported = false` when the column is missing.
 */
export function useEventMembers({
  eventId,
  bandId,
  createdBy,
  currentUserId,
  disabled,
  bands,
  selectedBand,
}: Options) {
  const t = useT();
  const [members, setMembers] = useState<ResolvedMember[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paidSupported, setPaidSupported] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [markError, setMarkError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId || disabled) {
      setMembers(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      // fee and paid_at come from bw_event_member_money (071): all rows for
      // admins, only the viewer's own row for members.
      const withPaid = true;
      const res = await supabase
        .from('event_members')
        .select('user_id, status, role')
        .eq('event_id', eventId);
      if (cancelled) return;
      if (res.error) {
        setError(res.error.message);
        setMembers(null);
        setLoading(false);
        return;
      }
      const money = await getEventMemberMoney([eventId]);
      if (cancelled) return;
      const moneyOf = new Map(money.data.map((m) => [m.user_id, m]));
      const rows = (res.data || []).map((r: any) => ({ ...r, fee: moneyOf.get(r.user_id)?.fee, paid_at: moneyOf.get(r.user_id)?.paid_at ?? null, hasMoney: moneyOf.has(r.user_id) })) as any[];

      // Names and instruments from the band roster.
      const targetBand = bands?.find((b) => b.id === bandId) || selectedBand;
      const roster = new Map<string, { name: string; instrument?: string; isAdmin: boolean; defaultFee: number }>();
      targetBand?.members?.forEach((bm: any) => {
        if (!bm.user_id) return;
        roster.set(bm.user_id, {
          name: personName(bm.profile, ''),
          instrument: bm.instrument || undefined,
          isAdmin: bm.role === 'admin',
          defaultFee: Number(bm.default_fee || 0),
        });
      });

      // Anyone not on the roster (left the band, external): look up their profile.
      const missing = rows.map((r) => r.user_id).filter((id) => id && !roster.get(id)?.name);
      const profileNames = new Map<string, string>();
      if (missing.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, email').in('id', missing);
        (profiles || []).forEach((p: any) => {
          const n = personName(p, '');
          if (n) profileNames.set(p.id, n);
        });
        if (cancelled) return;
      }

      const resolved: ResolvedMember[] = rows.map((em) => {
        const info = roster.get(em.user_id);
        const name =
          info?.name || profileNames.get(em.user_id) || (em.user_id === currentUserId ? t('You') : t('Unknown musician'));
        const rawRole = typeof em.role === 'string' ? em.role.trim() : '';
        const instrument =
          (rawRole && !['admin', 'member'].includes(rawRole.toLowerCase()) ? rawRole : '') || info?.instrument || 'Musician';
        const leader = !!info?.isAdmin || (!!createdBy && em.user_id === createdBy);
        const status = (['confirmed', 'pending', 'declined', 'maybe'].includes(em.status) ? em.status : 'pending') as ResolvedMember['status'];
        return {
          userId: em.user_id,
          name,
          initials: initialsOf(name),
          role: leader ? `${instrument} · Band leader` : instrument,
          fee: em.fee != null ? Number(em.fee) : em.hasMoney ? info?.defaultFee || 0 : 0,
          status,
          paidAt: withPaid ? em.paid_at ?? null : undefined,
        };
      });

      setPaidSupported(withPaid);
      setMembers(resolved);
      setLoading(false);
    };
    load().catch((e) => {
      if (cancelled) return;
      setError(e?.message || t('Could not load the lineup.'));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, bandId, createdBy, currentUserId, disabled, bands, selectedBand, t]);

  /** Admins: stamp paid_at on every non-declined member still unpaid. */
  const markAllPaid = useCallback(async () => {
    if (!eventId || !paidSupported || markingPaid) return;
    setMarkingPaid(true);
    setMarkError(null);
    const { data, error: upErr } = await markEventPaid(eventId);
    setMarkingPaid(false);
    if (upErr) {
      setMarkError(upErr.message);
      return;
    }
    const stamped = new Map(data.map((r) => [r.user_id, r.paid_at]));
    setMembers((prev) => prev?.map((m) => (m.userId && stamped.has(m.userId) ? { ...m, paidAt: stamped.get(m.userId) } : m)) ?? prev);
    // Home's "Payouts due" reloads.
    window.dispatchEvent(new Event(PAYOUTS_CHANGED));
  }, [eventId, paidSupported, markingPaid]);

  return { members, loading, error, paidSupported, markAllPaid, markingPaid, markError };
}
