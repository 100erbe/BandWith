import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { handleBackFromStack, onEscapeKey, runBack, setAppBack, useSystemBack } from '../backStack';

const escape = (init: KeyboardEventInit = {}) => new KeyboardEvent('keydown', { key: 'Escape', cancelable: true, ...init });

describe('backStack', () => {
  let unregister: (() => void) | null = null;
  afterEach(() => {
    unregister?.();
    unregister = null;
  });

  it('asks the most recently opened layer first', () => {
    const parent = vi.fn(() => true);
    const sheet = vi.fn(() => true);
    const a = renderHook(() => useSystemBack(true, parent));
    const b = renderHook(() => useSystemBack(true, sheet));
    expect(handleBackFromStack()).toBe(true);
    expect(sheet).toHaveBeenCalledTimes(1);
    expect(parent).not.toHaveBeenCalled();
    b.unmount();
    expect(handleBackFromStack()).toBe(true);
    expect(parent).toHaveBeenCalledTimes(1);
    a.unmount();
    expect(handleBackFromStack()).toBe(false);
  });

  it('registers only while active and passes a press on when the handler returns false', () => {
    const parent = vi.fn(() => true);
    const inactive = vi.fn(() => true);
    const declines = vi.fn(() => false);
    const a = renderHook(() => useSystemBack(true, parent));
    const b = renderHook(() => useSystemBack(false, inactive));
    const c = renderHook(() => useSystemBack(true, declines));
    expect(handleBackFromStack()).toBe(true);
    expect(declines).toHaveBeenCalledTimes(1);
    expect(inactive).not.toHaveBeenCalled();
    expect(parent).toHaveBeenCalledTimes(1);
    [a, b, c].forEach((h) => h.unmount());
  });

  it('runs the app chain when the app is mounted, else the stack', () => {
    const sheet = vi.fn(() => true);
    const h = renderHook(() => useSystemBack(true, sheet));
    expect(runBack('key')).toBe(true);
    expect(sheet).toHaveBeenCalledTimes(1);
    const app = vi.fn(() => false);
    unregister = setAppBack(app);
    expect(runBack('web')).toBe(false);
    expect(app).toHaveBeenCalledWith('web');
    h.unmount();
  });

  it('Escape closes the top layer once and claims the key', () => {
    const sheet = vi.fn(() => true);
    const h = renderHook(() => useSystemBack(true, sheet));
    const e = escape();
    onEscapeKey(e);
    expect(sheet).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
    h.unmount();
  });

  it('Escape leaves alone keys a field or menu already used, other keys and IME composition', () => {
    const app = vi.fn(() => true);
    unregister = setAppBack(app);
    const used = escape();
    used.preventDefault();
    onEscapeKey(used);
    onEscapeKey(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    onEscapeKey(escape({ isComposing: true }));
    // Escape typed in a text field stays with the field.
    const field = document.createElement('textarea');
    document.body.appendChild(field);
    field.dispatchEvent(escape({ bubbles: true }));
    field.remove();
    expect(app).not.toHaveBeenCalled();
  });

  it('Escape with nothing to close keeps the key unclaimed', () => {
    unregister = setAppBack(() => false);
    const e = escape();
    onEscapeKey(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('the window listener routes Escape through the chain', () => {
    const app = vi.fn(() => true);
    unregister = setAppBack(app);
    window.dispatchEvent(escape());
    expect(app).toHaveBeenCalledWith('key');
  });
});
