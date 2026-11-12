import { buildPdfBlobFromJpegDataUrls } from './quotePdf';
import { formatHoursMinutes } from '@/lib/songGenres';
import { t } from '@/lib/i18n';

/**
 * Setlist → printable PDF (A4, one or more pages): set by set, with the
 * running order, key, BPM and duration of every song. Drawn on a canvas like
 * the quote PDF, so it needs no PDF library and works offline.
 */

export interface SetlistPdfSong {
  title: string;
  artist?: string | null;
  key?: string | null;
  bpm?: number | null;
  durationSeconds?: number | null;
  setNumber: number;
}

const W = 1654; // A4 at 200 DPI
const H = 2339;
const M = 120;
const SANS = '"Inter", "Helvetica Neue", Arial, sans-serif';
const MONO = '"JetBrains Mono", "SF Mono", Menlo, monospace';
const INK = '#111111';
const MUTED = '#6b6b6b';
const LINE = '#dcdcdc';

const clock = (s?: number | null) => {
  if (!s || s <= 0) return '';
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

const fit = (ctx: CanvasRenderingContext2D, text: string, max: number) => {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
};

export function generateSetlistPdf(opts: {
  name: string;
  bandName?: string | null;
  songs: SetlistPdfSong[];
}): { blob: Blob; fileName: string } {
  const { name, bandName, songs } = opts;
  const pages: string[] = [];
  const total = songs.reduce((a, s) => a + (s.durationSeconds || 0), 0);
  const sets = [...new Set(songs.map((s) => s.setNumber || 1))].sort((a, b) => a - b);
  const multiSet = sets.length > 1;

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let y = 0;
  let pageNo = 0;

  const finishPage = () => {
    if (!canvas || !ctx) return;
    ctx.fillStyle = MUTED;
    ctx.font = `400 22px ${MONO}`;
    ctx.textAlign = 'left';
    ctx.fillText(`${(bandName || 'BandWith').toUpperCase()} · ${name.toUpperCase()}`.slice(0, 80), M, H - 70);
    ctx.textAlign = 'right';
    ctx.fillText(t('PAGE {page}', { page: pageNo }), W - M, H - 70);
    ctx.textAlign = 'left';
    pages.push(canvas.toDataURL('image/jpeg', 0.9));
  };

  const newPage = (first: boolean) => {
    if (canvas) finishPage();
    pageNo += 1;
    canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';
    y = M;
    if (first) {
      ctx.fillStyle = MUTED;
      ctx.font = `500 26px ${MONO}`;
      ctx.fillText(`${(bandName || t('Setlist')).toUpperCase()} · ${t('SETLIST')}`, M, y + 20);
      ctx.fillStyle = INK;
      ctx.font = `800 84px ${SANS}`;
      ctx.fillText(fit(ctx, name.toUpperCase(), W - 2 * M), M, y + 120);
      ctx.fillStyle = MUTED;
      ctx.font = `400 30px ${SANS}`;
      const meta = [
        songs.length === 1 ? t('{count} song', { count: songs.length }) : t('{count} songs', { count: songs.length }),
        multiSet ? t('{count} sets', { count: sets.length }) : null,
        total > 0 ? t('Total {time}', { time: formatHoursMinutes(total) }) : null,
      ].filter(Boolean).join(' · ');
      ctx.fillText(meta, M, y + 175);
      y += 230;
    } else {
      ctx.fillStyle = MUTED;
      ctx.font = `500 26px ${MONO}`;
      ctx.fillText(`${name.toUpperCase()} · ${t('CONTINUED')}`, M, y + 20);
      y += 70;
    }
    ctx.fillStyle = INK;
    ctx.fillRect(M, y, W - 2 * M, 3);
    y += 30;
  };

  const ROW = 96;
  const ensure = (h: number) => {
    if (!ctx || y + h > H - 150) newPage(false);
  };

  newPage(true);
  let n = 0;
  for (const set of sets) {
    const inSet = songs.filter((s) => (s.setNumber || 1) === set);
    if (multiSet) {
      ensure(80 + ROW);
      const setTime = inSet.reduce((a, s) => a + (s.durationSeconds || 0), 0);
      ctx!.fillStyle = INK;
      ctx!.font = `700 30px ${MONO}`;
      ctx!.fillText(t('SET {number}', { number: set }), M, y + 44);
      ctx!.fillStyle = MUTED;
      ctx!.font = `400 26px ${MONO}`;
      ctx!.textAlign = 'right';
      ctx!.fillText([t('{count} songs', { count: inSet.length }), setTime ? formatHoursMinutes(setTime) : ''].filter(Boolean).join(' · '), W - M, y + 44);
      ctx!.textAlign = 'left';
      y += 70;
    }
    for (const s of inSet) {
      ensure(ROW);
      n += 1;
      const c = ctx!;
      c.fillStyle = MUTED;
      c.font = `500 28px ${MONO}`;
      c.fillText(String(n).padStart(2, '0'), M, y + 44);
      const right = [s.key, s.bpm ? `${s.bpm} BPM` : null, clock(s.durationSeconds)].filter(Boolean).join('  ·  ');
      c.font = `400 26px ${MONO}`;
      c.textAlign = 'right';
      c.fillText(right, W - M, y + 44);
      const rightW = c.measureText(right).width;
      c.textAlign = 'left';
      const textX = M + 80;
      const maxW = W - M - rightW - 40 - textX;
      c.fillStyle = INK;
      c.font = `700 36px ${SANS}`;
      c.fillText(fit(c, s.title || t('Untitled'), maxW), textX, y + 44);
      if (s.artist) {
        c.fillStyle = MUTED;
        c.font = `400 26px ${SANS}`;
        c.fillText(fit(c, s.artist, maxW), textX, y + 80);
      }
      y += ROW;
      c.fillStyle = LINE;
      c.fillRect(textX, y - 6, W - M - textX, 2);
    }
    y += 24;
  }
  if (songs.length === 0) {
    ctx!.fillStyle = MUTED;
    ctx!.font = `400 32px ${SANS}`;
    ctx!.fillText(t('No songs in this setlist yet.'), M, y + 40);
  }
  finishPage();

  const safe = (name || 'Setlist').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Setlist';
  return { blob: buildPdfBlobFromJpegDataUrls(pages), fileName: `Setlist_${safe}.pdf` };
}
