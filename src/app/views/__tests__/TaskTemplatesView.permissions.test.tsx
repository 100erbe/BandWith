import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/lib/haptics', () => ({
  haptic: { tap: vi.fn(), medium: vi.fn(), confirm: vi.fn(), delete: vi.fn(), selection: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/services/taskTemplates', async (orig) => ({
  ...(await orig<typeof import('@/lib/services/taskTemplates')>()),
  listTemplates: vi.fn(async () => ({
    data: [{ id: 'tt-1', band_id: 'band-1', name: 'Wedding prep', description: '', category: 'wedding', tasks: [{ id: 't1', title: 'Confirm timings', required: true }], is_default: false }],
    error: null,
  })),
}));

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { TaskTemplatesView } from '../TaskTemplatesView';

afterEach(cleanup);

describe('TaskTemplatesView permissions', () => {
  it('a member reads to-do lists but cannot create, change or use them', async () => {
    render(<TaskTemplatesView onBack={() => {}} bandId="band-1" canEdit={false} />);
    fireEvent.click(await screen.findByText('Wedding prep'));
    expect(await screen.findByText('Confirm timings')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /new to-do list/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /actions for wedding prep/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /use this list/i })).toBeNull();
  });

  it('an admin keeps every action', async () => {
    render(<TaskTemplatesView onBack={() => {}} bandId="band-1" />);
    fireEvent.click(await screen.findByText('Wedding prep'));
    expect(screen.getByRole('button', { name: /new to-do list/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /actions for wedding prep/i })).toBeTruthy();
    expect(await screen.findByRole('button', { name: /use this list/i })).toBeTruthy();
  });
});
