/**
 * Distance unit preference (Settings › Units): kilometres or miles.
 *
 * Everything is still stored in kilometres (pricing settings, quotes, the
 * travel maths). Only what people read and type is converted, at the edges:
 * `toUnit()` before showing a distance, `fromUnit()` before saving one, and
 * `ratePerUnit()` / `ratePerKm()` for prices that are charged per distance.
 *
 * The choice is per device (like the theme). Until it is set, it follows the
 * device region: miles in the United States, the United Kingdom, Liberia and
 * Myanmar, kilometres everywhere else.
 */
import { useSyncExternalStore } from 'react';

export type DistanceUnit = 'km' | 'mi';

export const KM_PER_MILE = 1.609344;
const KEY = 'bw-distance-unit-v1';
const CHANGED = 'bw:distance-unit';
const MILE_REGIONS = new Set(['US', 'GB', 'LR', 'MM']);

const regionDefault = (): DistanceUnit => {
  try {
    const langs = typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : [];
    for (const l of langs) {
      const region = /[-_]([A-Za-z]{2})\b/.exec(l || '')?.[1]?.toUpperCase();
      if (region) return MILE_REGIONS.has(region) ? 'mi' : 'km';
    }
  } catch {
    /* no navigator */
  }
  return 'km';
};

const isUnit = (v: unknown): v is DistanceUnit => v === 'km' || v === 'mi';

const read = (): DistanceUnit => {
  try {
    const v = localStorage.getItem(KEY);
    if (isUnit(v)) return v;
  } catch {
    /* storage blocked */
  }
  return regionDefault();
};

let current: DistanceUnit | null = null;
export const getDistanceUnit = (): DistanceUnit => (current ??= read());

export const setDistanceUnit = (unit: DistanceUnit) => {
  current = unit;
  try {
    localStorage.setItem(KEY, unit);
  } catch {
    /* best effort */
  }
  try {
    window.dispatchEvent(new Event(CHANGED));
  } catch {
    /* no window */
  }
};

const subscribe = (l: () => void) => {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      current = read();
      l();
    }
  };
  window.addEventListener(CHANGED, l);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(CHANGED, l);
    window.removeEventListener('storage', onStorage);
  };
};

/** Re-renders the caller when the unit changes. */
export const useDistanceUnit = (): DistanceUnit => useSyncExternalStore(subscribe, getDistanceUnit, () => 'km');

/** "km" / "mi". */
export const unitShort = (unit: DistanceUnit = getDistanceUnit()) => unit;
/** "kilometres" / "miles". */
export const unitLong = (unit: DistanceUnit = getDistanceUnit()) => (unit === 'mi' ? 'miles' : 'kilometres');
/** "km" / "mile" — after "per" ("Rate per mile"). */
export const unitSingular = (unit: DistanceUnit = getDistanceUnit()) => (unit === 'mi' ? 'mile' : 'km');

/** Kilometres → the chosen unit (rounded to `decimals`). */
export const toUnit = (km: number | null | undefined, unit: DistanceUnit = getDistanceUnit(), decimals = 0): number => {
  const n = Number(km) || 0;
  const v = unit === 'mi' ? n / KM_PER_MILE : n;
  const p = 10 ** decimals;
  return Math.round(v * p) / p;
};

/** A distance typed in the chosen unit → kilometres (kept to 0.1 km). */
export const fromUnit = (value: number | null | undefined, unit: DistanceUnit = getDistanceUnit()): number => {
  const n = Number(value) || 0;
  return unit === 'mi' ? Math.round(n * KM_PER_MILE * 10) / 10 : n;
};

/** "80 km" / "50 mi". */
export const formatDistance = (km: number | null | undefined, unit: DistanceUnit = getDistanceUnit()) =>
  `${toUnit(km, unit).toLocaleString('en-US')} ${unit}`;

/** A price per km → per chosen unit (2 decimals). */
export const ratePerUnit = (perKm: number | null | undefined, unit: DistanceUnit = getDistanceUnit()) => {
  const n = Number(perKm) || 0;
  return Math.round((unit === 'mi' ? n * KM_PER_MILE : n) * 100) / 100;
};

/** A price typed per chosen unit → per km (kept to 4 decimals so it round-trips). */
export const ratePerKm = (perUnit: number | null | undefined, unit: DistanceUnit = getDistanceUnit()) => {
  const n = Number(perUnit) || 0;
  return unit === 'mi' ? Math.round((n / KM_PER_MILE) * 10000) / 10000 : n;
};

/** Wind / driving speed: km/h → "15 km/h" or "9 mph". */
export const formatSpeed = (kmh: number | null | undefined, unit: DistanceUnit = getDistanceUnit()) =>
  unit === 'mi' ? `${Math.round((Number(kmh) || 0) / KM_PER_MILE)} mph` : `${Math.round(Number(kmh) || 0)} km/h`;
