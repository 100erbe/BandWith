/**
 * Band Service Tests
 * 
 * These tests verify the band service functionality.
 * Run with: npm test or vitest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create mock functions
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

// Mock Supabase client - must be before imports
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => mockFrom(table),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// Import after mocking
import { getBands, createBand, getBandMembers } from '../bands';

describe('Band Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
    });
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  describe('getBands', () => {
    it('should return an empty array when user has no bands', async () => {
      // Make the mock chainable for multiple `.eq()` calls:
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const result = await getBands();
      
      expect(result.error).toBeNull();
      expect(result.data).toEqual([]);
    });

    it('should return error when not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
      });

      const result = await getBands();
      
      expect(result.error).toBeTruthy();
      expect(result.data).toBeNull();
    });
  });

  describe('createBand', () => {
    it('should create a band with required fields', async () => {
      const mockBand = {
        id: 'new-band-id',
        name: 'Test Band',
        plan: 'free',
      };

      // First call - insert band
      mockFrom.mockReturnValueOnce({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockBand, error: null }),
          }),
        }),
      });

      // Second call - insert band_member
      mockFrom.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      const result = await createBand({
        name: 'Test Band',
      });

      expect(result.error).toBeNull();
      expect(result.data?.name).toBe('Test Band');
    });

    it('inserts genre and website when given', async () => {
      mockFrom.mockReset();
      const insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'b1', name: 'Wed Band' }, error: null }),
        }),
      });
      mockFrom.mockReturnValueOnce({ insert });

      const result = await createBand({ name: 'Wed Band', genre: 'Wedding band', website: ' https://wed.band ' });

      expect(result.error).toBeNull();
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Wed Band', genre: 'Wedding band', website: 'https://wed.band', created_by: 'test-user-id' })
      );
    });

    it('stores null genre/website when omitted', async () => {
      mockFrom.mockReset();
      const insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'b2', name: 'Plain' }, error: null }),
        }),
      });
      mockFrom.mockReturnValueOnce({ insert });

      await createBand({ name: 'Plain' });

      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ genre: null, website: null }));
    });

    it('should fail without a name', async () => {
      const result = await createBand({
        name: '',
      });

      expect(result.error).toBeTruthy();
    });
  });

  describe('getBandMembers', () => {
    it('should return members for a valid band', async () => {
      const mockMembers = [
        { id: '1', band_id: 'band-id', user_id: 'user-1', role: 'admin' },
        { id: '2', band_id: 'band-id', user_id: 'user-2', role: 'member' },
      ];

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: mockMembers, error: null }),
            }),
          }),
        }),
      });

      const result = await getBandMembers('band-id');
      
      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(2);
    });

    it('reads no fee columns and takes the fees from bw_band_member_fees (076)', async () => {
      const select = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: '1', band_id: 'band-id', user_id: 'test-user-id', role: 'member' },
                { id: '2', band_id: 'band-id', user_id: 'user-2', role: 'member' },
              ],
              error: null,
            }),
          }),
        }),
      });
      mockFrom.mockReturnValue({ select });
      mockRpc.mockResolvedValue({ data: [{ band_id: 'band-id', user_id: 'test-user-id', default_fee: 300, fee_percentage: null }], error: null });

      const result = await getBandMembers('band-id');

      const cols = String(select.mock.calls[0][0]);
      expect(cols).not.toMatch(/\*|fee/);
      expect(mockRpc).toHaveBeenCalledWith('bw_band_member_fees', { p_band_ids: ['band-id'] });
      expect(result.data?.[0].default_fee).toBe(300);
      expect(result.data?.[1].default_fee).toBeUndefined();
    });
  });
});
