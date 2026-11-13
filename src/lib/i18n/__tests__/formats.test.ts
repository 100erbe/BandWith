/**
 * Dates and amounts on screen follow the app language; English stays exactly
 * as it was before (same tag as each call used).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setLocalePref, intlLocale, dateName, localDecimal } from '../index';
import { money, moneyShort } from '../../currency';
import { formatQuoteMoney } from '../../services/quoteMath';
import { formatContractDate } from '../../services/contracts';

const MAR_20 = new Date(2027, 2, 20); // a Saturday

afterEach(() => setLocalePref('en'));

describe('English is unchanged', () => {
  it('keeps the tag each call used', () => {
    setLocalePref('en');
    expect(intlLocale('en-US')).toBe('en-US');
    expect(intlLocale('en-GB')).toBe('en-GB');
    expect(intlLocale()).toBeUndefined();
  });

  it('formats names and amounts as before', () => {
    setLocalePref('en');
    expect(dateName(MAR_20, { month: 'short' })).toBe('Mar');
    expect(dateName(MAR_20, { weekday: 'short' })).toBe('Sat');
    expect(localDecimal('1.5')).toBe('1.5');
    expect(money(1250)).toBe('€1,250');
    expect(moneyShort(13200, 'K')).toBe('€13.2K');
    expect(formatQuoteMoney(1250.5, '€', intlLocale('en-US'))).toBe('€1,250.50');
  });
});

describe('other languages', () => {
  it('use their own month and weekday names, without the abbreviation dot', () => {
    setLocalePref('fr');
    expect(dateName(new Date(2027, 0, 5), { month: 'short' })).toBe('janv');
    setLocalePref('de');
    expect(dateName(MAR_20, { weekday: 'short' })).toBe('Sa');
    setLocalePref('it');
    expect(dateName(MAR_20, { month: 'short' })).toBe('mar');
  });

  it('use their own separators for amounts', () => {
    setLocalePref('it');
    expect(money(12500)).toBe('€12.500');
    expect(moneyShort(13200, 'K')).toBe('€13,2K');
    expect(localDecimal('1.5')).toBe('1,5');
    expect(formatQuoteMoney(12500.5, '€', intlLocale('en-US'))).toBe('€12.500,50');
  });

  it('keep client documents in English', () => {
    setLocalePref('it');
    expect(formatQuoteMoney(1250.5, '€')).toBe('€1,250.50');
    expect(formatContractDate('2027-03-20')).toBe('20 Mar 2027');
    expect(formatContractDate('2027-03-20', intlLocale('en-GB'))).toBe('20 mar 2027');
  });
});
