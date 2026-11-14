import { describe, expect, it } from 'vitest';
import { clearStageCache } from '../stageBleNative';

describe('clearStageCache', () => {
  it('removes kept setlists and Bluetooth keys, nothing else', () => {
    localStorage.setItem('bw-setlist-songs:s1', '[]');
    localStorage.setItem('bw-stage-key:e1', 'k');
    localStorage.setItem('bw-stage-key:e2', 'k');
    localStorage.setItem('bw-locale', 'it');
    clearStageCache();
    expect(localStorage.getItem('bw-setlist-songs:s1')).toBeNull();
    expect(localStorage.getItem('bw-stage-key:e1')).toBeNull();
    expect(localStorage.getItem('bw-stage-key:e2')).toBeNull();
    expect(localStorage.getItem('bw-locale')).toBe('it');
    localStorage.removeItem('bw-locale');
  });
});
