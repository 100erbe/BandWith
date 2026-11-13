// /deputy.html — reply page for a deputy without the app (migration 084).
// The link carries a 64-character token; bw_deputy_request_view returns
// only what the deputy may see, bw_deputy_request_reply records the answer
// (Available / Not sure yet / Can't) and pushes the band's admins. Once
// available: address, map and calendar (one-off .ics, Google Calendar,
// or a subscription that follows changes). If the band changes the gig
// after the answer, the page shows what changed and asks "Still OK?".

import { googleCalendarUrl } from './lib/deputyCalendar';
import { addressWithoutCity } from './lib/eventAddress';
import { DEPUTY_STRINGS, fill, pickDeputyLang, type DeputyStrings } from './deputy/strings';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const APP_URL = 'https://bandwith.pages.dev/';

type Answer = 'available' | 'maybe' | 'unavailable';
type ChangeKey = 'date' | 'load_in' | 'soundcheck' | 'start' | 'end' | 'venue' | 'city' | 'address';

interface View {
  status: 'pending' | Answer | 'cancelled';
  deputy_name: string;
  role: string | null;
  fee: number | null;
  currency: string | null;
  reply_note: string | null;
  band_name: string;
  event_title: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  load_in_time: string | null;
  soundcheck_time: string | null;
  venue_name: string | null;
  venue_city: string | null;
  venue_address: string | null;
  event_cancelled: boolean;
  event_updated_at: string | null;
  changes: ChangeKey[];
  before: Partial<Record<ChangeKey, string | null>>;
  closed: boolean;
}

const params = new URL(window.location.href).searchParams;
const token = (params.get('t') ?? '').toLowerCase();
const lang = pickDeputyLang([params.get('l') ?? '', ...(navigator.languages ?? []), navigator.language ?? '']);
const S: DeputyStrings = DEPUTY_STRINGS[lang];
document.documentElement.lang = lang;

const app = document.getElementById('app') as HTMLElement;

// ---------------------------------------------------------------- DOM

type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | ((e: Event) => void)> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false) el.setAttribute(k, v);
  }
  for (const c of children) if (c) el.append(c);
  return el;
}
const arrow = () => h('span', { class: 'arrow', 'aria-hidden': 'true' }, '↗');

// ---------------------------------------------------------------- formatting

const hhmm = (v?: string | null) => (v ? v.slice(0, 5) : '');
const longDate = (v?: string | null) => {
  if (!v) return '';
  const [y, m, d] = v.split('-').map(Number);
  return new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(y, m - 1, d),
  );
};
const money = (n: number | null, cur: string | null) => {
  if (n == null) return '';
  try {
    return new Intl.NumberFormat(lang, { style: 'currency', currency: cur || 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  } catch {
    return `${n} ${cur ?? ''}`.trim();
  }
};
const vars = (v: View) => ({ band: v.band_name, name: v.deputy_name.split(' ')[0] || v.deputy_name });

// ---------------------------------------------------------------- data

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    // Publishable keys go on `apikey` only: they are not JWTs.
    headers: { 'Content-Type': 'application/json', apikey: PUBLISHABLE_KEY as string },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}

let view: View | null = null;
let busy = false;
let failed = false;

async function answer(a: Answer) {
  if (busy || !view) return;
  // Read the note before re-rendering replaces the field.
  const note = (document.getElementById('note') as HTMLTextAreaElement | null)?.value ?? view.reply_note ?? '';
  busy = true;
  failed = false;
  render();
  try {
    const next = await rpc<View | null>('bw_deputy_request_reply', { p_token: token, p_answer: a, p_note: note || null });
    view = next ?? view;
  } catch {
    failed = true;
  }
  busy = false;
  render();
  app.querySelector<HTMLElement>('[data-focus]')?.focus();
}

// ---------------------------------------------------------------- views

function simpleCard(kicker: string, title: string, body: string, ink = true) {
  return h('section', { class: `card ${ink ? 'ink' : 'lime'}` }, h('div', { class: 'kicker' }, kicker), h('h1', {}, title), h('p', {}, body));
}

function feedUrl(one: boolean) {
  return `${SUPABASE_URL}/functions/v1/deputy-calendar?t=${token}&l=${lang}${one ? '&one=1' : ''}`;
}

function detailRows(v: View) {
  const rows: [string, string, ChangeKey | null][] = [];
  rows.push([S.date, longDate(v.event_date), 'date']);
  if (v.load_in_time) rows.push([S.loadIn, hhmm(v.load_in_time), 'load_in']);
  if (v.soundcheck_time) rows.push([S.soundcheck, hhmm(v.soundcheck_time), 'soundcheck']);
  if (v.start_time) rows.push([S.show, `${hhmm(v.start_time)}${v.end_time ? `–${hhmm(v.end_time)}` : ''}`, 'start']);
  if (v.venue_name) rows.push([S.venue, v.venue_name, 'venue']);
  if (v.venue_city) rows.push([S.city, v.venue_city, 'city']);
  if (v.venue_address) rows.push([S.address, v.venue_address, 'address']);
  if (v.role) rows.push([S.role, v.role, null]);
  if (v.fee != null) rows.push([S.fee, money(v.fee, v.currency), null]);
  return rows;
}

function gigCard(v: View) {
  const dl = h('dl');
  for (const [label, value, key] of detailRows(v)) {
    const changed = key && v.changes.includes(key) || (key === 'start' && v.changes.includes('end'));
    dl.append(h('dt', {}, label), h('dd', {}, changed ? h('strong', {}, value) : value));
  }
  const place = [v.venue_name, v.venue_address, v.venue_city].filter(Boolean).join(', ');
  return h(
    'section',
    { class: 'card lime' },
    h('div', { class: 'kicker' }, `BandWith · ${S.kicker}`),
    h('h1', {}, v.event_title || v.band_name),
    h('p', {}, `${fill(S.hello, vars(v))} ${fill(S.asks, vars(v))}`),
    h('div', { style: 'margin-top:22px' }, dl),
    v.status === 'available' && place
      ? h(
          'a',
          { class: 'row-link', href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`, target: '_blank', rel: 'noopener' },
          `${S.openMap} ↗`,
        )
      : null,
  );
}

function changesCard(v: View) {
  const dl = h('dl');
  const label: Record<ChangeKey, string> = {
    date: S.date, load_in: S.loadIn, soundcheck: S.soundcheck, start: S.show, end: S.show, venue: S.venue, city: S.city, address: S.address,
  };
  const now: Record<ChangeKey, string> = {
    date: longDate(v.event_date), load_in: hhmm(v.load_in_time), soundcheck: hhmm(v.soundcheck_time), start: hhmm(v.start_time),
    end: hhmm(v.end_time), venue: v.venue_name ?? '', city: v.venue_city ?? '', address: v.venue_address ?? '',
  };
  for (const k of v.changes) {
    const was = v.before[k];
    const old = k === 'date' ? longDate(was) : ['venue', 'city', 'address'].includes(k) ? was ?? '' : hhmm(was);
    dl.append(
      h('dt', {}, k === 'end' ? `${label[k]} →` : label[k]),
      h('dd', {}, old ? h('s', {}, old) : null, now[k] || S.removed),
    );
  }
  const same = v.status as Answer;
  return h(
    'section',
    { class: 'card ink', role: 'status' },
    h('div', { class: 'kicker' }, S.changedTitle),
    h('p', { style: 'margin:10px 0 16px' }, fill(S.changedBody, vars(v))),
    dl,
    h(
      'div',
      { class: 'stack' },
      h('button', { class: 'btn lime', type: 'button', disabled: busy, onclick: () => answer(same) }, S.stillOk, arrow()),
      h('button', { class: 'btn light', type: 'button', disabled: busy, onclick: () => answer('unavailable') }, S.cantNow, arrow()),
    ),
  );
}

function noteField(v: View) {
  return h(
    'label',
    { class: 'field' },
    h('span', { class: 'kicker' }, S.note),
    h('textarea', { id: 'note', maxlength: '500', placeholder: S.notePlaceholder }, v.reply_note ?? ''),
  );
}

function answerButtons(options: Answer[], primary: Answer | null) {
  const text: Record<Answer, string> = { available: S.yes, maybe: S.maybe, unavailable: S.no };
  return h(
    'div',
    { class: 'stack' },
    ...options.map((a) =>
      h('button', { class: `btn ${a === primary ? '' : 'light'}`, type: 'button', disabled: busy, onclick: () => answer(a) }, text[a], arrow()),
    ),
  );
}

function answerCard(v: View) {
  const card = h('section', { class: 'card' });
  if (v.status === 'pending') {
    card.append(h('h2', { 'data-focus': true, tabindex: '-1' }, S.question), noteField(v), answerButtons(['available', 'maybe', 'unavailable'], 'available'));
    return card;
  }
  const title = v.status === 'available' ? S.yesTitle : v.status === 'maybe' ? S.maybeTitle : S.noTitle;
  const body = v.status === 'available' ? S.yesBody : v.status === 'maybe' ? S.maybeBody : S.noBody;
  card.append(h('h2', { 'data-focus': true, tabindex: '-1' }, title), h('p', {}, fill(body, vars(v))));
  if (v.reply_note) card.append(h('p', { class: 'mute' }, `“${v.reply_note}”`));
  const others = (['available', 'maybe', 'unavailable'] as Answer[]).filter((a) => a !== v.status);
  if (v.status === 'maybe') {
    card.append(noteField(v), answerButtons(['available', 'unavailable'], 'available'));
  } else {
    card.append(h('details', {}, h('summary', {}, S.change), noteField(v), answerButtons(others, null)));
  }
  return card;
}

function calendarCard(v: View) {
  const sub = feedUrl(false);
  const webcal = sub.replace(/^https?:/, 'webcal:');
  const gig = {
    title: v.event_title || 'Gig', bandName: v.band_name, date: v.event_date as string, loadIn: v.load_in_time,
    soundcheck: v.soundcheck_time, start: v.start_time, end: v.end_time, venue: v.venue_name, city: v.venue_city,
    address: v.venue_address, role: v.role, url: window.location.href,
  };
  return h(
    'section',
    { class: 'card' },
    h('h2', {}, S.calTitle),
    h(
      'div',
      { class: 'stack' },
      h('a', { class: 'btn', href: feedUrl(true) }, S.calApple, arrow()),
      h('a', { class: 'btn light', href: googleCalendarUrl(gig, { loadIn: S.loadIn, soundcheck: S.soundcheck, show: S.show, role: S.role }), target: '_blank', rel: 'noopener' }, S.calGoogle, arrow()),
      h('a', { class: 'btn lime', href: webcal }, S.calSubscribe, arrow()),
    ),
    h(
      'p',
      { class: 'mute', style: 'font-size:14px;line-height:20px' },
      fill(S.calSubscribeNote, vars(v)),
      ' ',
      h('a', { href: `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`, target: '_blank', rel: 'noopener', style: 'color:inherit' }, S.calSubscribeGoogle),
    ),
  );
}

function appCard(v: View) {
  return h(
    'section',
    { class: 'card ink' },
    h('h2', {}, fill(S.appTitle, vars(v))),
    h('p', {}, fill(S.appBody, vars(v))),
    // The app links this account to the band's deputy entry (bw_deputy_claim, 086).
    h('div', { class: 'stack' }, h('a', { class: 'btn lime', href: `${APP_URL}?deputy=${token}`, target: '_blank', rel: 'noopener' }, S.appCta, arrow())),
  );
}

function render() {
  app.replaceChildren();
  if (!view) {
    app.append(simpleCard('BandWith', S.invalidTitle, S.invalidBody));
    return;
  }
  // Older saves repeated the city in the address: show the street once.
  const street = addressWithoutCity(view.venue_address, view.venue_city);
  const v: View = { ...view, venue_address: street && street.toLocaleLowerCase() !== (view.venue_city ?? '').toLocaleLowerCase() ? street : null };
  if (v.closed) {
    const [t, b] = v.event_cancelled ? [S.cancelledTitle, S.cancelledBody] : v.status === 'cancelled' ? [S.closedTitle, S.closedBody] : [S.pastTitle, S.pastBody];
    app.append(simpleCard(`BandWith · ${v.band_name}`, t, fill(b, vars(v))));
    return;
  }
  if (v.changes.length && (v.status === 'available' || v.status === 'maybe')) app.append(changesCard(v));
  app.append(gigCard(v), answerCard(v));
  if (v.status === 'available' && v.event_date) app.append(calendarCard(v));
  if (failed) app.append(h('p', { class: 'note', role: 'alert' }, S.error));
  app.append(appCard(v));
}

async function load() {
  if (!/^[0-9a-f]{64}$/.test(token) || !SUPABASE_URL || !PUBLISHABLE_KEY) {
    render();
    return;
  }
  app.replaceChildren(simpleCard('BandWith', S.loading, '', false));
  try {
    view = await rpc<View | null>('bw_deputy_request_view', { p_token: token });
  } catch {
    view = null;
  }
  document.title = view ? `${view.event_title || S.kicker} · ${view.band_name}` : `${S.kicker} · BandWith`;
  render();
}

void load();
