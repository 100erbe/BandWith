import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';

const refreshProfile = vi.fn().mockResolvedValue(undefined);
vi.mock('../AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'leo@example.com' }, refreshProfile }),
}));

// Every query resolves to `result` (profile updates, sub_tier read, progress…).
let result: { data: unknown; error: unknown } = { data: { sub_tier: 'single_band' }, error: null };
const updates: unknown[] = [];
const chain: Record<string, unknown> = {};
for (const m of ['select', 'eq', 'single', 'insert', 'upsert']) chain[m] = () => chain;
chain.update = (v: unknown) => {
  updates.push(v);
  return chain;
};
chain.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(result).then(ok, ko);
vi.mock('../supabase', () => ({
  supabase: { from: () => chain, storage: { from: () => ({}) } },
  getOnboardingProgress: vi.fn(),
  updateOnboardingProgress: vi.fn().mockResolvedValue({ data: null, error: null }),
  createOnboardingProgress: vi.fn(),
}));

const createBand = vi.fn();
vi.mock('../services/bands', () => ({ createBand: (...a: unknown[]) => createBand(...a) }));
vi.mock('../onboardingBandLogo', () => ({ storeOnboardingBandLogo: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../services/invitations', () => ({
  acceptInvitation: vi.fn(),
  InviteError: class extends Error {},
  inviteErrorMessage: () => '',
  inviteToBand: vi.fn().mockResolvedValue(undefined),
  parseInviteCode: vi.fn(),
  previewInvitation: vi.fn(),
}));

import { OnboardingProvider, useOnboarding } from '../OnboardingContext';

const wrapper = ({ children }: { children: React.ReactNode }) => <OnboardingProvider>{children}</OnboardingProvider>;

const setUpCreator = async () => {
  const hook = renderHook(() => useOnboarding(), { wrapper });
  await act(async () => {
    hook.result.current.startOnboarding('creator');
    hook.result.current.setBandData({ name: 'The Lines' });
    hook.result.current.setProfileData({ fullName: 'Leo M.', instruments: ['guitar'] });
  });
  return hook;
};

describe('finishing the onboarding', () => {
  beforeEach(() => {
    refreshProfile.mockClear();
    createBand.mockReset();
    updates.length = 0;
    result = { data: { sub_tier: 'single_band' }, error: null };
  });

  it('fails loudly when the band is not created (no fake "My Band")', async () => {
    createBand.mockResolvedValue({ data: null, error: new Error('offline') });
    const hook = await setUpCreator();
    await expect(hook.result.current.completeOnboarding()).rejects.toThrow('offline');
    expect(hook.result.current.isComplete).toBe(false);
  });

  it('fails when the profile cannot be saved, before creating anything', async () => {
    result = { data: null, error: { message: 'permission denied' } };
    const hook = await setUpCreator();
    await expect(hook.result.current.completeOnboarding()).rejects.toBeTruthy();
    expect(createBand).not.toHaveBeenCalled();
  });

  it('creates the band and reads the profile again (band mode, not solo)', async () => {
    createBand.mockResolvedValue({ data: { id: 'b1', name: 'The Lines' }, error: null });
    const hook = await setUpCreator();
    await act(async () => {
      await hook.result.current.completeOnboarding();
    });
    expect(createBand).toHaveBeenCalledWith({ name: 'The Lines', logo_url: undefined });
    expect(refreshProfile).toHaveBeenCalled();
    expect(hook.result.current.isComplete).toBe(true);
  });

  it('solo: saves solo mode and reads the profile again', async () => {
    const hook = renderHook(() => useOnboarding(), { wrapper });
    await act(async () => {
      hook.result.current.startOnboarding('solo');
      hook.result.current.setProfileData({ fullName: 'Leo M.', instruments: [] });
    });
    await act(async () => {
      await hook.result.current.completeOnboarding();
    });
    expect(updates[0]).toMatchObject({ user_mode: 'solo' });
    expect(createBand).not.toHaveBeenCalled();
    expect(refreshProfile).toHaveBeenCalled();
  });
});
