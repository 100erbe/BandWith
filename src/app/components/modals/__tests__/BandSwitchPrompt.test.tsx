import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

vi.mock('@/lib/haptics', () => ({
  haptic: { tap: vi.fn(), medium: vi.fn(), confirm: vi.fn(), delete: vi.fn(), selection: vi.fn() },
}));

import { BandSwitchPrompt } from '../BandSwitchPrompt';

afterEach(cleanup);

describe('BandSwitchPrompt', () => {
  it('names both bands and switches on confirm', () => {
    const onChoose = vi.fn();
    render(
      <BandSwitchPrompt
        request={{ bandName: 'Mirage', activeBandName: 'Velvet Static', action: 'delete this event' }}
        onChoose={onChoose}
      />,
    );
    expect(screen.getByText(/You’re in Velvet Static right now/)).toBeTruthy();
    fireEvent.click(screen.getByText('Switch to Mirage'));
    expect(onChoose).toHaveBeenCalledWith('switch');
  });

  it('offers "Just view" for items that can be viewed from any band', () => {
    const onChoose = vi.fn();
    render(
      <BandSwitchPrompt request={{ bandName: 'Mirage', action: 'act on it', allowStay: true }} onChoose={onChoose} />,
    );
    fireEvent.click(screen.getByText('Just view'));
    expect(onChoose).toHaveBeenCalledWith('stay');
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('renders nothing without a request', () => {
    render(<BandSwitchPrompt request={null} onChoose={vi.fn()} />);
    expect(screen.queryByText(/Switch to/)).toBeNull();
  });
});
