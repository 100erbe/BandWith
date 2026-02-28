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

// Mock Supabase client - must be before imports
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => mockFrom(table),
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
  });

  describe('getBands', () => {
    it('should return an empty array when user has no bands', async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
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
        plan: 'free',
      });

      expect(result.error).toBeNull();
      expect(result.data?.name).toBe('Test Band');
    });

    it('should fail without a name', async () => {
      const result = await createBand({
        name: '',
        plan: 'free',
      });

      expect(result.error).toBeTruthy();
    });
  });

  describe('getBandMembers', () => {
    it('should return members for a valid band', async () => {
      const mockMembers = [
        { id: '1', user_id: 'user-1', role: 'admin' },
        { id: '2', user_id: 'user-2', role: 'member' },
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
  });
});
