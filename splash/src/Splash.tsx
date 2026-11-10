import React, { useMemo } from 'react';
import { AbsoluteFill, Easing, random, useCurrentFrame, useVideoConfig } from 'remotion';
import {
  BAND,
  BLOCKS,
  CELL,
  DOT_MID,
  DOT_OFF,
  GLYPHS,
  LIME,
  MARK_SIZE,
  RADIUS,
  STAGE,
  WHITE,
  WITH,
  WORDMARK_WIDTH,
} from './brand';

/*
 * "Count-in" — BandWith launch animation, 60 fps.
 *
 *   f0        the pictogram, alone, where the native launch screen draws it
 *   f10–70    four beats: the mark hops like a level meter, a dot-matrix
 *             waveform grows out of it, one instrument joining per beat,
 *             dot-matrix numerals count 1-2-3-4
 *   f70–90    crescendo: every column of the meter fills
 *   f90       downbeat: the lit dots fly into a dot-matrix BANDWITH,
 *             the mark moves into the lockup
 *   f122–140  the dots melt into the real logotype (vector)
 *   f140–160  hold on the lockup
 *   f160–178  lockup dissolves; the last frames are the plain stage colour
 */

export const FPS = 60;
export const BEATS = [10, 30, 50, 70];
const EIGHTH = 10;
export const DOWN = 90;
const FLY = 26; // flight duration per dot
const FLY_STAGGER = 12; // left → right sweep
const RESOLVE = DOWN + FLY + FLY_STAGGER - 6; // 122
const EXIT = 160;
export const DURATION = 178;

const ease = Easing.bezier(0.16, 1, 0.3, 1); // --ease-smooth
const easeInOut = Easing.bezier(0.4, 0, 0.2, 1); // --ease-in-out
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const prog = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));

/** Percussive envelope: 2-frame attack, exponential decay. */
const hit = (t: number, at: number, tau: number) =>
  t < at ? 0 : Math.min(1, (t - at + 1) / 2) * Math.exp(-(t - at) / tau);

const gauss = (d: number, s: number) => Math.exp(-(d * d) / (2 * s * s));

/* ─────────────────────────── layout ─────────────────────────── */

type Layout = ReturnType<typeof makeLayout>;

function makeLayout(W: number, H: number) {
  const u = Math.min(W / 1290, H / 2100);
  const cx = W / 2;
  const cy = H / 2;

  // Waveform field: round dots, same rhythm as the app's DotText grid.
  const P = 28 * u;
  const r = 7.5 * u;
  const K = 20; // rows above / below the centre line
  const half = Math.floor((W / 2 - P * 0.6) / P);

  // f0 mark ≈ the native LaunchScreen pictogram (Splash.imageset, aspect-fill).
  const mark0 = 307 * u;

  // Vertical lockup (BrandLockup vertical): mark = 3× cap height, gap 0.9× cap.
  const wmW = Math.min(900 * u, W - 2 * 96 * u);
  const wmH = (wmW * MARK_SIZE) / WORDMARK_WIDTH;
  const markF = wmH * 3;
  const gap = wmH * 0.9;
  const blockH = markF + gap + wmH;
  const left = cx - wmW / 2;
  const top = cy - blockH / 2;

  return {
    W,
    H,
    u,
    cx,
    cy,
    P,
    r,
    K,
    half,
    mark0,
    wmW,
    wmH,
    wm: { x: left, y: top + markF + gap },
    markF: { x: left + markF / 2, y: top + markF / 2, size: markF },
    // count-in numerals sit above the mark
    countY: cy - 760 * u,
  };
}

/* ─────────────────────────── music ─────────────────────────── */

/** Lit height (in rows) of field column i at frame t. One instrument joins per beat. */
function colHeight(L: Layout, i: number, t: number) {
  if (t < BEATS[0]) return 0;
  const d = Math.abs(i) / L.half;
  let h = 0;

  // 1 · kick — wide bump around the mark on every beat
  for (const b of BEATS) h += 8.5 * gauss(d, 0.34) * hit(t, b, 7);

  // 2 · bass — rolling shape, beats + off-beats
  if (t >= BEATS[1]) {
    const shape = (0.55 + 0.45 * Math.sin(i * 0.5 + 1.3)) * gauss(d, 0.55);
    let e = 0;
    for (let s = BEATS[1]; s <= t; s += EIGHTH) e = Math.max(e, hit(t, s, 12) * (s % 20 === 10 ? 1 : 0.6));
    h += 4.5 * shape * e;
  }

  // 3 · hats — sparkle across the whole width on eighths
  if (t >= BEATS[2]) {
    const n = Math.floor((t - BEATS[2]) / EIGHTH);
    const at = BEATS[2] + n * EIGHTH;
    h += (1.5 + 3.5 * random(`hat-${i}-${n}`)) * hit(t, at, 4) * (0.4 + 0.6 * d);
  }

  // 4 · voice — a slow travelling swell
  if (t >= BEATS[3]) {
    const fade = clamp01((t - BEATS[3]) / 6);
    h += fade * 3.5 * (0.5 + 0.5 * Math.sin(i * 0.23 - t * 0.2)) * gauss(d, 0.6);
  }

  h *= L.K / 13;

  // crescendo into the downbeat: the meter swells into a lens around the mark
  if (t > BEATS[3]) {
    const c = easeInOut(prog(t, BEATS[3] + 2, DOWN));
    const lens = 0.3 + 0.7 * gauss(d, 0.42);
    h = lerp(h, L.K * lens * (0.85 + 0.15 * random(`full-${i}`)), c);
  }
  return Math.min(h, L.K);
}

/** Meter peak-hold: the peak cap hangs, then falls. */
function colPeak(L: Layout, i: number, t: number) {
  let p = 0;
  for (let s = 0; s <= 18; s++) p = Math.max(p, colHeight(L, i, t - s) - s * 0.32);
  return p;
}

/* ─────────────────────────── geometry ─────────────────────────── */

type Dot = { x: number; y: number; lime: boolean };

/** Lit field dots at a given frame (excluding the mark's box). */
function fieldDots(L: Layout, t: number) {
  const lit: Dot[] = [];
  const peaks: Dot[] = [];
  const reveal = ease(prog(t, 0, 14));
  const box = L.mark0 / 2 + L.P * 0.45;
  for (let i = -L.half; i <= L.half; i++) {
    if (Math.abs(i) > L.half * reveal) continue;
    const x = L.cx + i * L.P;
    const h = colHeight(L, i, t);
    const pk = Math.round(colPeak(L, i, t));
    for (let j = -L.K; j <= L.K; j++) {
      const y = L.cy + j * L.P;
      if (Math.abs(x - L.cx) < box && Math.abs(y - L.cy) < box) continue;
      const a = Math.abs(j);
      if (a <= h + 0.15 && (a > 0 || h > 0.4)) lit.push({ x, y, lime: false });
      else if (pk >= 1 && a === pk) peaks.push({ x, y, lime: true });
    }
  }
  return { lit, peaks };
}

/** BANDWITH sampled into a dot matrix (Path2D hit-testing — deterministic in Chrome). */
function sampleWordmark(L: Layout) {
  const pitchPx = 9 * L.u;
  const k = L.wmW / WORDMARK_WIDTH; // px per wordmark unit
  const step = pitchPx / k;
  const ctx = document.createElement('canvas').getContext('2d')!;
  const paths = [
    ...BAND.map((d) => ({ p: new Path2D(d), lime: false })),
    ...WITH.map((d) => ({ p: new Path2D(d), lime: true })),
  ];
  const out: Dot[] = [];
  for (let y = step / 2; y < MARK_SIZE; y += step) {
    for (let x = step / 2; x < WORDMARK_WIDTH; x += step) {
      const hitPath = paths.find((q) => ctx.isPointInPath(q.p, x, y));
      if (hitPath) out.push({ x: L.wm.x + x * k, y: L.wm.y + y * k, lime: hitPath.lime });
    }
  }
  return { dots: out, pitch: pitchPx };
}

/* ─────────────────────────── pieces ─────────────────────────── */

const hop = (s: number, len = 14) => (s < 0 || s > len ? 0 : Math.sin((Math.PI * s) / len));

const Mark: React.FC<{ x: number; y: number; size: number; t: number; opacity?: number }> = ({
  x,
  y,
  size,
  t,
  opacity = 1,
}) => {
  const k = size / MARK_SIZE;
  // Each column hops on the beat, a few frames apart — three players in time.
  const colHop = [0, 1, 2].map((c) => {
    let v = 0;
    for (const b of BEATS) v = Math.max(v, hop(t - b - c * 3));
    v = Math.max(v, 1.6 * hop(t - DOWN - c * 2, 18));
    return v * 0.11 * MARK_SIZE;
  });
  return (
    <g transform={`translate(${x - size / 2} ${y - size / 2}) scale(${k})`} opacity={opacity}>
      {BLOCKS.map((b, n) => (
        <rect
          key={n}
          x={b.x}
          y={b.y - colHop[b.col]}
          width={CELL}
          height={b.h}
          rx={RADIUS}
          fill={LIME}
        />
      ))}
    </g>
  );
};

const DotGlyph: React.FC<{ ch: string; cx: number; cy: number; pitch: number; fill: string; dim: string }> = ({
  ch,
  cx,
  cy,
  pitch,
  fill,
  dim,
}) => {
  const rows = (GLYPHS[ch] ?? GLYPHS[' ']).split('/');
  const x0 = cx - 2 * pitch;
  const y0 = cy - 3 * pitch;
  return (
    <g>
      {rows.flatMap((row, j) =>
        row.split('').map((v, i) => (
          <circle
            key={`${i}-${j}`}
            cx={x0 + i * pitch}
            cy={y0 + j * pitch}
            r={pitch * 0.38}
            fill={v === '1' ? fill : dim}
          />
        )),
      )}
    </g>
  );
};

/* ─────────────────────────── composition ─────────────────────────── */

export const Splash: React.FC = () => {
  const t = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const L = useMemo(() => makeLayout(W, H), [W, H]);

  const word = useMemo(() => sampleWordmark(L), [L]);

  // Downbeat hand-off: lit dots at DOWN become the particles that write BANDWITH.
  const flight = useMemo(() => {
    const src = fieldDots(L, DOWN).lit.slice().sort((a, b) => a.x - b.x || a.y - b.y);
    const dst = word.dots
      .map((d, n) => ({ ...d, n }))
      .sort((a, b) => a.x - b.x || a.y - b.y);
    const used = new Set<number>();
    const pairs = dst.map((d, k) => {
      const si = Math.min(src.length - 1, Math.floor((k * src.length) / dst.length));
      used.add(si);
      return { from: src[si], to: d, seed: d.n };
    });
    const rest = src.filter((_, i) => !used.has(i));
    return { pairs, rest };
  }, [L, word]);

  const xMin = L.wm.x;
  const fieldOn = t < DOWN;
  const field = fieldOn ? fieldDots(L, t) : null;

  // Dim grid: revealed radially from the mark, rings pulse outward on each beat.
  const gridR = ease(prog(t, 0, 26)) * Math.hypot(W, H) * 0.55;
  const gridFade = 1 - prog(t, DOWN, DOWN + 10);
  const grid: React.ReactNode[] = [];
  if (gridFade > 0) {
    const box = L.mark0 / 2 + L.P * 0.45;
    for (let i = -L.half; i <= L.half; i++) {
      for (let j = -L.K; j <= L.K; j++) {
        const x = L.cx + i * L.P;
        const y = L.cy + j * L.P;
        if (Math.abs(x - L.cx) < box && Math.abs(y - L.cy) < box) continue;
        const dist = Math.hypot(x - L.cx, y - L.cy);
        if (dist > gridR) continue;
        let ring = 0;
        for (const b of BEATS) {
          if (t < b) continue;
          const R = (t - b) * 64 * L.u;
          ring = Math.max(ring, Math.exp(-((dist - R) ** 2) / (2 * (L.P * 1.2) ** 2)) * Math.exp(-(t - b) / 16));
        }
        const edge = 1 - (Math.abs(j) / L.K) ** 1.5;
        grid.push(
          <circle
            key={`g${i}.${j}`}
            cx={x}
            cy={y}
            r={L.r * (0.8 + 0.35 * ring)}
            fill={ring > 0.35 ? DOT_MID : DOT_OFF}
            opacity={(0.65 + 0.35 * ring) * edge * gridFade}
          />,
        );
      }
    }
  }

  // Mark position: centre → lockup on the downbeat.
  const mp = ease(prog(t, DOWN, DOWN + 30));
  const exitP = easeInOut(prog(t, EXIT, DURATION - 4));
  const markX = lerp(L.cx, L.markF.x, mp);
  const markY = lerp(L.cy, L.markF.y, mp);
  const markS = lerp(L.mark0, L.markF.size, mp);

  // Stage light: lime glow breathing with the kick.
  let kick = 0;
  for (const b of BEATS) kick = Math.max(kick, hit(t, b, 10));
  kick = Math.max(kick, 1.4 * hit(t, DOWN, 18), 0.5 * prog(t, BEATS[3], DOWN));
  const glow = (0.06 + 0.16 * kick) * (1 - exitP);

  // Count-in numerals (dot matrix).
  const beatIdx = BEATS.filter((b) => t >= b).length - 1;
  const countOn = beatIdx >= 0 && t < DOWN;
  const sinceBeat = beatIdx >= 0 ? t - BEATS[beatIdx] : 0;
  const countPop = 1 + 0.18 * Math.exp(-sinceBeat / 4);
  const countFade = countOn ? 1 - prog(t, DOWN - 6, DOWN) : 0;

  // Resolve dots → vector.
  const vecIn = ease(prog(t, RESOLVE + 4, RESOLVE + 16));
  const exitScale = 1 - 0.04 * exitP;
  const lockOpacity = 1 - exitP;

  return (
    <AbsoluteFill style={{ backgroundColor: STAGE }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${(markX / W) * 100}% ${(markY / H) * 100}%, rgba(213,251,70,${glow}) 0%, rgba(213,251,70,${glow * 0.35}) ${18 * L.u}%, rgba(5,5,5,0) ${46}%)`,
        }}
      />
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', inset: 0 }}>
        {grid}

        {field && (
          <g>
            {field.lit.map((d) => (
              <circle key={`l${d.x}.${d.y}`} cx={d.x} cy={d.y} r={L.r} fill={WHITE} />
            ))}
            {field.peaks.map((d) => (
              <circle key={`p${d.x}.${d.y}`} cx={d.x} cy={d.y} r={L.r} fill={LIME} />
            ))}
          </g>
        )}

        {/* downbeat flash: leftover dots burst and fade */}
        {!fieldOn &&
          t < DOWN + 14 &&
          flight.rest.map((d, n) => {
            const p = prog(t, DOWN, DOWN + 14);
            const dx = d.x - L.cx;
            const dy = d.y - L.cy;
            const push = 1 + 0.25 * ease(p);
            return (
              <circle
                key={`r${n}`}
                cx={L.cx + dx * push}
                cy={L.cy + dy * push}
                r={L.r * (1 - p)}
                fill={p < 0.15 ? LIME : WHITE}
                opacity={1 - p}
              />
            );
          })}

        <g
          opacity={lockOpacity}
          transform={`translate(${W / 2} ${H / 2}) scale(${exitScale}) translate(${-W / 2} ${-H / 2})`}
        >
          {/* vector logotype, fading in under the dots */}
          {vecIn > 0 && (
            <g
              transform={`translate(${L.wm.x} ${L.wm.y}) scale(${L.wmW / WORDMARK_WIDTH})`}
              opacity={vecIn}
            >
              <g fill={WHITE}>
                {BAND.map((d) => (
                  <path key={d.slice(0, 14)} d={d} />
                ))}
              </g>
              <g fill={LIME}>
                {WITH.map((d) => (
                  <path key={d.slice(0, 14)} d={d} />
                ))}
              </g>
            </g>
          )}

          {/* particles: field → dot-matrix BANDWITH → melt */}
          {!fieldOn &&
            flight.pairs.map(({ from, to, seed }) => {
              const delay = ((to.x - xMin) / L.wmW) * FLY_STAGGER;
              const p = ease(prog(t, DOWN + delay, DOWN + delay + FLY));
              const swirl = Math.sin(Math.PI * p) * (random(`sw-${seed}`) - 0.5) * 160 * L.u;
              const x = lerp(from.x, to.x, p) + swirl * 0.4;
              const y = lerp(from.y, to.y, p) + swirl;
              const rT = word.pitch * 0.42;
              const melt = ease(prog(t, RESOLVE + delay * 0.5, RESOLVE + delay * 0.5 + 10));
              const r = lerp(L.r, rT, p) * (1 + 0.75 * melt);
              const out = prog(t, RESOLVE + 10 + delay * 0.5, RESOLVE + 18 + delay * 0.5);
              if (out >= 1) return null;
              const color = p < 0.5 ? (from.lime ? LIME : WHITE) : to.lime ? LIME : WHITE;
              return <circle key={`f${seed}`} cx={x} cy={y} r={r} fill={color} opacity={1 - out} />;
            })}

          <Mark x={markX} y={markY} size={markS} t={t} />
        </g>

        {countFade > 0 && (
          <g
            opacity={countFade}
            transform={`translate(${L.cx} ${L.countY}) scale(${countPop}) translate(${-L.cx} ${-L.countY})`}
          >
            <DotGlyph
              ch={String(beatIdx + 1)}
              cx={L.cx}
              cy={L.countY}
              pitch={22 * L.u}
              fill={beatIdx === 3 ? LIME : WHITE}
              dim={DOT_OFF}
            />
          </g>
        )}
      </svg>
    </AbsoluteFill>
  );
};
