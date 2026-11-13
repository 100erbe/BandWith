/**
 * Client quote link (migration 099): what the client's page and message get.
 * The snapshot is the only thing the page shows, so it must never carry
 * musician fees, payouts or internal notes.
 */
import { describe, it, expect, vi } from 'vitest';

const mockRpc = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { rpc: (fn: string, args: unknown) => mockRpc(fn, args), from: vi.fn() },
}));

import { buildClientQuoteSnapshot, clientLinkMessage, publishQuoteLink, quoteLinkUrl } from '../quoteLinks';
import type { Quote } from '@/app/data/quotes';

const quote: Partial<Quote> = {
  id: '22222222-2222-4222-8222-222222222222',
  quoteNumber: 'Q-2026-0013',
  clientName: 'Anna Conti',
  clientEmail: 'anna@example.com',
  eventName: 'Year-end gala',
  eventType: 'corporate',
  eventDate: '2027-01-04',
  eventTimeStart: '20:30',
  venueName: 'Palazzo Clerici',
  venueCity: 'Milano',
  guestCount: 300,
  currency: 'EUR',
  baseFee: 3800,
  subtotal: 3800,
  total: 3800,
  musicians: [
    { id: 'm1', name: 'Leo M.', instrument: 'Drums', fee: 412, isExternal: false, isAvailable: true },
    { id: 'm2', name: 'Sam R.', instrument: 'Bass', fee: 377, isExternal: true, isAvailable: true },
  ],
  internalNotes: 'Pay Sam in cash',
  clientNotes: 'Dress code black.',
  validUntil: '2026-12-31',
};

describe('client quote snapshot', () => {
  it('has no musician fees, names or internal notes', () => {
    const snap = buildClientQuoteSnapshot(quote, 'en');
    const text = JSON.stringify(snap);
    expect(text).not.toContain('412');
    expect(text).not.toContain('377');
    expect(text).not.toContain('Leo M.');
    expect(text).not.toContain('Sam R.');
    expect(text).not.toContain('Pay Sam');
    expect(snap.notes).toBe('Dress code black.');
    expect(snap.ref).toBe('Q-2026-0013');
    expect(snap.lineup).toBe('2 musicians');
  });

  it('is written in the client language', () => {
    const snap = buildClientQuoteSnapshot(quote, 'it');
    expect(snap.items[0].label).not.toBe('MAIN BAND');
    expect(snap.lineup).not.toBe('2 musicians');
  });
});

describe('client message', () => {
  it('carries the page link and the total', () => {
    const url = quoteLinkUrl('a'.repeat(64));
    const msg = clientLinkMessage(quote, { bandName: 'The Night Shift', url, lang: 'en', kind: 'sent', total: '€3,800.00' });
    expect(msg).toContain(url);
    expect(msg).toContain('€3,800.00');
    expect(msg).toContain('Hi Anna,');
    expect(url).toMatch(/\/quote\.html\?t=a{64}$/);
  });

  it('says reminder and update differently', () => {
    const url = quoteLinkUrl('b'.repeat(64));
    const reminder = clientLinkMessage(quote, { bandName: 'X', url, lang: 'en', kind: 'reminder', total: '1' });
    const updated = clientLinkMessage(quote, { bandName: 'X', url, lang: 'en', kind: 'updated', total: '1' });
    expect(reminder).toContain('Just a reminder');
    expect(updated).toContain('updated your quote');
  });
});

describe('publishing', () => {
  it('sends the snapshot through the admin RPC', async () => {
    mockRpc.mockResolvedValueOnce({ data: [{ token: 't', status: 'draft', version: 1, revoked: false }], error: null });
    const snap = buildClientQuoteSnapshot(quote, 'en');
    const res = await publishQuoteLink(String(quote.id), snap, 'en', null);
    expect(mockRpc).toHaveBeenCalledWith('bw_quote_link_publish', expect.objectContaining({ p_quote_id: quote.id, p_lang: 'en' }));
    expect(res.data?.version).toBe(1);
  });
});
