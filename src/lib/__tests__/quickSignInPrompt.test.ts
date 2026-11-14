import { describe, it, expect, beforeEach } from 'vitest';
import { quickSignInDeclined, rememberQuickSignInDeclined } from '../quickSignInPrompt';

describe('quick sign-in prompt', () => {
  beforeEach(() => localStorage.clear());

  it('is not asked again for an account that said "Not now", for 30 days', () => {
    const now = Date.UTC(2026, 10, 13);
    expect(quickSignInDeclined('leo@example.com', now)).toBe(false);
    rememberQuickSignInDeclined(' Leo@Example.com ', now);
    expect(quickSignInDeclined('leo@example.com', now + 1000)).toBe(true);
    expect(quickSignInDeclined('other@example.com', now)).toBe(false);
    expect(quickSignInDeclined('leo@example.com', now + 31 * 24 * 3600 * 1000)).toBe(false);
  });

  it('survives broken storage', () => {
    localStorage.setItem('bw_quick_signin_declined', '{nope');
    expect(quickSignInDeclined('leo@example.com')).toBe(false);
    rememberQuickSignInDeclined('leo@example.com');
    expect(quickSignInDeclined('leo@example.com')).toBe(true);
  });
});
