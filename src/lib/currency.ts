/**
 * Band currency + country tax presets.
 *
 * The active band's currency lives in its pricing settings (`pricing_settings.currency`).
 * This module keeps a tiny global store of it so every money label in the app
 * (dashboard cards, fees, finance, notifications) shows the band's currency
 * instead of a hard-coded "€".
 *
 * - `setActiveCurrency(code, bandId)` is called when the selected band's pricing loads or is saved.
 * - `money(v)` / `moneyShort(v)` format with the active symbol (safe outside React).
 * - `useCurrency()` subscribes a component so it re-renders when the currency changes.
 */
import { useSyncExternalStore } from 'react';

export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'CHF';

export const CURRENCIES: { code: CurrencyCode; symbol: string; label: string }[] = [
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'USD', symbol: '$', label: 'US dollar' },
  { code: 'GBP', symbol: '£', label: 'British pound' },
  { code: 'CHF', symbol: 'CHF ', label: 'Swiss franc' },
];

export interface CountryTaxPreset {
  code: string;
  name: string;
  currency: CurrencyCode;
  /** Standard VAT / sales-tax rate in percent. */
  vatRate: number;
  /** Short label for the tax ("VAT", "IVA", "MwSt", "Sales tax"…). */
  taxLabel: string;
  note?: string;
}

/** Standard rates; live-performance services can qualify for reduced rates, so the rate stays editable. */
export const COUNTRY_TAX_PRESETS: CountryTaxPreset[] = [
  { code: 'IT', name: 'Italy', currency: 'EUR', vatRate: 22, taxLabel: 'IVA' },
  { code: 'ES', name: 'Spain', currency: 'EUR', vatRate: 21, taxLabel: 'IVA' },
  { code: 'FR', name: 'France', currency: 'EUR', vatRate: 20, taxLabel: 'TVA' },
  { code: 'DE', name: 'Germany', currency: 'EUR', vatRate: 19, taxLabel: 'MwSt' },
  { code: 'PT', name: 'Portugal', currency: 'EUR', vatRate: 23, taxLabel: 'IVA' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR', vatRate: 21, taxLabel: 'BTW' },
  { code: 'BE', name: 'Belgium', currency: 'EUR', vatRate: 21, taxLabel: 'BTW/TVA' },
  { code: 'AT', name: 'Austria', currency: 'EUR', vatRate: 20, taxLabel: 'USt' },
  { code: 'IE', name: 'Ireland', currency: 'EUR', vatRate: 23, taxLabel: 'VAT' },
  { code: 'GR', name: 'Greece', currency: 'EUR', vatRate: 24, taxLabel: 'ΦΠΑ' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP', vatRate: 20, taxLabel: 'VAT' },
  { code: 'CH', name: 'Switzerland', currency: 'CHF', vatRate: 8.1, taxLabel: 'MWST' },
  {
    code: 'US',
    name: 'United States',
    currency: 'USD',
    vatRate: 0,
    taxLabel: 'Sales tax',
    note: 'Sales tax depends on the state (and is often not charged on live performances). Set your local rate if it applies.',
  },
];

export const findCountryPreset = (code?: string | null): CountryTaxPreset | undefined =>
  code ? COUNTRY_TAX_PRESETS.find((c) => c.code === code) : undefined;

export const currencySymbol = (code?: string | null): string =>
  CURRENCIES.find((c) => c.code === code)?.symbol ?? '€';

// ── Active currency store ───────────────────────────────────────

let activeCode: CurrencyCode = 'EUR';
let activeBandId: string | null = null;
const listeners = new Set<() => void>();

const isCurrency = (code: unknown): code is CurrencyCode =>
  typeof code === 'string' && CURRENCIES.some((c) => c.code === code);

/** Set the active currency. When `bandId` is given and a different band is active, the call is ignored. */
export const setActiveCurrency = (code: string | null | undefined, bandId?: string | null, makeActive = false) => {
  if (makeActive) activeBandId = bandId ?? null;
  else if (bandId && activeBandId && bandId !== activeBandId) return;
  const next = isCurrency(code) ? code : 'EUR';
  if (next === activeCode) return;
  activeCode = next;
  listeners.forEach((l) => l());
};

export const getActiveCurrency = (): CurrencyCode => activeCode;
export const getActiveSymbol = (): string => currencySymbol(activeCode);

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Re-renders the caller when the band currency changes; returns `{ code, symbol }`. */
export const useCurrency = () => {
  const code = useSyncExternalStore(subscribe, getActiveCurrency, getActiveCurrency);
  return { code, symbol: currencySymbol(code) };
};

// ── Formatters (read the active symbol at call time) ────────────

const sign = (v: number) => (v < 0 ? '-' : '');

/** "€1,250" (no decimals unless needed when `decimals` is 'auto'). */
export const money = (value: number | string | null | undefined, decimals: 0 | 2 | 'auto' = 0): string => {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const digits = decimals === 'auto' ? (Number.isInteger(abs) ? 0 : 2) : decimals;
  return `${sign(n)}${getActiveSymbol()}${abs.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
};

/** "€1.5k" above 1000, otherwise "€950". */
export const moneyShort = (value: number | string | null | undefined, suffix: 'k' | 'K' = 'k'): string => {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  if (abs >= 1000) {
    const k = abs / 1000;
    return `${sign(n)}${getActiveSymbol()}${k.toFixed(abs % 1000 === 0 ? 0 : 1).replace(/\.0$/, '')}${suffix}`;
  }
  return `${sign(n)}${getActiveSymbol()}${abs.toLocaleString('en-US')}`;
};
