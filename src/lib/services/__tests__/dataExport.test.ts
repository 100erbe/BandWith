/**
 * Data export: real rows from Supabase, errors abort, file goes to shareFile.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();
const results: Record<string, { data: unknown; error: unknown }> = {};
const calls: Record<string, Array<[string, ...unknown[]]>> = {};
const mockShareFile = vi.fn();

vi.mock('@/lib/supabase', () => {
  const from = (table: string) => {
    calls[table] = [];
    const chain: any = {
      select: (...a: unknown[]) => { calls[table].push(['select', ...a]); return chain; },
      eq: (...a: unknown[]) => { calls[table].push(['eq', ...a]); return chain; },
      is: (...a: unknown[]) => { calls[table].push(['is', ...a]); return chain; },
      order: (...a: unknown[]) => { calls[table].push(['order', ...a]); return chain; },
      maybeSingle: () => Promise.resolve(results[table]),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(results[table]).then(res, rej),
    };
    return chain;
  };
  // Fees come from bw_event_member_money (071), never from the table.
  const rpc = (fn: string) => Promise.resolve(results[`rpc:${fn}`] ?? { data: [], error: null });
  return { supabase: { from, rpc }, getSafeUser: () => mockGetUser() };
});

vi.mock('@/lib/nativeFiles', () => ({
  shareFile: (...args: unknown[]) => mockShareFile(...args),
}));

import { buildMyDataExport, exportMyData } from '../dataExport';

beforeEach(() => {
  mockShareFile.mockReset().mockResolvedValue('shared');
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'me@example.com' } }, error: null });
  results.profiles = { data: { id: 'u1', full_name: 'Me', instrument: 'Keys' }, error: null };
  results.band_members = {
    data: [{ band_id: 'b1', role: 'admin', instrument: 'keys', stage_name: null, is_active: true, joined_at: '2026-01-01', left_at: null, bands: { name: 'The Band' } }],
    error: null,
  };
  results.events = { data: [{ id: 'e1', title: 'Solo set', band_id: null, created_by: 'u1' }], error: null };
  results.event_members = { data: [{ id: 'em1', event_id: 'e1', user_id: 'u1', status: 'confirmed' }], error: null };
  results['rpc:bw_event_member_money'] = { data: [{ event_id: 'e1', user_id: 'u1', fee: 120, paid_at: null }], error: null };
});

describe('buildMyDataExport', () => {
  it('collects profile, memberships, personal gigs and own event_members rows', async () => {
    const out = await buildMyDataExport();
    expect(out.account).toEqual({ id: 'u1', email: 'me@example.com' });
    expect(out.profile).toEqual({ id: 'u1', full_name: 'Me', instrument: 'Keys' });
    expect(out.memberships).toEqual([
      { band_id: 'b1', band_name: 'The Band', role: 'admin', instrument: 'keys', stage_name: null, is_active: true, joined_at: '2026-01-01', left_at: null },
    ]);
    expect(out.personalGigs).toHaveLength(1);
    expect(out.eventMemberships).toHaveLength(1);
    expect(out.eventMemberships[0]).toMatchObject({ id: 'em1', fee: 120, paid_at: null });

    // Only the user's own rows are requested.
    expect(calls.profiles).toContainEqual(['eq', 'id', 'u1']);
    expect(calls.band_members).toContainEqual(['eq', 'user_id', 'u1']);
    expect(calls.events).toContainEqual(['is', 'band_id', null]);
    expect(calls.events).toContainEqual(['eq', 'created_by', 'u1']);
    expect(calls.event_members).toContainEqual(['eq', 'user_id', 'u1']);
  });

  it('aborts on a Supabase error instead of exporting partial data', async () => {
    results.events = { data: null, error: { message: 'permission denied for table events' } };
    await expect(buildMyDataExport()).rejects.toThrow(/personal gigs: permission denied/);
  });

  it('requires a signed-in user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(buildMyDataExport()).rejects.toThrow(/signed in/);
  });
});

describe('exportMyData', () => {
  it('shares a JSON file', async () => {
    await expect(exportMyData()).resolves.toBe('shared');
    expect(mockShareFile).toHaveBeenCalledTimes(1);
    const [blob, name, opts] = mockShareFile.mock.calls[0] as [Blob, string, { title?: string }];
    expect(blob.type).toBe('application/json');
    expect(name).toMatch(/^bandwith-export-\d{4}-\d{2}-\d{2}\.json$/);
    expect(opts.title).toBeTruthy();
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    const parsed = JSON.parse(text);
    expect(parsed.format).toBe('bandwith-user-export');
    expect(parsed.personalGigs[0].title).toBe('Solo set');
  });

  it('does not share when the export fails', async () => {
    results.profiles = { data: null, error: { message: 'boom' } };
    await expect(exportMyData()).rejects.toThrow(/profile: boom/);
    expect(mockShareFile).not.toHaveBeenCalled();
  });
});
