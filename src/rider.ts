// /rider.html — the venue's read-only technical rider (migration 093).
// The link carries a 64-character token; bw_rider_view returns only the
// rider, the gig's times and venue, and the stage (plot, input list, who
// brings what) — never the client or the fee. Opening it marks the rider
// as seen for the band.

import { asStageData, channelLabel, stageSize, type StageData, type StagePlot } from './lib/stagePlot';
import { RIDER_STRINGS, fill, pickRiderLang, type RiderStrings } from './rider/strings';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

interface View {
  title: string;
  version: number | null;
  notes: string | null;
  band_name: string;
  event_title: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  load_in_time: string | null;
  soundcheck_time: string | null;
  venue_name: string | null;
  venue_city: string | null;
  stage: Record<string, unknown> | null;
}

const params = new URL(window.location.href).searchParams;
const token = (params.get('t') ?? '').toLowerCase();
const lang = pickRiderLang([params.get('l') ?? '', ...(navigator.languages ?? []), navigator.language ?? '']);
const S: RiderStrings = RIDER_STRINGS[lang];
document.documentElement.lang = lang;

const app = document.getElementById('app') as HTMLElement;

type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | ((e: Event) => void)> = {}, ...children: Child[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v);
    else el.setAttribute(k, v);
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

const hhmm = (v?: string | null) => (v ? v.slice(0, 5) : '');
const longDate = (v?: string | null) => {
  if (!v) return '';
  const [y, m, d] = v.slice(0, 10).split('-').map(Number);
  return new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(y, m - 1, d));
};

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

function simpleCard(kicker: string, title: string, body: string) {
  return h('section', { class: 'card lime' }, h('div', { class: 'kicker' }, kicker), h('h2', { style: 'margin-top:12px' }, title), body ? h('p', {}, body) : null);
}

function headerCard(v: View) {
  const tiles: [string, string][] = [
    [S.version, `v${v.version ?? 1}`],
    [S.date, v.event_date ? longDate(v.event_date) : '—'],
    [S.venue, [v.venue_name, v.venue_city].filter(Boolean).join(' · ') || '—'],
  ];
  const times: [string, string][] = (
    [
      [S.loadIn, hhmm(v.load_in_time)],
      [S.soundcheck, hhmm(v.soundcheck_time)],
      [S.show, [hhmm(v.start_time), hhmm(v.end_time)].filter(Boolean).join('–')],
    ] as [string, string][]
  ).filter(([, x]) => !!x);
  return h(
    'section',
    { class: 'card ink' },
    h('div', { class: 'kicker' }, `${S.kicker} · ${fill(S.from, { band: v.band_name })}`),
    h('h1', {}, v.event_title || v.title),
    h('div', { class: 'tiles' }, ...tiles.map(([k, x]) => h('div', { class: 'tile' }, h('div', { class: 'kicker mute' }, k), h('b', {}, x)))),
    times.length ? h('dl', { style: 'margin-top:20px' }, ...times.flatMap(([k, x]) => [h('dt', {}, k), h('dd', {}, x)])) : null,
  );
}

function plotEl(plot: StagePlot) {
  const ratio = plot.widthM && plot.depthM ? Math.min(2.1, Math.max(1.3, plot.widthM / plot.depthM)) : 1.6;
  const box = h('div', { class: 'stage', role: 'img', 'aria-label': `${S.stagePlot}: ${plot.name}`, style: `aspect-ratio:${ratio}` });
  for (const it of plot.items) {
    const pos = `left:${it.x * 100}%;top:${it.y * 100}%`;
    if (it.kind === 'player') {
      box.append(
        h('div', { class: 'mark', style: pos }, h('div', { class: `p${it.lead ? ' lead' : ''}` }, it.code ?? ''), it.label ? h('span', { class: 'cap' }, it.label) : null),
      );
    } else {
      box.append(h('div', { class: `mark ${it.kind === 'wedge' ? 'w' : it.kind === 'speaker' ? 'sp' : 'di'}`, style: pos, 'aria-hidden': 'true' }, it.kind === 'di' ? 'DI' : ''));
    }
  }
  const size = stageSize(plot);
  return h(
    'div',
    {},
    h('div', { class: 'kicker', style: 'margin-top:18px' }, plot.name),
    box,
    h('div', { class: 'kicker mute aud' }, [S.audience, size ? fill(S.stage, { size }) : ''].filter(Boolean).join(' · ')),
  );
}

function stageCards(st: StageData): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (st.plots.length) {
    out.push(h('section', { class: 'card' }, h('h2', {}, S.stagePlot), ...st.plots.map(plotEl)));
  }
  if (st.inputs.length) {
    out.push(
      h(
        'section',
        { class: 'card' },
        h('div', { class: 'head' }, h('h2', {}, S.inputList), h('span', { class: 'kicker mute' }, [fill(S.channels, { count: String(st.inputs.length) }), st.mixer].filter(Boolean).join(' · '))),
        h(
          'table',
          {},
          h('thead', {}, h('tr', {}, h('th', {}, S.ch), h('th', {}, S.source), h('th', {}, S.mic), h('th', { style: 'text-align:right' }, S.who))),
          h(
            'tbody',
            {},
            ...st.inputs.map((c, i) =>
              h('tr', {}, h('td', { class: 'mono' }, channelLabel(i)), h('td', {}, c.source), h('td', { class: 'mono' }, c.mic), h('td', { class: 'who' }, c.who)),
            ),
          ),
        ),
      ),
    );
  }
  if (st.bandBrings.length || st.venueProvides.length) {
    const list = (title: string, items: string[], ink: boolean) =>
      h('section', { class: `card${ink ? ' ink' : ''}` }, h('div', { class: 'kicker mute' }, title), h('ul', { class: 'check' }, ...items.map((x) => h('li', {}, x))));
    out.push(
      h('div', { class: 'head', style: 'padding:12px 8px 0' }, h('h2', {}, S.whoBrings), st.venueAgreed ? h('span', { class: 'tag' }, S.venueAgreed) : null),
      h('div', { class: 'cols' }, list(S.bandBrings, st.bandBrings, true), list(S.venueProvides, st.venueProvides, false)),
    );
  }
  return out;
}

function render(v: View | null) {
  app.replaceChildren();
  if (!v) {
    app.append(simpleCard('BandWith', S.invalidTitle, S.invalidBody));
    return;
  }
  const st = asStageData(v.stage as any);
  app.append(headerCard(v));
  const cards = stageCards(st);
  if (cards.length) app.append(...cards);
  else app.append(h('section', { class: 'card' }, h('p', { class: 'mute', style: 'margin:0' }, S.empty)));
  if (v.notes?.trim()) app.append(h('section', { class: 'card' }, h('h2', {}, S.notes), h('p', { class: 'pre' }, v.notes)));
  app.append(
    h('div', { class: 'stack noprint' }, h('button', { class: 'btn light', type: 'button', onclick: () => window.print() }, S.print, h('span', { class: 'arrow', 'aria-hidden': 'true' }, '↓'))),
  );
}

async function load() {
  if (!/^[0-9a-f]{64}$/.test(token) || !SUPABASE_URL || !PUBLISHABLE_KEY) {
    render(null);
    return;
  }
  app.replaceChildren(simpleCard('BandWith', S.loading, ''));
  let view: View | null = null;
  try {
    view = await rpc<View | null>('bw_rider_view', { p_token: token });
  } catch {
    view = null;
  }
  document.title = view ? `${S.kicker} · ${view.event_title || view.title} · ${view.band_name}` : `${S.kicker} · BandWith`;
  render(view);
}

void load();
