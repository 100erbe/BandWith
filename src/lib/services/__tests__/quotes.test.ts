/**
 * Quote Service Tests
 *
 * Verifies DB-assigned quote numbers, the half-written-quote cleanup and the app -> DB mapping.
 * Run with: npm test or vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSafeUser = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

// Mock Supabase client - must be before imports
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    rpc: (fn: string, args: unknown) => mockRpc(fn, args),
  },
  getSafeUser: () => mockGetSafeUser(),
}));

// Import after mocking
import { createQuote, deleteQuote, appQuoteToDbRecord, appMusiciansToDb } from '../quotes';

const BAND_ID = '11111111-1111-4111-8111-111111111111';
const QUOTE_ID = '22222222-2222-4222-8222-222222222222';

/** quotes table mock: insert().select().single() and delete().eq() */
const quotesTable = (insertResult: unknown, deleteEq = vi.fn().mockResolvedValue({ error: null })) => {
  const insert = vi.fn().mockReturnValue({
    select: () => ({ single: () => Promise.resolve(insertResult) }),
  });
  return { insert, delete: vi.fn().mockReturnValue({ eq: deleteEq }), deleteEq };
};

describe('Quote Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSafeUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  describe('createQuote', () => {
    it('uses the band-scoped DB quote number and ignores any client number', async () => {
      mockRpc.mockResolvedValue({ data: 'BW-2026-0007', error: null });
      const table = quotesTable({ data: { id: QUOTE_ID, quote_number: 'BW-2026-0007' }, error: null });
      mockFrom.mockReturnValue(table);

      const { data, error } = await createQuote({ band_id: BAND_ID, client_name: 'A', quote_number: 'BW-2026-9999' });

      expect(error).toBeNull();
      expect(data?.quote_number).toBe('BW-2026-0007');
      expect(mockRpc).toHaveBeenCalledWith('generate_quote_number', { p_band_id: BAND_ID });
      expect(table.insert).toHaveBeenCalledWith(
        expect.objectContaining({ quote_number: 'BW-2026-0007', created_by: 'user-1', band_id: BAND_ID })
      );
    });

    it('falls back to the legacy RPC only when the new signature does not exist yet', async () => {
      mockRpc
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'not found' } })
        .mockResolvedValueOnce({ data: 'BW-2026-0003', error: null });
      mockFrom.mockReturnValue(quotesTable({ data: { id: QUOTE_ID, quote_number: 'BW-2026-0003' }, error: null }));

      const { data, error } = await createQuote({ band_id: BAND_ID, client_name: 'A' });

      expect(error).toBeNull();
      expect(data?.quote_number).toBe('BW-2026-0003');
      expect(mockRpc).toHaveBeenNthCalledWith(2, 'generate_quote_number', { band_prefix: 'BW' });
    });

    it('returns an error (no random number, no insert) when the RPC refuses', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'Only active band admins' } });
      const table = quotesTable({ data: null, error: null });
      mockFrom.mockReturnValue(table);

      const { data, error } = await createQuote({ band_id: BAND_ID, client_name: 'A' });

      expect(data).toBeNull();
      expect(error?.message).toContain('Only active band admins');
      expect(table.insert).not.toHaveBeenCalled();
    });

    it('requires a band id', async () => {
      const { error } = await createQuote({ client_name: 'A' });
      expect(error?.message).toMatch(/band/i);
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('deletes the quote and returns an error when the musicians insert fails', async () => {
      mockRpc.mockResolvedValue({ data: 'BW-2026-0001', error: null });
      const table = quotesTable({ data: { id: QUOTE_ID, quote_number: 'BW-2026-0001' }, error: null });
      const musiciansInsert = vi.fn().mockResolvedValue({ error: { message: 'rls violation' } });
      mockFrom.mockImplementation((name: string) =>
        name === 'quote_musicians' ? { insert: musiciansInsert } : table
      );

      const { data, error } = await createQuote({ band_id: BAND_ID, client_name: 'A' }, [
        { name: 'Drummer', instrument: 'Drums', fee: 100 },
      ]);

      expect(data).toBeNull();
      expect(error?.message).toContain('rls violation');
      expect(table.delete).toHaveBeenCalled();
      expect(table.deleteEq).toHaveBeenCalledWith('id', QUOTE_ID);
    });
  });

  describe('deleteQuote', () => {
    it('reports an error when RLS filtered the row (0 rows deleted)', async () => {
      mockFrom.mockReturnValue({
        delete: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }),
      });
      const { error } = await deleteQuote(QUOTE_ID);
      expect(error?.message).toMatch(/permission|not found/i);
    });

    it('succeeds when the row was deleted', async () => {
      mockFrom.mockReturnValue({
        delete: () => ({ eq: () => ({ select: () => Promise.resolve({ data: [{ id: QUOTE_ID }], error: null }) }) }),
      });
      const { error } = await deleteQuote(QUOTE_ID);
      expect(error).toBeNull();
    });
  });

  describe('appQuoteToDbRecord', () => {
    it('stores VAT as a rate and a percentage discount as a percentage (not as amounts)', () => {
      const rec = appQuoteToDbRecord(
        {
          status: 'SENT',
          clientName: 'Mario',
          subtotal: 2000,
          discountType: 'percentage',
          discountValue: 10,
          vatRate: 22,
        },
        BAND_ID
      );
      expect(rec).toMatchObject({
        band_id: BAND_ID,
        status: 'sent',
        vat_rate: 22,
        discount_type: 'percentage',
        discount_value: 10,
        subtotal: 2000,
        discount_amount: 200,
        net_amount: 1800,
        vat_amount: 396,
        total: 2196,
      });
      expect(rec.sent_at).toBeTruthy();
      expect(rec.quote_number).toBeUndefined();
    });

    it('clamps a fixed discount larger than the subtotal', () => {
      const rec = appQuoteToDbRecord(
        { clientName: 'A', subtotal: 300, discountType: 'fixed', discountValue: 500, vatRate: 22 },
        BAND_ID
      );
      expect(rec).toMatchObject({ discount_amount: 300, net_amount: 0, vat_amount: 0, total: 0 });
    });

    it('only keeps real profile ids for musicians', () => {
      const rows = appMusiciansToDb([
        { id: 'm1', userId: '33333333-3333-4333-8333-333333333333', name: 'A', instrument: 'Bass', isExternal: false, isAvailable: true },
        { id: 'm2', userId: 'ext-1', name: 'B', instrument: 'Sax', isExternal: true, isAvailable: true, fee: 120.005 },
      ]);
      expect(rows[0].user_id).toBe('33333333-3333-4333-8333-333333333333');
      expect(rows[1].user_id).toBeUndefined();
      expect(rows[1].fee).toBe(120.01);
    });
  });
});
