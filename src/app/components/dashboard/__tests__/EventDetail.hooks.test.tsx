import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// EventDetail talks to Supabase and the band context; none of that matters
// here: the test only checks that the component keeps the same hook order
// when the viewer's answer changes while it is open.
vi.mock('@/lib/haptics', () => ({
  haptic: { tap: vi.fn(), medium: vi.fn(), confirm: vi.fn(), delete: vi.fn(), selection: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/supabase', () => {
  const result = Promise.resolve({ data: null, error: null });
  const chain: any = new Proxy(function () {}, {
    get: (_t, prop) => (prop === 'then' ? result.then.bind(result) : chain),
    apply: () => chain,
  });
  return { supabase: chain };
});
vi.mock('@/lib/BandContext', () => ({ useBand: () => ({ selectedBand: null, bands: [] }) }));
vi.mock('@/app/components/ui/WeatherWidget', () => ({ WeatherWidget: () => null }));
vi.mock('@/app/components/event/useEventMembers', () => ({
  useEventMembers: () => ({ members: [], loading: false, error: null, paidSupported: false, markAllPaid: vi.fn(), markingPaid: false, markError: null }),
}));
vi.mock('@/lib/services/eventTasks', () => ({
  useEventTasks: () => ({ tasks: [], toggle: vi.fn(), error: null }),
}));

// The shared setup mocks ResizeObserver with an arrow function, which
// vitest 4 cannot call with `new`; FitText needs a real constructor.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { EventDetail } from '../EventDetail';
import type { EventData } from '../EventCard';

const gig: EventData = {
  id: 1,
  eventId: 'evt-1',
  band_id: 'band-1',
  title: 'Wedding Rossi',
  status: 'CONFIRMED',
  date: '2099-12-12',
  time: '19:30',
  location: 'Villa Clara',
  price: '2400',
  members: [],
  color: '#000',
};

afterEach(cleanup);

describe('EventDetail hook order', () => {
  it('does not crash when a member declines while the gig is open', () => {
    const props = { event: gig, onClose: vi.fn(), isAdmin: false, currentUserId: 'u-1' };
    const { rerender, container } = render(<EventDetail {...props} userResponse="accepted" />);
    expect(container.innerHTML).not.toBe('');
    // A declined member no longer sees the gig: the detail renders nothing.
    expect(() => rerender(<EventDetail {...props} userResponse="declined" />)).not.toThrow();
    expect(container.innerHTML).toBe('');
  });
});
