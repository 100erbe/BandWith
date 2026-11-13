/**
 * Display helpers shared by the event detail screens (gig, rehearsal, quote,
 * personal gig), the RSVP sheet and stage mode. Pure functions, no React.
 */
import { parseLocalDate } from '@/lib/dates';

import { dateName, intlLocale, getLocale } from '@/lib/i18n';
const pad = (n: number) => String(n).padStart(2, '0');

/** "19:30:00" / "7:30" → "19:30" (24h). Empty string when there is no time. */
export const formatTime24 = (time?: string | null): string => {
  if (!time) return '';
  const m = String(time).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(time);
  return `${pad(parseInt(m[1], 10))}:${m[2]}`;
};

/**
 * Event time on screen. English: "19:30" → "7:30 PM", "19:00" → "7 PM";
 * other languages use the 24-hour clock ("19:30", "07:00"). Empty string when there is no time.
 */
export const formatTime12 = (time?: string | null): string => {
  if (!time) return '';
  const m = String(time).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(time);
  if (getLocale() !== 'en') return formatTime24(time);
  let h = parseInt(m[1], 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return m[2] !== '00' ? `${h}:${m[2]} ${ampm}` : `${h} ${ampm}`;
};

const validDate = (dateStr?: string | null): Date | null => {
  if (!dateStr) return null;
  const d = parseLocalDate(String(dateStr).slice(0, 10));
  return isNaN(d.getTime()) ? null : d;
};

/** "2026-12-19" → "Sat 19 Dec" (Figma RSVP / conflict copy). */
export const formatDayShort = (dateStr?: string | null): string => {
  const d = validDate(dateStr);
  if (!d) return '';
  const weekday = dateName(d, { weekday: 'short' });
  const month = dateName(d, { month: 'short' });
  return `${weekday} ${d.getDate()} ${month}`;
};

/** "2026-12-19" → "SATURDAY". */
export const weekdayLong = (dateStr?: string | null): string => {
  const d = validDate(dateStr);
  return d ? d.toLocaleDateString(intlLocale('en-US'), { weekday: 'long' }).toUpperCase() : '';
};

/** The calendar day before `dateStr`, as YYYY-MM-DD ('' when unknown). */
export const dayBefore = (dateStr?: string | null): string => {
  const d = validDate(dateStr);
  if (!d) return '';
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** "Mar 3" for an ISO timestamp ('' when missing or invalid). */
export const formatStampShort = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(intlLocale('en-US'), { month: 'short', day: 'numeric' });
};

/** "€1,250" / "1250" / 1250 → 1250 (0 when not a number). */
export const parseAmount = (value?: string | number | null): number => {
  if (value === undefined || value === null || value === '') return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Length between two "HH:MM" times in hours (crossing midnight counts as the
 * next day). null when either time is missing.
 */
export const durationHours = (start?: string | null, end?: string | null): number | null => {
  const s = start?.match(/^(\d{1,2}):(\d{2})/);
  const e = end?.match(/^(\d{1,2}):(\d{2})/);
  if (!s || !e) return null;
  const a = parseInt(s[1], 10) * 60 + parseInt(s[2], 10);
  let b = parseInt(e[1], 10) * 60 + parseInt(e[2], 10);
  if (b <= a) b += 24 * 60;
  return Math.round(((b - a) / 60) * 10) / 10;
};

/** "3" / "2.5" — hours without a trailing ".0". */
export const formatHours = (h: number): string => (Number.isInteger(h) ? String(h) : h.toFixed(1));

/** Whole days from today until `dateStr` (negative once past). null when unknown. */
export const daysUntil = (dateStr?: string | null, now: Date = new Date()): number | null => {
  const d = validDate(dateStr);
  if (!d) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
};

/** Short room/venue label: the part before the first comma. */
export const shortPlace = (place?: string | null): string => (place || '').split(',')[0].trim();

type RecurrenceRule = { freq?: string; frequency?: string; interval?: number } | undefined | null;

/**
 * Hero chip for a rehearsal's cadence: "EVERY TUESDAY" for weekly rules,
 * "EVERY OTHER TUESDAY" for fortnightly, "MONTHLY"… otherwise, "ONCE" when
 * it does not repeat.
 */
export const rehearsalCadence = (isRecurring: boolean | undefined, rule: RecurrenceRule, dateStr?: string): string => {
  if (!isRecurring) return 'ONCE';
  const freq = (rule?.freq || rule?.frequency || '').toLowerCase();
  const interval = rule?.interval || 1;
  const day = weekdayLong(dateStr);
  if (freq === 'weekly' && interval === 1) return day ? `EVERY ${day}` : 'WEEKLY';
  if (freq === 'weekly' && interval === 2) return day ? `EVERY OTHER ${day}` : 'BI-WEEKLY';
  if (freq === 'monthly' && interval === 1) return 'MONTHLY';
  if (freq === 'monthly' && interval === 2) return 'BI-MONTHLY';
  if (freq) return freq.toUpperCase();
  return 'ONCE';
};
