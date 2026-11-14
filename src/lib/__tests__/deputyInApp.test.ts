import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import {
  claimPendingDeputyToken,
  deputyTokenFromUrl,
  pendingDeputyToken,
  resetDeputyClaimForTests,
  savePendingDeputyToken,
} from '../deputyClaim';
import { notificationTarget } from '../notificationRouting';
import { listMyDeputyGigs, unlinkDeputy, type DeputyGig } from '../services/deputies';
import { deputyClaimMessage } from '@/app/components/deputy/DeputyGigsScreen';
import { sortDeputyGigs } from '@/app/components/deputy/DeputyGigsList';

const TOKEN = 'a1'.repeat(32);
const id = (s: string) => s;

const gig = (o: Partial<DeputyGig>): DeputyGig => ({
  id: 'g', token: TOKEN, status: 'pending', deputy_name: 'Leo', role: null, fee: null, currency: 'EUR', reply_note: null,
  responded_at: null, band_name: 'Gli Sprucidi', event_title: 'Club', event_type: 'gig', event_date: '2026-11-20',
  start_time: '22:00:00', end_time: null, load_in_time: null, soundcheck_time: null, venue_name: 'Club', venue_city: 'Milano',
  venue_address: null, event_cancelled: false, changes: [], before: {}, closed: false, ...o,
});

describe('deputy link → app', () => {
  beforeEach(() => {
    rpc.mockReset();
    resetDeputyClaimForTests();
    localStorage.clear();
  });

  it('reads the token from the app link (web and native deep link)', () => {
    expect(deputyTokenFromUrl(`https://bandwith-beryl.vercel.app/?deputy=${TOKEN}`)).toBe(TOKEN);
    // Links sent before the move to Vercel still work.
    expect(deputyTokenFromUrl(`https://bandwith.pages.dev/?deputy=${TOKEN}`)).toBe(TOKEN);
    expect(deputyTokenFromUrl(`bandwith://open?deputy=${TOKEN.toUpperCase()}`)).toBe(TOKEN);
    expect(deputyTokenFromUrl('https://bandwith.pages.dev/?deputy=abc')).toBeNull();
    expect(deputyTokenFromUrl('https://bandwith.pages.dev/?invite=XYZ')).toBeNull();
    expect(deputyTokenFromUrl('not a url')).toBeNull();
  });

  it('keeps the token until the server answers, then forgets it', async () => {
    savePendingDeputyToken(TOKEN);
    expect(pendingDeputyToken()).toBe(TOKEN);

    // Offline: keep it for the next try.
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'fetch failed' } });
    expect(await claimPendingDeputyToken()).toBeNull();
    expect(pendingDeputyToken()).toBe(TOKEN);

    rpc.mockResolvedValueOnce({ data: { status: 'linked', band_name: 'Gli Sprucidi', deputy_name: 'Leo M.' }, error: null });
    const r = await claimPendingDeputyToken();
    expect(rpc).toHaveBeenLastCalledWith('bw_deputy_claim', { p_token: TOKEN });
    expect(r?.status).toBe('linked');
    expect(pendingDeputyToken()).toBeNull();
    // Nothing waiting: no call.
    expect(await claimPendingDeputyToken()).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('tries again when the connection comes back after a failed claim', async () => {
    savePendingDeputyToken(TOKEN);
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });
    expect(await claimPendingDeputyToken()).toBeNull();
    expect(rpc).toHaveBeenCalledTimes(1);

    rpc.mockResolvedValueOnce({ data: { status: 'linked', band_name: 'Gli Sprucidi', deputy_name: 'Leo M.' }, error: null });
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(pendingDeputyToken()).toBeNull());
    expect(rpc).toHaveBeenCalledTimes(2);
    // Answered: no more retries.
    window.dispatchEvent(new Event('online'));
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('says what the claim did', () => {
    const t = (s: string, v?: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v?.[k] ?? '');
    expect(deputyClaimMessage({ status: 'linked', band_name: 'Gli Sprucidi' }, t)).toMatchObject({ tone: 'ok', title: "You're on Gli Sprucidi's deputy list" });
    expect(deputyClaimMessage({ status: 'taken', band_name: 'Gli Sprucidi' }, t)?.tone).toBe('warn');
    expect(deputyClaimMessage({ status: 'member', band_name: 'Gli Sprucidi' }, t)?.title).toBe("You're already in Gli Sprucidi");
    expect(deputyClaimMessage({ status: 'not_found' }, t)?.title).toBe("This link doesn't work.");
    expect(deputyClaimMessage(null, t)).toBeNull();
  });

  it('lists the deputy gigs, empty when the server has nothing', async () => {
    rpc.mockResolvedValueOnce({ data: { bands: [{ band_name: 'X', deputy_name: 'Leo' }], gigs: [gig({})] }, error: null });
    const a = await listMyDeputyGigs();
    expect(rpc).toHaveBeenLastCalledWith('bw_my_deputy_gigs');
    expect(a.data.gigs).toHaveLength(1);
    rpc.mockResolvedValueOnce({ data: null, error: null });
    expect((await listMyDeputyGigs()).data).toEqual({ bands: [], gigs: [] });
  });

  it('an admin unlinks the deputy account', async () => {
    rpc.mockResolvedValueOnce({ data: 'unlinked', error: null });
    expect((await unlinkDeputy('d1')).data).toBe('unlinked');
    expect(rpc).toHaveBeenLastCalledWith('bw_deputy_unlink', { p_deputy_id: 'd1' });
  });

  it('puts open requests first and the closed ones last, newest first', () => {
    const { open, closed } = sortDeputyGigs([
      gig({ id: id('old'), closed: true, event_date: '2026-11-01' }),
      gig({ id: id('older-cancelled'), closed: true, event_date: '2026-11-05', status: 'cancelled' }),
      gig({ id: id('next') }),
    ]);
    expect(open.map((g) => g.id)).toEqual(['next']);
    expect(closed.map((g) => g.id)).toEqual(['older-cancelled', 'old']);
  });
});

describe('deputy notifications', () => {
  it('a band asking the deputy, or a change, opens their deputy gigs', () => {
    expect(notificationTarget('deputy_request', { deputy_request_id: 'r1' })).toEqual({ screen: 'deputyGigs', requestId: 'r1' });
    expect(notificationTarget('deputy_gig_changed', { kind: 'changed' })).toEqual({ screen: 'deputyGigs' });
  });
  it('a deputy joining opens the gig they were asked for (where "Ask in the app" is)', () => {
    expect(notificationTarget('deputy_joined', { event_id: 'e1' })).toEqual({ screen: 'event', eventId: 'e1' });
    expect(notificationTarget('deputy_reply', { event_id: 'e2' })).toEqual({ screen: 'event', eventId: 'e2' });
  });
});
