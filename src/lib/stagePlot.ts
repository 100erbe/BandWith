/**
 * Rider & stage for a gig (migration 092, table event_stage): the stage plot
 * (one or more layouts, "Full band" / "Trio"), the input list, what the band
 * brings and what the venue provides.
 *
 * Pure helpers shared by the app, the rider PDF and the venue's web page
 * (/rider.html). Rows read from the database are sanitised here, so a bad
 * row never breaks a screen.
 */
import { instrumentKeys } from './instruments';

export type PlotItemKind = 'player' | 'wedge' | 'speaker' | 'di';

export interface PlotItem {
  id: string;
  kind: PlotItemKind;
  /** Two-letter code in the circle (players): "DR", "VX". */
  code?: string;
  /** Caption under it: "Drums · riser", "Bass amp". */
  label?: string;
  /** 0 = left, 1 = right, seen from the audience side (stage left on the right). */
  x: number;
  /** 0 = back of the stage, 1 = front (the audience is below). */
  y: number;
  /** Highlighted (lead vocal). */
  lead?: boolean;
}

export interface StagePlot {
  id: string;
  name: string;
  widthM?: number | null;
  depthM?: number | null;
  items: PlotItem[];
}

export type InputKind = 'mic' | 'di';

export interface InputChannel {
  id: string;
  source: string;
  /** Mic model or "DI". */
  mic: string;
  kind: InputKind;
  /** Who plays it (first name). */
  who: string;
}

export interface StageData {
  plots: StagePlot[];
  inputs: InputChannel[];
  mixer: string;
  bandBrings: string[];
  venueProvides: string[];
  venueAgreed: boolean;
}

/** The database row (snake case). */
export interface StageRow {
  plots: unknown;
  inputs: unknown;
  mixer?: string | null;
  band_brings: unknown;
  venue_provides: unknown;
  venue_agreed?: boolean | null;
}

export const LIMITS = { plots: 6, items: 40, inputs: 96, lines: 40, text: 80 } as const;

export const EMPTY_STAGE: StageData = {
  plots: [],
  inputs: [],
  mixer: '',
  bandBrings: [],
  venueProvides: [],
  venueAgreed: false,
};

let seq = 0;
/** Short random id for plots, items and channels. */
export const newId = (): string =>
  `${Date.now().toString(36)}${(seq++ % 1296).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const str = (v: unknown, max: number = LIMITS.text): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num01 = (v: unknown, fallback: number): number => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
};
const metres = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 && n <= 100 ? Math.round(n * 10) / 10 : null;
};
const KINDS: PlotItemKind[] = ['player', 'wedge', 'speaker', 'di'];

const asItem = (v: unknown): PlotItem | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const kind = KINDS.includes(o.kind as PlotItemKind) ? (o.kind as PlotItemKind) : 'player';
  return {
    id: str(o.id, 40) || newId(),
    kind,
    code: str(o.code, 3).toUpperCase() || undefined,
    label: str(o.label, 40) || undefined,
    x: num01(o.x, 0.5),
    y: num01(o.y, 0.5),
    lead: o.lead === true || undefined,
  };
};

const asPlot = (v: unknown): StagePlot | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const items = Array.isArray(o.items) ? o.items.map(asItem).filter((i): i is PlotItem => !!i).slice(0, LIMITS.items) : [];
  return {
    id: str(o.id, 40) || newId(),
    name: str(o.name, 30) || 'Full band',
    widthM: metres(o.width_m ?? o.widthM),
    depthM: metres(o.depth_m ?? o.depthM),
    items,
  };
};

const asInput = (v: unknown): InputChannel | null => {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const source = str(o.source, 40);
  const mic = str(o.mic, 30);
  if (!source && !mic) return null;
  const kind: InputKind = o.kind === 'di' || /^di\b/i.test(mic) ? 'di' : 'mic';
  return { id: str(o.id, 40) || newId(), source, mic, kind, who: str(o.who, 30) };
};

const asLines = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean).slice(0, LIMITS.lines) : [];

/** A row from event_stage (or the rider page's `stage`), sanitised. */
export function asStageData(row: Partial<StageRow> | null | undefined): StageData {
  if (!row) return { ...EMPTY_STAGE };
  return {
    plots: Array.isArray(row.plots) ? row.plots.map(asPlot).filter((p): p is StagePlot => !!p).slice(0, LIMITS.plots) : [],
    inputs: Array.isArray(row.inputs) ? row.inputs.map(asInput).filter((i): i is InputChannel => !!i).slice(0, LIMITS.inputs) : [],
    mixer: str(row.mixer, 60),
    bandBrings: asLines(row.band_brings),
    venueProvides: asLines(row.venue_provides),
    venueAgreed: row.venue_agreed === true,
  };
}

/** What gets written to event_stage. */
export function toStageRow(d: StageData): StageRow {
  const clean = asStageData({
    plots: d.plots.map((p) => ({ ...p, width_m: p.widthM, depth_m: p.depthM })),
    inputs: d.inputs,
    mixer: d.mixer,
    band_brings: d.bandBrings,
    venue_provides: d.venueProvides,
    venue_agreed: d.venueAgreed,
  });
  return {
    plots: clean.plots.map((p) => ({
      id: p.id,
      name: p.name,
      width_m: p.widthM ?? null,
      depth_m: p.depthM ?? null,
      items: p.items.map((i) => ({
        id: i.id,
        kind: i.kind,
        ...(i.code ? { code: i.code } : {}),
        ...(i.label ? { label: i.label } : {}),
        x: Math.round(i.x * 1000) / 1000,
        y: Math.round(i.y * 1000) / 1000,
        ...(i.lead ? { lead: true } : {}),
      })),
    })),
    inputs: clean.inputs.map((c) => ({ id: c.id, source: c.source, mic: c.mic, kind: c.kind, who: c.who })),
    mixer: clean.mixer || null,
    band_brings: clean.bandBrings,
    venue_provides: clean.venueProvides,
    venue_agreed: clean.venueAgreed,
  };
}

/** True when nothing has been filled in. */
export const isStageEmpty = (d: StageData): boolean =>
  d.plots.every((p) => p.items.length === 0) && d.inputs.length === 0 && d.bandBrings.length === 0 && d.venueProvides.length === 0;

/** "01", "02"… */
export const channelLabel = (index: number): string => String(index + 1).padStart(2, '0');

/** Players on a plot. */
export const playersOf = (plot: StagePlot | undefined): PlotItem[] => (plot?.items ?? []).filter((i) => i.kind === 'player');

/** "6 × 4 m" or ''. */
export const stageSize = (plot: StagePlot | undefined): string =>
  plot?.widthM && plot?.depthM ? `${fmtM(plot.widthM)} × ${fmtM(plot.depthM)} m` : '';
const fmtM = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Moves an item to a new spot, kept inside the stage. */
export function moveItem(plot: StagePlot, itemId: string, x: number, y: number): StagePlot {
  return {
    ...plot,
    items: plot.items.map((i) => (i.id === itemId ? { ...i, x: num01(x, i.x), y: num01(y, i.y) } : i)),
  };
}

/** Moves a channel from one position to another. */
export function moveInput(list: InputChannel[], from: number, to: number): InputChannel[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

// ------------------------------------------------------- starter from lineup --

type Tr = (english: string, vars?: Record<string, string | number>) => string;
const plain: Tr = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : s);

/** Two-letter code for an instrument key. */
export function instrumentCode(key: string | null | undefined): string {
  switch (key) {
    case 'drums': return 'DR';
    case 'percussion': return 'PC';
    case 'bass':
    case 'double-bass': return 'BS';
    case 'guitar': return 'GT';
    case 'keys': return 'KY';
    case 'vocals': return 'VX';
    case 'sax': return 'SX';
    case 'trumpet': return 'TP';
    case 'trombone': return 'TB';
    case 'violin': return 'VN';
    case 'cello': return 'VC';
    case 'dj': return 'DJ';
    default: return (key || '?').replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase() || '?';
  }
}

export interface LineupPlayer {
  /** "Marta C." */
  name: string;
  /** Free text: "Guitar / Backing vocals", "Keys · Band leader". */
  instrument?: string | null;
}

/** First name, for the WHO column. */
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * A first plot and input list from the gig's lineup (admins see it as a
 * suggestion until they save it). Positions follow the usual small-band
 * layout: drums centre back, bass and guitar amps either side, keys, lead
 * vocal and a second guitar in front, wedges at the front edge.
 */
export function starterStage(lineup: LineupPlayer[], t: Tr = plain): StageData {
  const back: { x: number; y: number }[] = [
    { x: 0.25, y: 0.3 },
    { x: 0.75, y: 0.3 },
    { x: 0.12, y: 0.32 },
    { x: 0.88, y: 0.32 },
  ];
  const front: { x: number; y: number }[] = [
    { x: 0.5, y: 0.66 },
    { x: 0.2, y: 0.66 },
    { x: 0.8, y: 0.66 },
    { x: 0.35, y: 0.7 },
    { x: 0.65, y: 0.7 },
  ];
  const items: PlotItem[] = [];
  // Channels in the usual desk order: drums, bass, guitars, keys, others, vocals.
  const inputs: { c: InputChannel; group: number }[] = [];
  let group = 4;
  const ch = (source: string, mic: string, who: string, kind: InputKind = /^di\b/i.test(mic) ? 'di' : 'mic') =>
    inputs.push({ c: { id: newId(), source, mic, kind, who }, group });

  // Lead vocal first in front, the drummer centre back, then the rest.
  const players = lineup.map((p) => ({ ...p, keys: instrumentKeys(p.instrument) }));
  const order = [...players].sort((a, b) => rank(a.keys[0]) - rank(b.keys[0]));
  let leadTaken = false;
  let guitars = 0;
  for (const p of order) {
    const key = p.keys[0] ?? '';
    const who = firstName(p.name);
    const sings = p.keys.includes('vocals');
    let spot: { x: number; y: number } | undefined;
    let label = '';
    let lead = false;
    group = key === 'drums' ? 0 : key === 'bass' || key === 'double-bass' ? 1 : key === 'guitar' ? 2 : key === 'keys' ? 3 : 4;
    if (key === 'drums') {
      spot = { x: 0.5, y: 0.2 };
      label = t('Drums · riser');
      ch(t('Kick'), 'Beta 52', who);
      ch(t('Snare'), 'SM57', who);
      ch(t('OH L'), 'C414', who);
      ch(t('OH R'), 'C414', who);
    } else if (key === 'bass' || key === 'double-bass') {
      spot = back.shift();
      label = t('Bass amp');
      ch(t('Bass'), 'DI', who);
    } else if (key === 'guitar') {
      guitars += 1;
      spot = guitars === 1 ? back.shift() : front.pop();
      label = guitars === 1 ? t('Guitar amp') : t('Gtr / bvx');
      ch(guitars === 1 ? t('Guitar') : t('Guitar 2'), 'SM57', who);
    } else if (key === 'keys') {
      spot = front.splice(1, 1)[0] ?? front.shift();
      label = t('Keys');
      ch(t('Keys L'), 'DI', who);
      ch(t('Keys R'), 'DI', who);
    } else if (key === 'vocals' && !leadTaken) {
      leadTaken = true;
      lead = true;
      spot = front.shift();
      label = t('Lead vox');
    } else {
      spot = front.shift() ?? back.shift();
      label = p.instrument ? p.instrument.split(/[·/,]/)[0].trim() : '';
      if (key && key !== 'vocals') ch(label || key, key === 'dj' ? 'DI' : 'SM57', who);
    }
    items.push({ id: newId(), kind: 'player', code: instrumentCode(key), label: label || undefined, x: spot?.x ?? 0.5, y: spot?.y ?? 0.5, ...(lead ? { lead: true } : {}) });
    if (sings) {
      group = lead ? 5 : 6;
      if (lead) ch(t('Lead vox'), 'Beta 58', who);
      else ch(t('Bvx {n}', { n: inputs.filter((x) => x.group === 6).length + 1 }), 'SM58', who);
    }
  }
  // A wedge in front of every player in the front row, a speaker each side.
  for (const p of items.filter((i) => i.kind === 'player' && i.y >= 0.5)) {
    items.push({ id: newId(), kind: 'wedge', x: p.x, y: Math.min(1, p.y + 0.24) });
  }
  if (items.length > 0) {
    items.push({ id: newId(), kind: 'speaker', x: 0.03, y: 0.8 });
    items.push({ id: newId(), kind: 'speaker', x: 0.97, y: 0.8 });
  }
  return {
    ...EMPTY_STAGE,
    plots: items.length > 0 ? [{ id: newId(), name: t('Full band'), widthM: 6, depthM: 4, items }] : [],
    inputs: inputs.sort((a, b) => a.group - b.group).map((x) => x.c),
  };
}

/** Lead vocal first, then the drummer, then everyone else. */
const rank = (key: string | undefined) =>
  key === 'vocals' ? 0 : key === 'drums' ? 1 : key === 'bass' || key === 'double-bass' ? 2 : key === 'guitar' ? 3 : key === 'keys' ? 4 : 5;

/** A copy of a plot under a new name ("Trio"). */
export function duplicatePlot(plot: StagePlot, name: string): StagePlot {
  return { ...plot, id: newId(), name, items: plot.items.map((i) => ({ ...i, id: newId() })) };
}
