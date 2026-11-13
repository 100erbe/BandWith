import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const from = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (t: string) => from(t) } }));
const setActiveCurrency = vi.fn();
vi.mock('@/lib/currency', async (orig) => ({
  ...(await orig<typeof import('@/lib/currency')>()),
  setActiveCurrency: (...a: unknown[]) => setActiveCurrency(...a),
}));

import { BAND_PRIVATE_COLUMNS, BAND_PUBLIC_COLUMNS, getBandPrivate, withBandPrivate } from '../bandPrivate';
import { getBandPricing } from '../pricing';

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
  setActiveCurrency.mockReset();
  localStorage.clear();
});

describe('band private data (077)', () => {
  it('the public column list has no banking, tax or pricing column', () => {
    const publicCols = BAND_PUBLIC_COLUMNS.split(',').map((c) => c.trim());
    for (const col of BAND_PRIVATE_COLUMNS) expect(publicCols).not.toContain(col);
    expect(publicCols).toContain('pricing_currency');
    expect(publicCols).toContain('home_base_address');
  });

  it('a member keeps only public fields, an admin gets the private ones', () => {
    const bands = [
      { id: 'mine', name: 'Admin band' },
      { id: 'theirs', name: 'Member band', bank_iban: 'IT00 LEAK' },
    ];
    const merged = withBandPrivate(bands, [{ band_id: 'mine', private: { bank_iban: 'IT60 X054', tax_vat_id: 'IT123' } }]);
    expect(merged[0]).toMatchObject({ name: 'Admin band', bank_iban: 'IT60 X054', tax_vat_id: 'IT123' });
    expect(merged[1]).toEqual({ id: 'theirs', name: 'Member band' });
  });

  it('asks the RPC once per distinct band', async () => {
    rpc.mockResolvedValue({ data: [{ band_id: 'b1', private: { bank_iban: 'IT60' } }], error: null });
    const { data } = await getBandPrivate(['b1', 'b1', '']);
    expect(rpc).toHaveBeenCalledWith('bw_band_private', { p_band_ids: ['b1'] });
    expect(data).toEqual([{ band_id: 'b1', private: { bank_iban: 'IT60' } }]);
    expect(from).not.toHaveBeenCalled();
  });

  it('falls back to the columns while the database is before 077', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    const inFn = vi.fn().mockResolvedValue({ data: [{ id: 'b1', bank_iban: 'IT60' }], error: null });
    from.mockReturnValue({ select: vi.fn().mockReturnValue({ in: inFn }) });
    const { data } = await getBandPrivate(['b1']);
    expect(from).toHaveBeenCalledWith('bands');
    expect(data).toEqual([{ band_id: 'b1', private: { bank_iban: 'IT60' } }]);
  });
});

describe('getBandPricing (077)', () => {
  it('an admin gets the pricing settings and the band currency', async () => {
    rpc.mockResolvedValue({
      data: [{ band_id: 'b1', private: { pricing_settings: { band_id: 'b1', currency: 'USD', bank_iban: 'US-ACC' } } }],
      error: null,
    });
    const settings = await getBandPricing('b1');
    expect(settings.currency).toBe('USD');
    expect(settings.bank_iban).toBe('US-ACC');
    expect(setActiveCurrency).toHaveBeenCalledWith('USD', 'b1');
    expect(from).not.toHaveBeenCalled();
  });

  it('a member gets no bank details, keeps the currency and loses any old cached copy', async () => {
    localStorage.setItem('bandwith_pricing_settings_b1', JSON.stringify({ band_id: 'b1', currency: 'USD', bank_iban: 'US-ACC' }));
    rpc.mockResolvedValue({ data: [], error: null });
    const settings = await getBandPricing('b1');
    expect(settings.bank_iban || '').toBe('');
    expect(setActiveCurrency).not.toHaveBeenCalled();
    expect(localStorage.getItem('bandwith_pricing_settings_b1')).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});
