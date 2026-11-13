import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';

const band = vi.hoisted(() => ({ isAdmin: false }));
vi.mock('@/lib/BandContext', () => ({
  useBand: () => ({ selectedBand: { id: 'band-1', name: 'Velvet Static' }, isAdmin: band.isAdmin }),
}));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/lib/haptics', () => ({
  haptic: { tap: vi.fn(), medium: vi.fn(), confirm: vi.fn(), delete: vi.fn(), selection: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const song = { id: 'song-1', band_id: 'band-1', title: 'O sole mio', artist: 'Traditional', duration_seconds: 200, status: 'ready', genre: null };
vi.mock('@/lib/services/songs', () => ({
  getSongs: vi.fn(async () => ({ data: [song], error: null })),
  getSetlists: vi.fn(async () => ({ data: [{ id: 'sl-1', band_id: 'band-1', name: 'Wedding main set', song_count: 1 }], error: null })),
  getSetlist: vi.fn(async () => ({
    data: { id: 'sl-1', band_id: 'band-1', name: 'Wedding main set', song_count: 1, songs: [{ id: 'ss-1', setlist_id: 'sl-1', song_id: 'song-1', position: 0, set_number: 1 }] },
    error: null,
  })),
  createSong: vi.fn(), deleteSong: vi.fn(), updateSong: vi.fn(),
  createSetlist: vi.fn(), updateSetlist: vi.fn(), deleteSetlist: vi.fn(),
  replaceSetlistSongs: vi.fn(), seedRepertoireSongs: vi.fn(), bulkCreateSongs: vi.fn(),
}));

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { SetlistManagerView } from '../SetlistManagerView';

afterEach(cleanup);

const openSetlist = async () => {
  render(<SetlistManagerView onClose={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: /^setlists/i }));
  fireEvent.click(await screen.findByText('Wedding main set'));
  await screen.findByRole('button', { name: /export setlist as pdf/i });
};

describe('SetlistManagerView permissions', () => {
  it('a member reads setlists but cannot create, edit or delete them', async () => {
    band.isAdmin = false;
    await openSetlist();
    expect(screen.queryByRole('button', { name: /new setlist/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete setlist/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /save setlist/i })).toBeNull();
    expect(screen.queryByText(/add songs from library/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /remove o sole mio/i })).toBeNull();
    expect(screen.getAllByText('O sole mio').length).toBeGreaterThan(0);
  });

  it('an admin keeps every action', async () => {
    band.isAdmin = true;
    await openSetlist();
    await waitFor(() => expect(screen.getByRole('button', { name: /delete setlist/i })).toBeTruthy());
    expect(screen.getByRole('button', { name: /save setlist/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /remove o sole mio/i })).toBeTruthy();
    expect(screen.getByText(/add songs from library/i)).toBeTruthy();
  });
});
