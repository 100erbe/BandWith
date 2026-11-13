import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const from = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), from: (t: string) => from(t) } }));

import { BAND_MEMBER_COLUMNS, getBandMemberFees, withMemberFees } from '../bandMemberFees';

beforeEach(() => {
  rpc.mockReset();
  from.mockReset();
});

const roster = [
  { id: 'm1', band_id: 'b1', user_id: 'me', role: 'member' },
  { id: 'm2', band_id: 'b1', user_id: 'colleague', role: 'member', default_fee: 250, fee_percentage: 10 },
];

describe('band member fees (076)', () => {
  it('never reads the fee columns from band_members', () => {
    expect(BAND_MEMBER_COLUMNS).not.toMatch(/fee/);
    expect(BAND_MEMBER_COLUMNS).toMatch(/\buser_id\b/);
  });

  it("a member keeps only their own fee, a colleague's is dropped", () => {
    const merged = withMemberFees(roster, [{ band_id: 'b1', user_id: 'me', default_fee: 300, fee_percentage: null }]);
    expect(merged[0].default_fee).toBe(300);
    expect('fee_percentage' in merged[0]).toBe(false);
    expect('default_fee' in merged[1]).toBe(false);
    expect('fee_percentage' in merged[1]).toBe(false);
  });

  it('an admin gets every fee', () => {
    const merged = withMemberFees(roster, [
      { band_id: 'b1', user_id: 'me', default_fee: 300, fee_percentage: null },
      { band_id: 'b1', user_id: 'colleague', default_fee: 250, fee_percentage: 10 },
    ]);
    expect(merged.map((m) => m.default_fee)).toEqual([300, 250]);
    expect(merged[1].fee_percentage).toBe(10);
  });

  it('asks the RPC once per distinct band', async () => {
    rpc.mockResolvedValue({ data: [{ band_id: 'b1', user_id: 'me', default_fee: '300', fee_percentage: null }], error: null });
    const { data, error } = await getBandMemberFees(['b1', 'b1', '']);
    expect(error).toBeNull();
    expect(rpc).toHaveBeenCalledWith('bw_band_member_fees', { p_band_ids: ['b1'] });
    expect(data).toEqual([{ band_id: 'b1', user_id: 'me', default_fee: 300, fee_percentage: null }]);
    expect(from).not.toHaveBeenCalled();
  });

  it('falls back to the columns while the database is before 076', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    const inFn = vi.fn().mockResolvedValue({ data: [{ band_id: 'b1', user_id: 'me', default_fee: 300, fee_percentage: null }], error: null });
    from.mockReturnValue({ select: vi.fn().mockReturnValue({ in: inFn }) });
    const { data } = await getBandMemberFees(['b1']);
    expect(from).toHaveBeenCalledWith('band_members');
    expect(data[0].default_fee).toBe(300);
  });

  it('other RPC errors return no fees instead of reading the table', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    const { data, error } = await getBandMemberFees(['b1']);
    expect(error).toBeTruthy();
    expect(data).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
});
