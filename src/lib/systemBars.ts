import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

/**
 * The app runs edge-to-edge: the status bar and the navigation bar are
 * transparent and the web view draws under them. Content is kept clear of
 * them with the --safe-top / --safe-bottom tokens (see theme.css), so the only
 * thing to sync here is the colour of the system icons.
 *
 * `tone` describes the surface under the bars: 'light' surface → dark icons,
 * 'dark' surface → light icons.
 */
export type BarTone = 'light' | 'dark';

let baseTone: BarTone = 'light';
let overrideTone: BarTone | null = null;

async function apply(tone: BarTone): Promise<void> {
  if (typeof document !== 'undefined') {
    // Browsers / PWAs tint their own chrome with theme-color.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', tone === 'light' ? '#E5E3E0' : '#313131');
  }
  if (!Capacitor.isNativePlatform()) return;
  const style = tone === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark;
  try {
    await SystemBars.setStyle({ style });
  } catch {
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setStyle({ style: tone === 'light' ? Style.Light : Style.Dark });
    } catch {
      /* not available */
    }
  }
}

/** Called by the theme provider whenever light/dark mode changes. */
export async function syncSystemBarsAppearance(resolvedTheme: BarTone): Promise<void> {
  baseTone = resolvedTheme;
  await apply(overrideTone ?? baseTone);
}

/**
 * Temporarily match the icons to a coloured block that sits under the status
 * bar (an event hero, an offline banner…). Returns a function that restores the
 * theme default; call it on unmount.
 */
export function setStatusBarTone(tone: BarTone): () => void {
  overrideTone = tone;
  void apply(tone);
  return () => {
    if (overrideTone === tone) overrideTone = null;
    void apply(overrideTone ?? baseTone);
  };
}

/** Relative luminance check for picking a tone from a background colour. */
export function toneForBackground(hex: string): BarTone {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return baseTone;
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.35 ? 'light' : 'dark';
}

/**
 * Tone for a surface whose *foreground* colour is known (e.g. a hero painted
 * with `--accent-x` and `--accent-x-fg`). Accepts any CSS colour, including
 * `var(--token)`: light text means a dark surface, and vice versa.
 */
export function toneForForeground(cssColor: string): BarTone {
  if (typeof document === 'undefined') return baseTone;
  const probe = document.createElement('span');
  probe.style.color = cssColor;
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color;
  probe.remove();
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
  if (!m) return baseTone;
  const hex = [m[1], m[2], m[3]].map((c) => Number(c).toString(16).padStart(2, '0')).join('');
  return toneForBackground(hex) === 'light' ? 'dark' : 'light';
}

/** Draw under the system bars from the very first screen (before sign-in). */
export async function enableEdgeToEdge(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { StatusBar } = await import('@capacitor/status-bar');
    await StatusBar.setOverlaysWebView({ overlay: true });
  } catch {
    /* plugin missing on this platform */
  }
}
