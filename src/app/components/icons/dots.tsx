import { createIcon, IconComponent } from './IconBase';

/* ═══════════════════════════════════════════════════════════════════════════
   BandWith Dot Icons — construction kit
   The icons are drawn with the same two elements as the BandWith mark:

   • Pill  — a round-capped stroke (the "bar" of the mark)
   • Dot   — a zero-length round-capped stroke, so its diameter always equals
             the stroke weight (the "dot" of the mark)

   Rules
   1. 24×24 box, live area 2–22, weight 2 (follows `strokeWidth`).
   2. Separate elements never touch: keep ≥ 1.5 clear between caps.
   3. Outlines (boxes, documents, triangles) open at the corners, like the mark.
   4. Round outlines are rings of dots; small solid parts are discs.
   5. Glyph marks (chevrons, checks, arrowheads) stay one continuous stroke,
      so they read instantly at 16px.
   ═══════════════════════════════════════════════════════════════════════════ */

export type Pt = [number, number];
const f = (n: number) => +n.toFixed(2);
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Dots at the given x,y pairs. */
export const dot = (...xy: number[]) => {
  let d = '';
  for (let i = 0; i < xy.length; i += 2) d += `M${f(xy[i])} ${f(xy[i + 1])}h0`;
  return d;
};

/** Straight pill from a to b, trimmed by `t` at both ends. */
export const seg = (x1: number, y1: number, x2: number, y2: number, t = 0) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = (dx / len) * t;
  const uy = (dy / len) * t;
  return `M${f(x1 + ux)} ${f(y1 + uy)}L${f(x2 - ux)} ${f(y2 - uy)}`;
};

/** Polygon drawn as separate edges with open corners (each edge trimmed by t). */
export const open = (pts: Pt[], closed = true, t = 2.5) => {
  const n = closed ? pts.length : pts.length - 1;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    d += seg(a[0], a[1], b[0], b[1], t);
  }
  return d;
};

/** Rectangle with open corners. */
export const box = (x: number, y: number, w: number, h: number, t = 3) =>
  open(
    [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ],
    true,
    t,
  );

const onCircle = (cx: number, cy: number, r: number, deg: number): Pt => [
  cx + r * Math.cos(rad(deg)),
  cy + r * Math.sin(rad(deg)),
];

/** `n` dots evenly on a circle. Angles in degrees, 0 = 3 o'clock, clockwise. */
export const ring = (cx: number, cy: number, r: number, n: number, a0 = -90, skip: number[] = []) => {
  let d = '';
  for (let i = 0; i < n; i++) {
    if (skip.includes(i)) continue;
    const [x, y] = onCircle(cx, cy, r, a0 + (i * 360) / n);
    d += dot(x, y);
  }
  return d;
};

/** `n` dots along an arc from a0 to a1 (inclusive). */
export const arcDots = (cx: number, cy: number, r: number, a0: number, a1: number, n: number) => {
  let d = '';
  for (let i = 0; i < n; i++) {
    const [x, y] = onCircle(cx, cy, r, a0 + ((a1 - a0) * i) / Math.max(1, n - 1));
    d += dot(x, y);
  }
  return d;
};

/** Pill along an arc from a0 to a1 (clockwise when a1 > a0). */
export const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const [x0, y0] = onCircle(cx, cy, r, a0);
  const [x1, y1] = onCircle(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${large} ${sweep} ${f(x1)} ${f(y1)}`;
};

/**
 * Arrowhead (chevron) sitting on a circle at angle `deg`, pointing along the
 * clockwise (dir 1) or counter-clockwise (dir -1) tangent.
 */
export const head = (cx: number, cy: number, r: number, deg: number, dir: 1 | -1 = 1, s = 3.6) => {
  const [tx, ty] = onCircle(cx, cy, r, deg);
  const vx = -Math.sin(rad(deg)) * dir;
  const vy = Math.cos(rad(deg)) * dir;
  const arm = (k: number): Pt => {
    const c = Math.cos(rad(135 * k));
    const s2 = Math.sin(rad(135 * k));
    return [tx + s * (vx * c - vy * s2), ty + s * (vx * s2 + vy * c)];
  };
  const [ax, ay] = arm(1);
  const [bx, by] = arm(-1);
  return `M${f(ax)} ${f(ay)}L${f(tx)} ${f(ty)}L${f(bx)} ${f(by)}`;
};

/** Closed five-point star (rounded by the stroke join). */
export const star = (cx: number, cy: number, R: number, r: number) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const [x, y] = onCircle(cx, cy, i % 2 ? r : R, -90 + i * 36);
    d += `${i ? 'L' : 'M'}${f(x)} ${f(y)}`;
  }
  return `${d}Z`;
};

export interface DotSpec {
  /** Pills and dots (stroke only, never filled). */
  d?: string;
  /** Pills drawn heavier (`boldScale` × weight): mic capsule, pencil body, pause bars. */
  bold?: string;
  boldScale?: number;
  /** Solid discs [cx, cy, r]; the stroke adds half the weight to r. */
  solid?: [number, number, number][];
  /** Shapes that are always filled (play triangle, bolt…). */
  fill?: string;
  /** Closed outline that is filled only when the icon gets `fill-current`. */
  shape?: string;
  transform?: string;
  /** When the group is scaled, pass the scale so the weight stays constant. */
  strokeScale?: number;
}

const renderSpec = (spec: DotSpec, sw: number | string, key?: number) => {
  const w = Number(sw);
  return (
    <g key={key} transform={spec.transform} strokeWidth={spec.strokeScale ? w / spec.strokeScale : undefined}>
      {spec.shape && <path d={spec.shape} />}
      {spec.fill && <path d={spec.fill} fill="currentColor" />}
      {spec.d && <path d={spec.d} fill="none" />}
      {spec.bold && (
        <path d={spec.bold} fill="none" strokeWidth={(w * (spec.boldScale ?? 2)) / (spec.strokeScale ?? 1)} />
      )}
      {spec.solid?.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="currentColor" />
      ))}
    </g>
  );
};

/** Build an icon from one or more DotSpecs. */
export const dotIcon = (name: string, spec: DotSpec | DotSpec[]): IconComponent =>
  createIcon(name, (sw) =>
    Array.isArray(spec) ? <>{spec.map((s, i) => renderSpec(s, sw, i))}</> : renderSpec(spec, sw),
  );

/* Shared parts */

/** Document outline with a cut corner (top right), open corners. */
export const DOC = 'M5 5.5V18.5M8 21.5H16M19 18.5V9.5M8 2.5H12M15.5 3L18.5 6';

/** Cloud outline, open at the bottom, plus the bottom pill. */
export const CLOUD = 'M8 18.9A7 7 0 1 1 15.71 10H17.5A4.5 4.5 0 0 1 19.5 18.5M11.5 19H16';
