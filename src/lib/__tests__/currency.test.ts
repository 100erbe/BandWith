import { describe, it, expect, beforeEach } from 'vitest';
import {
  setActiveCurrency,
  getActiveSymbol,
  money,
  moneyShort,
  currencySymbol,
  findCountryPreset,
} from '@/lib/currency';

describe('currency', () => {
  beforeEach(() => setActiveCurrency('EUR', 'band-a', true));

  it('maps codes to symbols and falls back to euro', () => {
    expect(currencySymbol('USD')).toBe('$');
    expect(currencySymbol('GBP')).toBe('£');
    expect(currencySymbol('CHF')).toBe('CHF ');
    expect(currencySymbol('XYZ')).toBe('€');
    expect(currencySymbol(undefined)).toBe('€');
  });

  it('formats with the active band currency', () => {
    expect(money(1250)).toBe('€1,250');
    setActiveCurrency('USD', 'band-a');
    expect(money(1250.5, 'auto')).toBe('$1,250.50');
    expect(moneyShort(1500)).toBe('$1.5k');
    expect(moneyShort(2000)).toBe('$2k');
    expect(money(-40)).toBe('-$40');
  });

  it('ignores currency updates from a band that is not active', () => {
    setActiveCurrency('GBP', 'band-b');
    expect(getActiveSymbol()).toBe('€');
    setActiveCurrency('GBP', 'band-b', true);
    expect(getActiveSymbol()).toBe('£');
  });

  it('country presets carry currency and standard VAT', () => {
    expect(findCountryPreset('IT')).toMatchObject({ currency: 'EUR', vatRate: 22 });
    expect(findCountryPreset('GB')).toMatchObject({ currency: 'GBP', vatRate: 20 });
    expect(findCountryPreset('US')).toMatchObject({ currency: 'USD', vatRate: 0 });
    expect(findCountryPreset('ZZ')).toBeUndefined();
  });
});
