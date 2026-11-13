import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';

const bandState = vi.hoisted(() => ({ isAdmin: false }));

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/lib/haptics', () => ({
  haptic: { tap: vi.fn(), medium: vi.fn(), confirm: vi.fn(), delete: vi.fn(), selection: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/AuthContext', () => ({
  useAuth: () => ({ signOut: vi.fn(), user: { id: 'user-1' }, profile: { id: 'user-1', full_name: 'Leo M.' } }),
}));
vi.mock('@/lib/ThemeContext', () => ({
  useTheme: () => ({ mode: 'system', setMode: vi.fn(), resolvedTheme: 'light' }),
}));
vi.mock('@/lib/BandContext', () => ({
  useBand: () => ({
    isAdmin: bandState.isAdmin,
    selectedBand: { id: 'band-1', name: 'The Band', members: [], member_count: 4 },
    bands: [],
    refreshBands: vi.fn(),
  }),
}));
vi.mock('@/lib/services/notificationPrefs', () => ({
  readLocalPref: () => true,
  loadNotificationPrefs: vi.fn(async () => ({})),
  saveNotificationPrefs: vi.fn(async () => {}),
}));
vi.mock('@/lib/services/pricing', () => ({
  uploadBandBrandingAsset: vi.fn(),
  getBandPricing: vi.fn(async () => null),
  saveBandPricing: vi.fn(),
}));
vi.mock('@/app/components/ui/VenueAutocomplete', () => ({ VenueAutocomplete: () => null }));

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { IdentityHub } from '../IdentityHub';
import type { Band } from '@/app/data/bands';

afterEach(cleanup);

const renderHub = (role: 'ADMIN' | 'MEMBER') => {
  bandState.isAdmin = role === 'ADMIN';
  const band = { id: 1, name: 'The Band', role, initials: 'TB', members: 4, genre: '', plan: 'Free' } as Band;
  render(
    <IdentityHub
      isOpen
      onClose={() => {}}
      bands={[band]}
      selectedBand={band}
      setSelectedBand={() => {}}
      entityCounts={{ templates: 2, documents: 3, inventory: 5, repertoire: 40 }}
      onEntityDetailClick={() => {}}
    />,
  );
};

describe('IdentityHub band assets', () => {
  it('a member does not see contracts and documents', () => {
    renderHub('MEMBER');
    expect(screen.getByRole('button', { name: /^repertoire:/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^to-do lists:/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^contracts & docs:/i })).toBeNull();
  });

  it('an admin still opens contracts and documents', () => {
    renderHub('ADMIN');
    expect(screen.getByRole('button', { name: /^contracts & docs: 3 files/i })).toBeTruthy();
  });
});
