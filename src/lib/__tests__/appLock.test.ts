import { describe, it, expect, vi, beforeEach } from 'vitest';

const native = { value: true };
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => native.value,
    getPlatform: () => (native.value ? 'ios' : 'web'),
  },
}));
vi.mock('@/lib/supabase', () => ({ isDemoMode: false }));

describe('app lock', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    native.value = true;
  });

  it('locks a cold start with a saved session on native, by default', async () => {
    const m = await import('../appLock');
    expect(m.isAppLockEnabled()).toBe(true);
    expect(m.shouldLockOnLaunch(true)).toBe(true);
  });

  it('never locks without a saved session (a fresh sign-in)', async () => {
    const m = await import('../appLock');
    expect(m.shouldLockOnLaunch(false)).toBe(false);
  });

  it('does not lock again in the same run once unlocked (back from background)', async () => {
    const m = await import('../appLock');
    m.markUnlocked();
    expect(m.shouldLockOnLaunch(true)).toBe(false);
  });

  it('can be turned off on the device', async () => {
    const m = await import('../appLock');
    m.setAppLockEnabled(false);
    expect(m.shouldLockOnLaunch(true)).toBe(false);
    m.setAppLockEnabled(true);
    expect(m.shouldLockOnLaunch(true)).toBe(true);
  });

  it('never locks on the web', async () => {
    native.value = false;
    const m = await import('../appLock');
    expect(m.appLockSupported()).toBe(false);
    expect(m.shouldLockOnLaunch(true)).toBe(false);
  });
});
