import { describe, it, expect } from 'vitest';
import { quoteMusicianFee } from '../quoteMath';

describe('quoteMusicianFee', () => {
  it('reads the fee the quote wizard stores', () => {
    expect(quoteMusicianFee({ fee: 360 })).toBe(360);
    expect(quoteMusicianFee({ fee: '180.5' })).toBe(180.5);
  });

  it('falls back to the older rate / customFee fields', () => {
    expect(quoteMusicianFee({ rate: 200 })).toBe(200);
    expect(quoteMusicianFee({ customFee: '170' })).toBe(170);
    expect(quoteMusicianFee({ fee: 0, rate: 250 })).toBe(250);
  });

  it('is 0 when nothing usable is there', () => {
    expect(quoteMusicianFee({})).toBe(0);
    expect(quoteMusicianFee(null)).toBe(0);
    expect(quoteMusicianFee({ fee: 'abc' })).toBe(0);
    expect(quoteMusicianFee({ fee: -50 })).toBe(0);
  });
});
