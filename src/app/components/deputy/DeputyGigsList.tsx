import React from 'react';
import { CalendarPlus, MapPin, Loader2 } from '@/app/components/icons';
import { PillButton } from '@/app/components/bw/Form';
import { cn } from '@/app/components/ui/utils';
import { dateName, getLocale, intlLocale, useT } from '@/lib/i18n';
import { parseLocalDate } from '@/lib/dates';
import { addressWithoutCity } from '@/lib/eventAddress';
import { GIG_LABELS, googleCalendarUrl } from '@/lib/deputyCalendar';
import { openExternal } from '@/lib/nativeFiles';
import {
  answerDeputyGig,
  type DeputyAnswer,
  type DeputyChangeKey,
  type DeputyGig,
} from '@/lib/services/deputies';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

const hhmm = (v?: string | null) => (v ? v.slice(0, 5) : '');

/** "Friday 14 November" in the app language. */
export function deputyGigDate(v?: string | null, long = true): string {
  if (!v) return '';
  const d = parseLocalDate(v);
  if (Number.isNaN(d.getTime())) return v;
  return dateName(d, long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' });
}

const money = (n: number, currency?: string | null) => {
  try {
    return new Intl.NumberFormat(intlLocale('en-GB'), { style: 'currency', currency: currency || 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch {
    return `${n} ${currency || ''}`.trim();
  }
};

/** The deputy's calendar file / subscription for this request (edge function deputy-calendar, 084). */
const feedUrl = (token: string, one: boolean) =>
  SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/deputy-calendar?t=${token}&l=${getLocale()}${one ? '&one=1' : ''}` : null;

type Tone = 'yes' | 'wait' | 'no' | 'off';
const TONE_COLOR: Record<Tone, string> = {
  yes: 'var(--success)',
  wait: 'var(--warning)',
  no: 'var(--destructive-solid)',
  off: 'currentColor',
};

/**
 * One deputy request, as the deputy sees it in the app: the gig (their own
 * fee and logistics only; the address after a yes), the three answers with
 * a note, "Still OK?" when the gig changed after their answer, and address,
 * map and calendar once they said yes. Same data and RPC as /deputy.html.
 */
export const DeputyGigCard: React.FC<{
  gig: DeputyGig;
  onChanged: (gig: DeputyGig) => void;
  highlight?: boolean;
}> = ({ gig, onChanged, highlight = false }) => {
  const t = useT();
  const [editing, setEditing] = React.useState(false);
  const [note, setNote] = React.useState(gig.reply_note ?? '');
  const [busy, setBusy] = React.useState<DeputyAnswer | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const noteId = `deputy-note-${gig.id}`;
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlight]);

  const answered = gig.status === 'available' || gig.status === 'maybe' || gig.status === 'unavailable';
  const changed = (gig.status === 'available' || gig.status === 'maybe') && gig.changes.length > 0;
  const showAnswers = !gig.closed && (!answered || editing);

  const reply = async (a: DeputyAnswer, keepNote = true) => {
    if (busy) return;
    setBusy(a);
    setError(null);
    const { data, error: e } = await answerDeputyGig(gig.token, a, keepNote ? note : gig.reply_note);
    setBusy(null);
    if (e || !data) {
      setError(t('Something went wrong. Please try again in a moment.'));
      return;
    }
    setEditing(false);
    onChanged({ ...gig, ...data, id: gig.id, token: gig.token });
  };

  const status: { label: string; tone: Tone } = gig.event_cancelled
    ? { label: t('Gig cancelled'), tone: 'off' }
    : gig.status === 'cancelled'
      ? { label: t('Request withdrawn'), tone: 'off' }
      : gig.closed
        ? { label: t('Gig over'), tone: 'off' }
        : gig.status === 'available'
          ? { label: t('You said yes'), tone: 'yes' }
          : gig.status === 'maybe'
            ? { label: t("You'll confirm later"), tone: 'wait' }
            : gig.status === 'unavailable'
              ? { label: t("You said you can't"), tone: 'no' }
              : { label: t('Waiting for your answer'), tone: 'wait' };

  // Older saves repeated the city in the address: show the street once.
  const street = addressWithoutCity(gig.venue_address, gig.venue_city) || null;
  const address = street && street.toLocaleLowerCase() !== (gig.venue_city ?? '').toLocaleLowerCase() ? street : null;

  const label: Record<DeputyChangeKey, string> = {
    date: t('Date'),
    load_in: t('Load-in'),
    soundcheck: t('Soundcheck'),
    start: t('Show'),
    end: t('Show'),
    venue: t('Venue'),
    city: t('City'),
    address: t('Address'),
  };
  const nowValue: Record<DeputyChangeKey, string> = {
    date: deputyGigDate(gig.event_date),
    load_in: hhmm(gig.load_in_time),
    soundcheck: hhmm(gig.soundcheck_time),
    start: hhmm(gig.start_time),
    end: hhmm(gig.end_time),
    venue: gig.venue_name ?? '',
    city: gig.venue_city ?? '',
    address: gig.venue_address ?? '',
  };
  const beforeValue = (k: DeputyChangeKey) => {
    const was = gig.before?.[k];
    if (!was) return '';
    return k === 'date' ? deputyGigDate(was) : ['venue', 'city', 'address'].includes(k) ? was : hhmm(was);
  };

  const rows: [string, string, DeputyChangeKey | null][] = [];
  if (gig.event_date) rows.push([t('Date'), deputyGigDate(gig.event_date), 'date']);
  if (gig.load_in_time) rows.push([t('Load-in'), hhmm(gig.load_in_time), 'load_in']);
  if (gig.soundcheck_time) rows.push([t('Soundcheck'), hhmm(gig.soundcheck_time), 'soundcheck']);
  if (gig.start_time) rows.push([t('Show'), `${hhmm(gig.start_time)}${gig.end_time ? `–${hhmm(gig.end_time)}` : ''}`, 'start']);
  if (gig.venue_name) rows.push([t('Venue'), gig.venue_name, 'venue']);
  if (gig.venue_city) rows.push([t('City'), gig.venue_city, 'city']);
  if (address) rows.push([t('Address'), address, 'address']);
  if (gig.role) rows.push([t('Role'), gig.role, null]);
  if (gig.fee != null) rows.push([t('Fee offered'), money(gig.fee, gig.currency), null]);

  const place = [gig.venue_name, address, gig.venue_city].filter(Boolean).join(', ');
  const confirmed = gig.status === 'available' && !gig.closed;
  const calendarGig = gig.event_date
    ? {
        title: gig.event_title || t('Gig'),
        bandName: gig.band_name,
        date: gig.event_date,
        loadIn: gig.load_in_time,
        soundcheck: gig.soundcheck_time,
        start: gig.start_time,
        end: gig.end_time,
        venue: gig.venue_name,
        city: gig.venue_city,
        address,
        role: gig.role,
      }
    : null;
  const oneOff = feedUrl(gig.token, true);
  const subscription = feedUrl(gig.token, false);

  return (
    <article
      ref={ref}
      aria-label={`${gig.event_title || t('Gig')} · ${gig.band_name}`}
      className={cn(
        '@container rounded-[24px] p-5 flex flex-col gap-4 min-w-0',
        gig.closed ? 'bg-foreground/[0.05] text-foreground' : 'bg-card text-card-foreground dark:bg-sheet dark:text-sheet-foreground',
        highlight && 'ring-2 ring-accent',
      )}
    >
      {/* A div, not <header>: the Laptop pose pads every header for the clock. */}
      <div className="flex flex-col gap-1 min-w-0">
        <p className="bw-label-sm text-muted-foreground truncate">{gig.band_name}</p>
        <h2 className="bw-h2 [overflow-wrap:anywhere]">{gig.event_title || t('Gig')}</h2>
        <p className="flex items-center gap-2 bw-label-sm" role="status">
          <span aria-hidden="true" className="w-2 h-2 rounded-full shrink-0" style={{ background: TONE_COLOR[status.tone], opacity: status.tone === 'off' ? 0.4 : 1 }} />
          {status.label}
        </p>
      </div>

      {changed && !gig.closed && (
        <section className="rounded-[16px] bg-surface-inverse text-surface-inverse-foreground p-4 flex flex-col gap-3" aria-label={t('Something changed')}>
          <p className="bw-label-md">{t('Something changed')}</p>
          <p className="bw-body-sm opacity-80">{t('Since your answer, {band} changed:', { band: gig.band_name })}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 bw-body-sm">
            {gig.changes.map((k) => (
              <React.Fragment key={k}>
                <dt className="opacity-70">{k === 'end' ? `${label[k]} →` : label[k]}</dt>
                <dd className="min-w-0 [overflow-wrap:anywhere]">
                  {beforeValue(k) && <s className="opacity-60 mr-2">{beforeValue(k)}</s>}
                  <strong>{nowValue[k] || t('removed')}</strong>
                </dd>
              </React.Fragment>
            ))}
          </dl>
          <div className="flex flex-wrap gap-2">
            <PillButton size="sm" variant="primary" fullWidth={false} loading={busy === gig.status} disabled={!!busy} onClick={() => void reply(gig.status as DeputyAnswer, false)}>
              {t('Still OK')}
            </PillButton>
            <PillButton size="sm" variant="white" fullWidth={false} loading={busy === 'unavailable'} disabled={!!busy} onClick={() => void reply('unavailable', false)}>
              {t("I can't anymore")}
            </PillButton>
          </div>
        </section>
      )}

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 bw-body-sm">
        {rows.map(([k, v, key]) => {
          const isChanged = !!key && (gig.changes.includes(key) || (key === 'start' && gig.changes.includes('end')));
          return (
            <React.Fragment key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className={cn('min-w-0 [overflow-wrap:anywhere]', isChanged && !gig.closed && 'font-semibold')}>{v}</dd>
            </React.Fragment>
          );
        })}
      </dl>

      {gig.reply_note && !showAnswers && <p className="bw-body-sm text-muted-foreground">“{gig.reply_note}”</p>}

      {error && (
        <p role="alert" className="bw-body-sm text-destructive">
          {error}
        </p>
      )}

      {showAnswers ? (
        <div className="flex flex-col gap-3">
          <p className="bw-label-md">{t('Can you make it?')}</p>
          <label htmlFor={noteId} className="flex flex-col gap-1.5">
            <span className="bw-label-sm text-muted-foreground">{t('Message to the band (optional)')}</span>
            <textarea
              id={noteId}
              value={note}
              maxLength={500}
              rows={2}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('e.g. I can bring my own amp')}
              className="w-full rounded-[16px] bg-foreground/[0.06] px-4 py-3 bw-body-md text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <div className="grid grid-cols-1 @min-[520px]:grid-cols-3 gap-2">
            <PillButton size="md" variant="primary" loading={busy === 'available'} disabled={!!busy} onClick={() => void reply('available')}>
              {t('Yes')}
            </PillButton>
            <PillButton size="md" variant="outline" loading={busy === 'maybe'} disabled={!!busy} onClick={() => void reply('maybe')}>
              {t('Not sure yet')}
            </PillButton>
            <PillButton size="md" variant="outline" loading={busy === 'unavailable'} disabled={!!busy} onClick={() => void reply('unavailable')}>
              {t("No, I can't")}
            </PillButton>
          </div>
          {editing && (
            <button type="button" className="bw-label-sm underline underline-offset-2 min-h-[32px] self-start" onClick={() => setEditing(false)}>
              {t('Cancel')}
            </button>
          )}
        </div>
      ) : (
        !gig.closed && (
          <button
            type="button"
            className="bw-label-sm underline underline-offset-2 min-h-[32px] self-start"
            onClick={() => {
              setNote(gig.reply_note ?? '');
              setEditing(true);
            }}
          >
            {t('Change your answer')}
          </button>
        )
      )}

      {confirmed && (
        <div className="flex flex-wrap gap-2">
          {place && (
            <PillButton
              size="sm"
              variant="outline"
              fullWidth={false}
              icon={<MapPin className="w-4 h-4" />}
              onClick={() => void openExternal(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`)}
            >
              {t('Open in Maps')}
            </PillButton>
          )}
          {oneOff && (
            <PillButton size="sm" variant="outline" fullWidth={false} icon={<CalendarPlus className="w-4 h-4" />} onClick={() => void openExternal(oneOff)}>
              {t('Add to calendar')}
            </PillButton>
          )}
          {calendarGig && (
            <PillButton
              size="sm"
              variant="ghost"
              fullWidth={false}
              onClick={() => void openExternal(googleCalendarUrl(calendarGig, GIG_LABELS[getLocale()] ?? GIG_LABELS.en))}
            >
              {t('Google Calendar')}
            </PillButton>
          )}
          {subscription && (
            <PillButton size="sm" variant="ghost" fullWidth={false} onClick={() => void openExternal(subscription.replace(/^https?:/, 'webcal:'))}>
              {t('Subscribe to my gigs')}
            </PillButton>
          )}
        </div>
      )}
    </article>
  );
};

/** Upcoming first (open requests on top), then the closed ones. */
export function sortDeputyGigs(gigs: DeputyGig[]): { open: DeputyGig[]; closed: DeputyGig[] } {
  const open = gigs.filter((g) => !g.closed);
  const closed = gigs.filter((g) => g.closed).reverse();
  return { open, closed };
}

export const DeputyGigsList: React.FC<{
  gigs: DeputyGig[] | null;
  onChanged: (gig: DeputyGig) => void;
  /** Request to scroll to (from a notification). */
  focusId?: string | null;
  error?: boolean;
  onRetry?: () => void;
}> = ({ gigs, onChanged, focusId, error, onRetry }) => {
  const t = useT();
  if (gigs == null) {
    return error ? (
      <div className="flex flex-col gap-3 py-6">
        <p role="alert" className="bw-body-md text-destructive">{t('Could not load your deputy gigs. Try again.')}</p>
        {onRetry && (
          <PillButton size="md" variant="outline" fullWidth={false} onClick={onRetry}>
            {t('Try again')}
          </PillButton>
        )}
      </div>
    ) : (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-label={t('Loading')} />
      </div>
    );
  }
  const { open, closed } = sortDeputyGigs(gigs);
  if (open.length === 0 && closed.length === 0) {
    return <p className="bw-body-md text-muted-foreground py-6">{t('No requests right now. When a band asks you to play, it shows up here and you get a notification.')}</p>;
  }
  return (
    <div className="@container flex flex-col gap-6">
      {open.length > 0 && (
        <ul className="grid grid-cols-1 @min-[640px]:grid-cols-2 gap-3 items-start" aria-label={t('Upcoming')}>
          {open.map((g) => (
            <li key={g.id} className="min-w-0">
              <DeputyGigCard gig={g} onChanged={onChanged} highlight={g.id === focusId} />
            </li>
          ))}
        </ul>
      )}
      {closed.length > 0 && (
        <section className="flex flex-col gap-3" aria-label={t('Past and closed')}>
          <h2 className="bw-label-sm text-muted-foreground">{t('Past and closed')}</h2>
          <ul className="grid grid-cols-1 @min-[640px]:grid-cols-2 gap-3 items-start">
            {closed.map((g) => (
              <li key={g.id} className="min-w-0">
                <DeputyGigCard gig={g} onChanged={onChanged} highlight={g.id === focusId} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
