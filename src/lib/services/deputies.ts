import { supabase } from '@/lib/supabase';
import { t } from '@/lib/i18n';
import { instrumentKeys } from '@/lib/instruments';

/**
 * Deputies: session musicians the band calls when a member can't play
 * (table band_deputies, migration 069; admins only). They don't need a
 * BandWith account: the request goes out by WhatsApp, SMS or email.
 */
export interface Deputy {
  id: string;
  band_id: string;
  name: string;
  instrument: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  default_fee: number | null;
  created_at?: string;
}

export type DeputyInput = Pick<Deputy, 'name' | 'instrument' | 'phone' | 'email' | 'notes' | 'default_fee'>;

/** True when the table isn't there yet (migration 069 not applied). */
export const deputiesUnavailable = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || (/band_deputies/.test(e.message || '') && /exist|schema cache/i.test(e.message || '')));

const clean = (v: DeputyInput): DeputyInput => ({
  name: v.name.trim().slice(0, 120),
  instrument: v.instrument?.trim().slice(0, 60) || null,
  phone: v.phone?.trim().slice(0, 40) || null,
  email: v.email?.trim().slice(0, 200) || null,
  notes: v.notes?.trim().slice(0, 1000) || null,
  default_fee: v.default_fee != null && Number.isFinite(v.default_fee) && v.default_fee >= 0 ? v.default_fee : null,
});

export async function listDeputies(bandId: string) {
  const { data, error } = await supabase
    .from('band_deputies')
    .select('id, band_id, name, instrument, phone, email, notes, default_fee, created_at')
    .eq('band_id', bandId)
    .order('instrument', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });
  return { data: (data || []) as Deputy[], error };
}

export async function saveDeputy(bandId: string, input: DeputyInput, id?: string) {
  const row = clean(input);
  const q = id
    ? supabase.from('band_deputies').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id)
    : supabase.from('band_deputies').insert({ ...row, band_id: bandId });
  const { error } = await q;
  return { error };
}

export async function deleteDeputy(id: string) {
  const { error } = await supabase.from('band_deputies').delete().eq('id', id);
  return { error };
}

/** Same instrument first ("Bass" matches "Bass · Backing vocals"). */
export function rankDeputies(deputies: Deputy[], role: string | null | undefined): Deputy[] {
  const want = instrumentKeys(role);
  if (want.length === 0) return deputies;
  // 0 plays it as main instrument · 1 plays it too · 2 plays another instrument
  // the member covers · 3 something else · 4 no instrument set.
  const score = (d: Deputy) => {
    const has = instrumentKeys(d.instrument);
    if (has.length === 0) return 4;
    if (has[0] === want[0]) return 0;
    if (has.includes(want[0])) return 1;
    if (has.some((k) => want.includes(k))) return 2;
    return 3;
  };
  return [...deputies].sort((a, b) => score(a) - score(b));
}

/** The request text sent to a deputy. */
export function deputyRequestText(o: {
  deputyName: string;
  bandName: string;
  eventTitle: string;
  dateLabel: string;
  timeLabel?: string | null;
  venue?: string | null;
  role?: string | null;
  fee?: string | null;
}): string {
  const first = o.deputyName.trim().split(/\s+/)[0] || o.deputyName;
  return [
    t("Hi {name}, it's {band}.", { name: first, band: o.bandName }),
    o.role
      ? t('Are you available to play {role} with us at "{event}"?', { role: o.role.toLowerCase(), event: o.eventTitle })
      : t('Are you available to play with us at "{event}"?', { event: o.eventTitle }),
    `📅 ${o.dateLabel}${o.timeLabel ? ` · ${o.timeLabel}` : ''}`,
    o.venue ? `📍 ${o.venue}` : null,
    o.fee ? `💶 ${o.fee}` : null,
    t('Let us know as soon as you can. Thanks!'),
  ]
    .filter(Boolean)
    .join('\n');
}

export const whatsappUrl = (phone: string, text: string) => {
  const digits = phone.replace(/[^\d+]/g, '').replace(/^00/, '+').replace(/^\+/, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
};
export const smsUrl = (phone: string, text: string) =>
  `sms:${phone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(text)}`;
export const emailUrl = (email: string, subject: string, text: string) =>
  `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
