import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { closeTopOverlay, isEditableTarget, useCloseOnBack } from '../overlayBack';
import { dataUrlToBlob } from '../imageResize';
import { lookupInviteCount } from '@/app/components/onboarding/JoinerEmailLookup';

describe('Back closes the sheet on top first', () => {
  it('closes the last opened sheet, then nothing', () => {
    const legal = vi.fn();
    const invite = vi.fn();
    const a = renderHook(({ open }) => useCloseOnBack(open, legal), { initialProps: { open: true } });
    const b = renderHook(({ open }) => useCloseOnBack(open, invite), { initialProps: { open: true } });
    expect(closeTopOverlay()).toBe(true);
    expect(invite).toHaveBeenCalledTimes(1);
    b.rerender({ open: false });
    expect(closeTopOverlay()).toBe(true);
    expect(legal).toHaveBeenCalledTimes(1);
    a.rerender({ open: false });
    expect(closeTopOverlay()).toBe(false);
  });

  it('leaves Escape to text fields', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true);
    expect(isEditableTarget(document.createElement('button'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('onboarding helpers', () => {
  it('turns the inline band photo into an uploadable image', () => {
    const blob = dataUrlToBlob('data:image/jpeg;base64,/9j/4AAQ');
    expect(blob?.type).toBe('image/jpeg');
    expect(blob?.size).toBe(6);
    expect(dataUrlToBlob('https://example.com/logo.png')).toBeNull();
  });

  it('uses only how many invites the lookup found', () => {
    expect(lookupInviteCount({ success: true, count: 2 })).toBe(2);
    expect(lookupInviteCount({ success: true, count: 0 })).toBe(0);
    // An older deployment still sends the list.
    expect(lookupInviteCount({ success: true, invites: [{}, {}, {}] })).toBe(3);
    expect(lookupInviteCount(null)).toBe(0);
  });
});
