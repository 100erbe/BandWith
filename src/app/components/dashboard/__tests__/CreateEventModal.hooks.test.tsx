import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// The wizard reads the band, pricing, songs and tasks from Supabase. None of
// that matters here: the test only checks that the hook order stays the same
// when the viewer's admin role changes while the wizard is open.
const band = vi.hoisted(() => ({ isAdmin: true }));
vi.mock('@/lib/BandContext', () => ({
  useBand: () => ({ selectedBand: { id: 'band-1', name: 'Testcento' }, bands: [], isAdmin: band.isAdmin }),
}));
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
vi.mock('@/lib/services/songs', () => ({
  getSongs: vi.fn(async () => ({ data: [], error: null })),
  getSetlists: vi.fn(async () => ({ data: [], error: null })),
  getSetlist: vi.fn(async () => ({ data: null, error: null })),
}));
vi.mock('@/lib/services/eventTasks', () => ({ listEventTasks: vi.fn(async () => ({ data: [], error: null })) }));
vi.mock('@/lib/services/pricing', async (orig) => ({
  ...(await orig<typeof import('@/lib/services/pricing')>()),
  getBandPricing: vi.fn(() => new Promise(() => {})),
}));

// The shared setup mocks ResizeObserver with an arrow function, which
// vitest 4 cannot call with `new`.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { CreateEventModal } from '../CreateEventModal';

const quote = {
  id: 7,
  eventId: 'evt-7',
  title: 'Wedding Rossi',
  status: 'QUOTE',
  date: '2099-12-12',
  time: '19:30',
  location: 'Villa Clara',
  price: '2400',
};

afterEach(() => {
  cleanup();
  band.isAdmin = true;
});

describe('CreateEventModal hook order', () => {
  it('does not crash when the admin role is lost while a quote is open', () => {
    const onClose = vi.fn();
    const { rerender, container } = render(<CreateEventModal onClose={onClose} onCreate={vi.fn()} editingEvent={quote} />);
    expect(container.innerHTML).not.toBe('');
    band.isAdmin = false;
    expect(() => rerender(<CreateEventModal onClose={onClose} onCreate={vi.fn()} editingEvent={quote} />)).not.toThrow();
    // A member never sees a quote: the wizard renders nothing and closes.
    expect(container.innerHTML).toBe('');
    expect(onClose).toHaveBeenCalled();
  });
});
