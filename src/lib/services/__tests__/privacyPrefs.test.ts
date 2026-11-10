/**
 * Privacy prefs: profiles.privacy jsonb, with a graceful "unavailable"
 * state while migration 056 isn't applied.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();
const selectResults: Array<{ data: unknown; error: unknown }> = [];
const updateMock = vi.fn();

vi.mock('@/lib/supabase', () => {
  const from = () => ({
    select: () => {
      const chain: any = {
        eq: () => chain,
        maybeSingle: () => Promise.resolve(selectResults.shift() ?? { data: null, error: null }),
      };
      return chain;
    },
    update: (values: unknown) => ({
      eq: () => Promise.resolve(updateMock(values) ?? { error: null }),
    }),
  });
  return {
    supabase: { from },
    getSafeUser: () => mockGetUser(),
  };
});

import {
  loadPrivacyPrefs,
  savePrivacyPref,
  parsePrivacyPrefs,
  isMissingPrivacyColumn,
  PRIVACY_UNAVAILABLE_MESSAGE,
} from '../privacyPrefs';

beforeEach(() => {
  selectResults.length = 0;
  updateMock.mockReset();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
});

describe('parsePrivacyPrefs', () => {
  it('defaults to showing details', () => {
    expect(parsePrivacyPrefs(null)).toEqual({ hidePersonalGigDetails: false });
    expect(parsePrivacyPrefs({ hidePersonalGigDetails: 'yes' })).toEqual({ hidePersonalGigDetails: false });
  });
  it('reads the stored flag', () => {
    expect(parsePrivacyPrefs({ hidePersonalGigDetails: true })).toEqual({ hidePersonalGigDetails: true });
  });
});

describe('isMissingPrivacyColumn', () => {
  it('detects Postgres and PostgREST missing-column errors', () => {
    expect(isMissingPrivacyColumn({ code: '42703', message: 'column profiles.privacy does not exist' })).toBe(true);
    expect(isMissingPrivacyColumn({ code: 'PGRST204', message: "Could not find the 'privacy' column" })).toBe(true);
    expect(isMissingPrivacyColumn({ code: '42501', message: 'permission denied' })).toBe(false);
    expect(isMissingPrivacyColumn(null)).toBe(false);
  });
});

describe('loadPrivacyPrefs', () => {
  it('returns the stored prefs', async () => {
    selectResults.push({ data: { privacy: { hidePersonalGigDetails: true } }, error: null });
    await expect(loadPrivacyPrefs()).resolves.toEqual({ status: 'ready', prefs: { hidePersonalGigDetails: true } });
  });

  it('reports unavailable when the column is missing', async () => {
    selectResults.push({ data: null, error: { code: '42703', message: 'column profiles.privacy does not exist' } });
    await expect(loadPrivacyPrefs()).resolves.toEqual({ status: 'unavailable' });
  });

  it('surfaces other errors', async () => {
    selectResults.push({ data: null, error: { code: '500', message: 'boom' } });
    const res = await loadPrivacyPrefs();
    expect(res.status).toBe('error');
    if (res.status === 'error') expect(res.error.message).toBe('boom');
  });
});

describe('savePrivacyPref', () => {
  it('merges into the existing jsonb', async () => {
    selectResults.push({ data: { privacy: { other: 1 } }, error: null });
    const res = await savePrivacyPref('hidePersonalGigDetails', true);
    expect(res.error).toBeNull();
    expect(updateMock).toHaveBeenCalledWith({ privacy: { other: 1, hidePersonalGigDetails: true } });
  });

  it('flags unavailable when the column is missing on write', async () => {
    selectResults.push({ data: { privacy: null }, error: null });
    updateMock.mockReturnValueOnce({ error: { code: 'PGRST204', message: "Could not find the 'privacy' column" } });
    const res = await savePrivacyPref('hidePersonalGigDetails', true);
    expect(res.unavailable).toBe(true);
    expect(res.error?.message).toBe(PRIVACY_UNAVAILABLE_MESSAGE);
  });

  it('surfaces update errors', async () => {
    selectResults.push({ data: { privacy: {} }, error: null });
    updateMock.mockReturnValueOnce({ error: { code: '42501', message: 'permission denied' } });
    const res = await savePrivacyPref('hidePersonalGigDetails', false);
    expect(res.error?.message).toBe('permission denied');
    expect(res.unavailable).toBeUndefined();
  });

  it('fails when signed out', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await savePrivacyPref('hidePersonalGigDetails', true);
    expect(res.error?.message).toBe('Not signed in');
    expect(updateMock).not.toHaveBeenCalled();
  });
});
