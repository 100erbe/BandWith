import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, cleanup, screen, waitFor } from '@testing-library/react';

// Setlist rows per setlist id; every other query resolves empty.
const rows = vi.hoisted(() => ({
  'sl-a': [{ song: { title: 'O sole mio', artist: 'Traditional', duration_seconds: 200, key: 'C' } }],
  'sl-b': [] as unknown[],
}));
vi.mock('@/lib/supabase', () => {
  const builder = () => {
    let setlistId: string | undefined;
    const b: any = new Proxy(function () {}, {
      get: (_t, prop) => {
        if (prop === 'eq') return (col: string, val: string) => ((col === 'setlist_id' && (setlistId = val)), b);
        if (prop === 'then') {
          const data = setlistId ? (rows as Record<string, unknown[]>)[setlistId] ?? [] : null;
          const p = Promise.resolve({ data, error: null });
          return p.then.bind(p);
        }
        return b;
      },
      apply: () => b,
    });
    return b;
  };
  return { supabase: new Proxy({}, { get: () => () => builder() }) };
});
vi.mock('@/lib/haptics', () => ({
  haptic: { tap: vi.fn(), medium: vi.fn(), confirm: vi.fn(), delete: vi.fn(), selection: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/BandContext', () => ({ useBand: () => ({ selectedBand: null, bands: [] }) }));
vi.mock('@/app/components/ui/WeatherWidget', () => ({ WeatherWidget: () => null }));
vi.mock('@/app/components/event/useEventMembers', () => ({
  useEventMembers: () => ({ members: [], loading: false, error: null, paidSupported: false, markAllPaid: vi.fn(), markingPaid: false, markError: null }),
}));
vi.mock('@/lib/services/eventTasks', () => ({
  useEventTasks: () => ({ tasks: [], toggle: vi.fn(), error: null }),
}));

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { EventDetail } from '../EventDetail';
import type { EventData } from '../EventCard';

const gig = (eventId: string, setlistId: string): EventData => ({
  id: 1,
  eventId,
  band_id: 'band-1',
  title: 'Wedding Rossi',
  status: 'CONFIRMED',
  date: '2099-12-12',
  time: '19:30',
  location: 'Villa Clara',
  price: '2400',
  members: [],
  color: '#000',
  setlistId,
});

afterEach(cleanup);

describe('EventDetail setlist', () => {
  it('does not keep the previous setlist when the new one is empty', async () => {
    const props = { onClose: vi.fn(), isAdmin: true, currentUserId: 'u-1' };
    const { rerender } = render(<EventDetail {...props} event={gig('evt-a', 'sl-a')} />);
    await waitFor(() => expect(screen.queryAllByText('O sole mio').length).toBeGreaterThan(0));
    rerender(<EventDetail {...props} event={gig('evt-a', 'sl-b')} />);
    // Let the second query settle: while it loads the list is hidden anyway.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.queryAllByText('O sole mio')).toHaveLength(0);
  });
});
