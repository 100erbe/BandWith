import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, cleanup } from '@testing-library/react';

vi.mock('@/lib/haptics', () => ({
  haptic: { tap: vi.fn(), medium: vi.fn(), confirm: vi.fn(), delete: vi.fn(), selection: vi.fn() },
}));

import { computePosture, updatePosture, LAPTOP_POSE_PREF, SETTLE_MS, setLaptopPoseEnabled } from '@/lib/posture';
import { FoldSplit } from '../FoldSplit';
import { BandDeskMode } from '../modes/BandDeskMode';
import { PlannerMode } from '../modes/PlannerMode';
import { FindADateMode } from '../modes/FindADateMode';
import { FloorWedgeMode } from '../modes/FloorWedgeMode';
import { QuoteDeskMode } from '../modes/QuoteDeskMode';

// Entering Laptop pose waits for the phone to settle (SETTLE_MS).
const tabletop = () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  act(() => {
    updatePosture(
      computePosture({ viewport: { w: 669, h: 900 }, division: { x: 0, y: 440, w: 669, h: 20 }, hinge: 'half-open' }),
    );
  });
  act(() => {
    vi.advanceTimersByTime(SETTLE_MS);
  });
  vi.useRealTimers();
};
const flat = () =>
  act(() => {
    updatePosture(computePosture({ viewport: { w: 393, h: 852 } }));
  });

afterEach(() => {
  cleanup();
  flat();
  localStorage.removeItem(LAPTOP_POSE_PREF);
});

describe('FoldSplit', () => {
  it('renders nothing outside Laptop pose', () => {
    flat();
    render(<FoldSplit display={<p>poster</p>} deck={<p>controls</p>} />);
    expect(screen.queryByText('poster')).toBeNull();
    expect(document.documentElement.hasAttribute('data-bw-posture')).toBe(false);
  });

  it('renders Display and Deck in Laptop pose and sets the posture attribute', () => {
    tabletop();
    render(<FoldSplit display={<p>poster</p>} deck={<p>controls</p>} />);
    expect(screen.getByText('poster')).toBeInTheDocument();
    expect(screen.getByText('controls')).toBeInTheDocument();
    expect(document.documentElement.getAttribute('data-bw-posture')).toBe('tabletop');
    expect(document.documentElement.style.getPropertyValue('--bw-deck-top')).toBe('472px');
  });

  it('honours the Settings switch', () => {
    tabletop();
    act(() => setLaptopPoseEnabled(false));
    render(<FoldSplit display={<p>poster</p>} deck={<p>controls</p>} />);
    expect(screen.queryByText('poster')).toBeNull();
  });
});

describe('Laptop pose modes render with real-shaped data and empty states', () => {
  it('BandDeskMode', () => {
    tabletop();
    const onGig = vi.fn();
    render(
      <BandDeskMode
        nextGig={{ title: 'Blue Note', date: '2030-01-05', venue: 'Blue Note', start: '21:00', lineup: ['Ana', 'Bo'], fee: 900 }}
        isAdmin
        actionItems={[{ id: 'a', title: 'Answer the poll', urgent: true }]}
        onCreateGig={onGig}
      />,
    );
    expect(screen.getByText('Blue Note', { selector: 'h1' })).toBeInTheDocument();
    expect(screen.getByText('Ana · Bo')).toBeInTheDocument();
    screen.getByLabelText('New gig').click();
    expect(onGig).toHaveBeenCalled();
    cleanup();
    render(<BandDeskMode nextGig={null} isAdmin={false} actionItems={[]} />);
    expect(screen.getByText('No gigs coming up')).toBeInTheDocument();
  });

  it('PlannerMode', () => {
    tabletop();
    render(
      <PlannerMode
        events={[{ id: '1', title: 'Club', date: '2026-11-07', kind: 'gig', fee: 800 }]}
        isAdmin
        selectedDate="2026-11-07"
        onAddGig={() => {}}
      />,
    );
    expect(screen.getByText('November 2026')).toBeInTheDocument();
    expect(screen.getByText('Club')).toBeInTheDocument();
  });

  it('FindADateMode', () => {
    tabletop();
    const onLock = vi.fn();
    render(
      <FindADateMode
        poll={{
          id: 'p', band_id: 'b', created_by: 'u1', creator_role: 'admin', title: 'Rehearsal', status: 'polling',
          created_at: '', updated_at: '', total_members_count: 3,
          options: [
            { id: 'o1', poll_id: 'p', proposed_date: '2026-11-18', start_time: '19:00', created_at: '', vote_count: 2, has_voted: true,
              votes: [{ id: 'v1', poll_id: 'p', option_id: 'o1', user_id: 'u1', created_at: '' }, { id: 'v2', poll_id: 'p', option_id: 'o1', user_id: 'u2', created_at: '' }] },
            { id: 'o2', poll_id: 'p', proposed_date: '2026-11-19', start_time: '19:00', created_at: '', vote_count: 0, votes: [] },
          ],
        }}
        members={[{ id: 'u1', name: 'Me' }, { id: 'u2', name: 'Bo' }, { id: 'u3', name: 'Cy' }]}
        currentUserId="u1"
        isAdmin
        onToggleVote={() => {}}
        onLock={onLock}
      />,
    );
    expect(screen.getByText('2 of 3 voted')).toBeInTheDocument();
    screen.getByText(/^Lock /).closest('button')!.click();
    expect(onLock).toHaveBeenCalledWith('o1');
  });

  it('FloorWedgeMode keeps the screen awake while mounted', () => {
    tabletop();
    const { unmount } = render(
      <FloorWedgeMode songs={[{ title: 'Intro', key: 'Am', bpm: 120, duration: '3:00' }, { title: 'Outro' }]} />,
    );
    expect(screen.getByText('Intro')).toBeInTheDocument();
    expect(document.documentElement.dataset.bwKeepAwake).toBe('1');
    act(() => screen.getByLabelText('Next song').click());
    expect(screen.getByText('Outro', { selector: 'h1' })).toBeInTheDocument();
    unmount();
    expect(document.documentElement.dataset.bwKeepAwake).toBeUndefined();
  });

  it('QuoteDeskMode', () => {
    tabletop();
    const onQty = vi.fn();
    render(
      <QuoteDeskMode
        title="Wedding"
        lines={[{ id: 'l1', description: 'Band', quantity: 1, unitPrice: 1000 }]}
        vatRate={22}
        onQuantityChange={onQty}
        onSend={() => {}}
      />,
    );
    screen.getByLabelText('Increase').click();
    expect(onQty).toHaveBeenCalledWith('l1', 2);
    expect(screen.getAllByText('€1,220').length).toBeGreaterThan(0);
  });
});
