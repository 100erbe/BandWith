import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

// Phase 3: the gig wizard closes only after a save, and keeps what the user
// typed (and a draft) when the save fails. Band, pricing, songs and tasks
// come from mocks.
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

const drafts = vi.hoisted(() => ({ save: vi.fn(), del: vi.fn() }));
vi.mock('@/lib/wizardDrafts', async (orig) => ({
  ...(await orig<typeof import('@/lib/wizardDrafts')>()),
  saveEventDraft: drafts.save,
  deleteEventDraft: drafts.del,
}));

import { CreateEventModal } from '../CreateEventModal';
import { addressWithoutCity } from '@/lib/eventAddress';

const gig = {
  id: 3,
  eventId: 'evt-3',
  title: 'Rooftop Session',
  status: 'CONFIRMED',
  eventType: 'club',
  date: '2099-11-13',
  time: '21:00',
  location: 'Terrazza Aurora',
  price: '1200',
  venueAddress: 'Via Mazzini 12, Milano',
  venueCity: 'Milano',
  indoorOutdoor: 'outdoor',
};

const draft = {
  id: 'draft-1',
  userId: 'me',
  bandId: 'band-1',
  title: 'Club night',
  savedAt: '2099-01-01T00:00:00.000Z',
  state: {
    step: 2,
    eventType: 'club',
    details: { title: 'Club night', date: '2099-12-01', startTime: '21:00', endTime: '23:30', venue: 'Blue Note' },
    titleManuallyEdited: true,
    selectedMembers: [],
    memberFees: {},
  },
};

afterEach(() => {
  cleanup();
  drafts.save.mockReset();
  drafts.del.mockReset();
});

describe('addressWithoutCity', () => {
  it('drops the city the form shows on its own', () => {
    expect(addressWithoutCity('Via Mazzini 12, Milano', 'Milano')).toBe('Via Mazzini 12');
    expect(addressWithoutCity('Via Mazzini 12, Milano, milano', 'Milano')).toBe('Via Mazzini 12');
    expect(addressWithoutCity('Via Mazzini 12', 'Milano')).toBe('Via Mazzini 12');
    expect(addressWithoutCity('Milano', 'Milano')).toBe('Milano');
    expect(addressWithoutCity(undefined, 'Milano')).toBe('');
  });
});

describe('editing a gig (Phase 3)', () => {
  it('keeps the setting and does not repeat the city in the address', async () => {
    const onCreate = vi.fn(async () => true);
    render(<CreateEventModal onClose={vi.fn()} onCreate={onCreate} editingEvent={gig} currentUserId="me" />);
    fireEvent.click(screen.getByText('Save changes'));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    const sent = (onCreate.mock.calls[0] as unknown[])[0] as any;
    expect(sent.details.address).toBe('Via Mazzini 12');
    expect(sent.details.city).toBe('Milano');
    expect(sent.setting).toBe('outdoor');
  });

  it('a setting the form cannot show ("hybrid") is kept as it is', async () => {
    const onCreate = vi.fn(async () => true);
    render(<CreateEventModal onClose={vi.fn()} onCreate={onCreate} editingEvent={{ ...gig, indoorOutdoor: 'hybrid' }} currentUserId="me" />);
    fireEvent.click(screen.getByText('Save changes'));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(((onCreate.mock.calls[0] as unknown[])[0] as any).setting).toBe('hybrid');
  });
});

describe('a failed save (Phase 3)', () => {
  it('keeps the wizard open, keeps the draft, and lets the user try again', async () => {
    const onClose = vi.fn();
    const onCreate = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<CreateEventModal onClose={onClose} onCreate={onCreate} draft={draft as any} currentUserId="me" />);

    fireEvent.click(screen.getByText('Create gig'));
    await waitFor(() => expect(drafts.save).toHaveBeenCalledTimes(1));
    expect(drafts.save.mock.calls[0][0]).toMatchObject({ id: 'draft-1', userId: 'me', bandId: 'band-1' });
    expect(drafts.del).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Create gig')).toBeTruthy();

    fireEvent.click(screen.getByText('Create gig'));
    await waitFor(() => expect(drafts.del).toHaveBeenCalledWith('draft-1'));
    expect(onCreate).toHaveBeenCalledTimes(2);
  });

  it('a save that throws counts as not saved', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<CreateEventModal onClose={vi.fn()} onCreate={onCreate} draft={draft as any} currentUserId="me" />);
    fireEvent.click(screen.getByText('Create gig'));
    await waitFor(() => expect(drafts.save).toHaveBeenCalledTimes(1));
    expect(drafts.del).not.toHaveBeenCalled();
  });
});
