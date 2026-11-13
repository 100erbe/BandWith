import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { STAGE_FULL_ATTR, setStageBarHidden, useStageBarHidden, useStageFullScreen } from '../stageChrome';

describe('stageChrome', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute(STAGE_FULL_ATTR);
  });

  it('remembers the choice and updates every reader', () => {
    const a = renderHook(() => useStageBarHidden());
    const b = renderHook(() => useStageBarHidden());
    expect(a.result.current[0]).toBe(false);
    act(() => a.result.current[1](true));
    expect(a.result.current[0]).toBe(true);
    expect(b.result.current[0]).toBe(true);
    expect(localStorage.getItem('bw-stage-bar-hidden-v1')).toBe('1');
    act(() => setStageBarHidden(false));
    expect(b.result.current[0]).toBe(false);
    expect(localStorage.getItem('bw-stage-bar-hidden-v1')).toBeNull();
  });

  it('marks <html> only while full screen is on and mounted', () => {
    const { rerender, unmount } = renderHook(({ on }) => useStageFullScreen(on), { initialProps: { on: false } });
    expect(document.documentElement.hasAttribute(STAGE_FULL_ATTR)).toBe(false);
    rerender({ on: true });
    expect(document.documentElement.hasAttribute(STAGE_FULL_ATTR)).toBe(true);
    rerender({ on: false });
    expect(document.documentElement.hasAttribute(STAGE_FULL_ATTR)).toBe(false);
    rerender({ on: true });
    unmount();
    expect(document.documentElement.hasAttribute(STAGE_FULL_ATTR)).toBe(false);
  });
});
