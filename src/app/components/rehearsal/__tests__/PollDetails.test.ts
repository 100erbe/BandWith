import { describe, expect, it } from 'vitest';
import { getActiveSymbol } from '@/lib/currency';
import { pollShareLabel } from '../PollDetails';

describe('pollShareLabel', () => {
  const s = () => getActiveSymbol().trim();

  it('splits the room cost between the members', () => {
    expect(pollShareLabel(60, 5)).toBe(`${s()}12`);
    expect(pollShareLabel('50', 3)).toBe(`${s()}16.67`);
  });

  it('has no share without a cost', () => {
    expect(pollShareLabel(null, 5)).toBeNull();
    expect(pollShareLabel(0, 5)).toBeNull();
    expect(pollShareLabel('', 5)).toBeNull();
  });

  it('counts at least one member', () => {
    expect(pollShareLabel(40, 0)).toBe(`${s()}40`);
    expect(pollShareLabel(40, undefined)).toBe(`${s()}40`);
  });
});
