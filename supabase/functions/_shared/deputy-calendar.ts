/**
 * Calendar entries for deputies (no BandWith account): the .ics behind
 * "Add to calendar" on /deputy.html, the Google Calendar link, and the
 * subscription feed served by the deputy-calendar edge function.
 * Plain TypeScript with no imports: the web app (src/lib/deputyCalendar.ts)
 * and Deno share this file. Times are floating (no time zone): the gig
 * happens at local time.
 */

export interface DeputyGig {
  title: string;
  bandName: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM[:SS]; the entry starts at load-in when there is one. */
  loadIn?: string | null;
  soundcheck?: string | null;
  start?: string | null;
  end?: string | null;
  venue?: string | null;
  city?: string | null;
  address?: string | null;
  role?: string | null;
  /** The reply page, so the entry leads back to the details. */
  url?: string | null;
}

export interface GigLabels {
  loadIn: string;
  soundcheck: string;
  show: string;
  role: string;
  /** Title of a gig without a name (the feed). */
  gig?: string;
}

/** For the feed, which has no app translations at hand. */
export const GIG_LABELS: Record<string, GigLabels> = {
  en: { loadIn: 'Load-in', soundcheck: 'Soundcheck', show: 'Show', role: 'Role', gig: 'Gig' },
  it: { loadIn: 'Carico', soundcheck: 'Soundcheck', show: 'Show', role: 'Ruolo', gig: 'Gig' },
  es: { loadIn: 'Montaje', soundcheck: 'Prueba de sonido', show: 'Show', role: 'Rol', gig: 'Concierto' },
  fr: { loadIn: 'Installation', soundcheck: 'Balances', show: 'Concert', role: 'Rôle', gig: 'Concert' },
  de: { loadIn: 'Aufbau', soundcheck: 'Soundcheck', show: 'Show', role: 'Rolle', gig: 'Gig' },
  pt: { loadIn: 'Montagem', soundcheck: 'Passagem de som', show: 'Show', role: 'Função', gig: 'Show' },
};

const hm = (v?: string | null): [number, number] | null => {
  const m = /^(\d{1,2}):(\d{2})/.exec(v || '');
  return m ? [Number(m[1]), Number(m[2])] : null;
};
const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const stamp = (d: Date) => `${ymd(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const nextDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

/** Start and end of the entry; no times means an all-day entry. */
export function gigWindow(g: DeputyGig): { allDay: true; day: Date } | { allDay: false; start: Date; end: Date } {
  const [y, mo, d] = g.date.split('-').map(Number);
  const first = hm(g.loadIn) || hm(g.soundcheck) || hm(g.start);
  if (!first) return { allDay: true, day: new Date(y, mo - 1, d) };
  const start = new Date(y, mo - 1, d, first[0], first[1]);
  const showStart = hm(g.start);
  const endHm = hm(g.end);
  let end: Date;
  if (endHm) {
    end = new Date(y, mo - 1, d, endHm[0], endHm[1]);
    // Past midnight: the show ends the next day.
    if (end <= start) end.setDate(end.getDate() + 1);
  } else {
    const base = showStart ? new Date(y, mo - 1, d, showStart[0], showStart[1]) : start;
    if (base < start) base.setDate(base.getDate() + 1);
    end = new Date(base.getTime() + 3 * 3600 * 1000);
  }
  return { allDay: false, start, end };
}

/** Venue, address and city without repeated parts ("Via Roma 1, Como, Como"). */
const location = (g: DeputyGig) => {
  const seen = new Set<string>();
  return [g.venue, g.address, g.city]
    .flatMap((x) => (x || '').split(','))
    .map((x) => x.trim())
    .filter((x) => x && !seen.has(x.toLocaleLowerCase()) && seen.add(x.toLocaleLowerCase()))
    .join(', ');
};

const details = (g: DeputyGig, l: GigLabels) =>
  [
    g.role ? `${l.role}: ${g.role}` : null,
    g.loadIn ? `${l.loadIn} ${g.loadIn.slice(0, 5)}` : null,
    g.soundcheck ? `${l.soundcheck} ${g.soundcheck.slice(0, 5)}` : null,
    g.start ? `${l.show} ${g.start.slice(0, 5)}${g.end ? `–${g.end.slice(0, 5)}` : ''}` : null,
    g.url || null,
  ]
    .filter(Boolean)
    .join('\n');

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

const bytes = (s: string) => new TextEncoder().encode(s).length;

/** RFC 5545 lines folded at 75 octets. */
const fold = (line: string) => {
  const out: string[] = [];
  let rest = line;
  while (bytes(rest) > 75) {
    let cut = 75;
    while (bytes(rest.slice(0, cut)) > 75) cut -= 1;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join('\r\n');
};

const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * One VEVENT. The UID stays the same for a request, and SEQUENCE grows with
 * the gig's last change, so calendars update the entry instead of adding one.
 */
export function gigEvent(
  g: DeputyGig,
  labels: GigLabels,
  uid: string,
  opts: { now?: Date; updatedAt?: string | null; cancelled?: boolean } = {},
): string[] {
  const w = gigWindow(g);
  const when = w.allDay
    ? [`DTSTART;VALUE=DATE:${ymd(w.day)}`, `DTEND;VALUE=DATE:${ymd(nextDay(w.day))}`]
    : [`DTSTART:${stamp(w.start)}`, `DTEND:${stamp(w.end)}`];
  const changed = opts.updatedAt ? new Date(opts.updatedAt) : null;
  // Minutes since 2026 fit an integer for centuries.
  const sequence = changed && !Number.isNaN(changed.getTime())
    ? Math.max(0, Math.floor((changed.getTime() - Date.UTC(2026, 0, 1)) / 60000))
    : 0;
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@bandwith`,
    `DTSTAMP:${utcStamp(opts.now ?? new Date())}`,
    `SEQUENCE:${sequence}`,
    ...when,
    `SUMMARY:${icsText(`${g.title} · ${g.bandName}`)}`,
    location(g) ? `LOCATION:${icsText(location(g))}` : '',
    `DESCRIPTION:${icsText(details(g, labels))}`,
    g.url ? `URL:${g.url}` : '',
    `STATUS:${opts.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
  ].filter(Boolean);
}

export function calendarFile(events: string[][], name?: string): string {
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//BandWith//Deputy//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      ...(name ? [`X-WR-CALNAME:${icsText(name)}`, 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'] : []),
      ...events.flat(),
      'END:VCALENDAR',
    ]
      .map(fold)
      .join('\r\n') + '\r\n'
  );
}

export function gigIcs(
  g: DeputyGig,
  labels: GigLabels,
  uid: string,
  opts: { now?: Date; updatedAt?: string | null } = {},
): string {
  return calendarFile([gigEvent(g, labels, uid, opts)]);
}

export function googleCalendarUrl(g: DeputyGig, labels: GigLabels): string {
  const w = gigWindow(g);
  const dates = w.allDay ? `${ymd(w.day)}/${ymd(nextDay(w.day))}` : `${stamp(w.start)}/${stamp(w.end)}`;
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${g.title} · ${g.bandName}`,
    dates,
    details: details(g, labels),
    location: location(g),
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
