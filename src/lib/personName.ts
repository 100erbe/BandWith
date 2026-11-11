/**
 * How BandWith names a person, everywhere: their name, or their email address
 * when they have no name. Never the part of the address before the @.
 *
 * Older accounts (and sign-ups without a name, before migration 066) stored
 * that part of the address as `full_name`, so a "name" equal to it, or to
 * the whole address, does not count as a name. Same rule as the emails
 * (supabase/functions/send-email).
 */

type Named = {
  full_name?: string | null;
  email?: string | null;
} | null | undefined;

/** The person's real name, or '' when there is none. */
export function realName(name: string | null | undefined, email?: string | null): string {
  const n = (name ?? '').trim();
  if (!n) return '';
  const address = (email ?? '').trim().toLowerCase();
  const local = address.split('@')[0];
  const lower = n.toLowerCase();
  if (address && (lower === address || lower === local)) return '';
  return n;
}

/** Name, else email address, else `fallback`. */
export function personName(person: Named, fallback = 'Member'): string {
  return realName(person?.full_name, person?.email) || (person?.email ?? '').trim() || fallback;
}

/** First name for short labels ("Alex"), else the email address, else `fallback`. */
export function personFirstName(person: Named, fallback = 'Member'): string {
  const name = realName(person?.full_name, person?.email);
  return (name ? name.split(/\s+/)[0] : '') || (person?.email ?? '').trim() || fallback;
}

/** Two-letter initials from the name, else from the email address. */
export function personInitials(person: Named, fallback = '?'): string {
  const name = realName(person?.full_name, person?.email);
  if (name) {
    return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  }
  const email = (person?.email ?? '').trim();
  return email ? email.slice(0, 2).toUpperCase() : fallback;
}

/** True when the person has a real name (used to ask for one in the profile). */
export function hasRealName(person: Named): boolean {
  return realName(person?.full_name, person?.email) !== '';
}
