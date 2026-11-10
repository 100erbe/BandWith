import React from 'react';

/**
 * 5×7 dot-matrix glyphs (Figma: "Dot Glyph"). Each string is one row,
 * top → bottom, "1" = lit.
 */
const GLYPHS: Record<string, string> = {
  '0': '01110/10001/10011/10101/11001/10001/01110',
  '1': '00100/01100/00100/00100/00100/00100/01110',
  '2': '01110/10001/00001/00010/00100/01000/11111',
  '3': '11111/00010/00100/00010/00001/10001/01110',
  '4': '00010/00110/01010/10010/11111/00010/00010',
  '5': '11111/10000/11110/00001/00001/10001/01110',
  '6': '00110/01000/10000/11110/10001/10001/01110',
  '7': '11111/00001/00010/00100/01000/01000/01000',
  '8': '01110/10001/10001/01110/10001/10001/01110',
  '9': '01110/10001/10001/01111/00001/00010/01100',
  A: '01110/10001/10001/11111/10001/10001/10001',
  B: '11110/10001/10001/11110/10001/10001/11110',
  C: '01110/10001/10000/10000/10000/10001/01110',
  D: '11100/10010/10001/10001/10001/10010/11100',
  E: '11111/10000/10000/11110/10000/10000/11111',
  F: '11111/10000/10000/11110/10000/10000/10000',
  G: '01110/10001/10000/10111/10001/10001/01111',
  H: '10001/10001/10001/11111/10001/10001/10001',
  I: '01110/00100/00100/00100/00100/00100/01110',
  J: '00111/00010/00010/00010/00010/10010/01100',
  K: '10001/10010/10100/11000/10100/10010/10001',
  L: '10000/10000/10000/10000/10000/10000/11111',
  M: '10001/11011/10101/10101/10001/10001/10001',
  N: '10001/10001/11001/10101/10011/10001/10001',
  O: '01110/10001/10001/10001/10001/10001/01110',
  P: '11110/10001/10001/11110/10000/10000/10000',
  Q: '01110/10001/10001/10001/10101/10010/01101',
  R: '11110/10001/10001/11110/10100/10010/10001',
  S: '01111/10000/10000/01110/00001/00001/11110',
  T: '11111/00100/00100/00100/00100/00100/00100',
  U: '10001/10001/10001/10001/10001/10001/01110',
  V: '10001/10001/10001/10001/10001/01010/00100',
  W: '10001/10001/10001/10101/10101/10101/01010',
  X: '10001/10001/01010/00100/01010/10001/10001',
  Y: '10001/10001/10001/01010/00100/00100/00100',
  Z: '11111/00001/00010/00100/01000/10000/11111',
  '+': '00000/00100/00100/11111/00100/00100/00000',
  '-': '00000/00000/00000/11111/00000/00000/00000',
  '/': '00001/00001/00010/00100/01000/10000/10000',
  ':': '00000/00100/00100/00000/00100/00100/00000',
  '.': '00000/00000/00000/00000/00000/01100/01100',
  ',': '00000/00000/00000/00000/01100/00100/01000',
  '%': '11001/11001/00010/00100/01000/10011/10011',
  '€': '00111/01000/11110/01000/11110/01000/00111',
  $: '00100/01111/10100/01110/00101/11110/00100',
  '£': '00110/01001/01000/11100/01000/01000/11111',
  ' ': '00000/00000/00000/00000/00000/00000/00000',
};

const ROWS = 7;
const COLS = 5;

interface DotTextProps {
  /** Text to render. Unsupported characters render as a blank cell. */
  text: string | number;
  /** Glyph height in px (Figma: 34 on dashboard metrics, 24 on cards). */
  size?: number;
  /** Draw unlit cells in --dot-off as well (the "grid" look). */
  showGrid?: boolean;
  className?: string;
  /** Accessible label; defaults to the text itself. */
  label?: string;
}

/**
 * Dot-matrix text. Lit dots use currentColor, so the colour comes from the
 * parent's text colour.
 */
export const DotText: React.FC<DotTextProps> = ({ text, size = 34, showGrid = false, className, label }) => {
  const chars = String(text).toUpperCase().split('');
  // 7 rows of dots; a dot is ~0.83 of the pitch, as in the Figma glyph (5/6).
  const pitch = size / (ROWS - 1 + 0.83);
  const r = (pitch * 0.83) / 2;
  const glyphW = (COLS - 1) * pitch + 2 * r;
  const gap = pitch;
  const width = chars.length * glyphW + Math.max(0, chars.length - 1) * gap;

  const dots: React.ReactNode[] = [];
  chars.forEach((ch, ci) => {
    const rows = (GLYPHS[ch] ?? GLYPHS[' ']).split('/');
    const ox = ci * (glyphW + gap);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const on = rows[row]?.[col] === '1';
        if (!on && !showGrid) continue;
        dots.push(
          <circle
            key={`${ci}-${row}-${col}`}
            cx={ox + r + col * pitch}
            cy={r + row * pitch}
            r={r}
            fill={on ? 'currentColor' : 'var(--dot-off)'}
          />,
        );
      }
    }
  });

  return (
    <svg
      role="img"
      aria-label={label ?? String(text)}
      width={width}
      height={size}
      viewBox={`0 0 ${width} ${size}`}
      className={className}
      style={{ display: 'block', flexShrink: 1, maxWidth: '100%', height: 'auto' }}
    >
      {dots}
    </svg>
  );
};
