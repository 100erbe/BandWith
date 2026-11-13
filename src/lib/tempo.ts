/**
 * Tempo helpers for a song's BPM: tap tempo, and an estimate from the song's
 * own audio file, worked out on the device (nothing is sent or looked up).
 */

export const MIN_BPM = 40;
export const MAX_BPM = 240;

/** Taps more than this apart start a new count. */
const TAP_RESET_MS = 2000;
const TAPS_KEPT = 8;

/** Tap tempo: give it the times of the taps (ms), get the BPM (or null below 2 taps). */
export function tapBpm(taps: number[]): number | null {
  const recent: number[] = [];
  for (let i = taps.length - 1; i >= 0 && recent.length < TAPS_KEPT; i--) {
    if (recent.length && recent[0] - taps[i] > TAP_RESET_MS) break;
    recent.unshift(taps[i]);
  }
  if (recent.length < 2) return null;
  const gaps = recent.slice(1).map((t, i) => t - recent[i]);
  // Median gap: one late tap doesn't drag the tempo.
  const sorted = [...gaps].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  const bpm = Math.round(60000 / mid);
  return bpm >= MIN_BPM && bpm <= MAX_BPM ? bpm : null;
}

/** Keeps only the taps that still count (same rules as tapBpm). */
export const keepTaps = (taps: number[], now: number) => {
  const last = taps[taps.length - 1];
  return last != null && now - last > TAP_RESET_MS ? [now] : [...taps.slice(-(TAPS_KEPT - 1)), now];
};

/** Analysis window: frames of 5 ms. */
const HOP_S = 0.005;

/**
 * BPM estimate from mono samples: an onset envelope (rises in short-term
 * energy), then the autocorrelation lag with the strongest beat between 60
 * and 200 BPM, with a gentle preference for tempos near 120.
 * Returns null when the audio has no clear pulse.
 */
export function detectBpm(samples: Float32Array, sampleRate: number): number | null {
  const hop = Math.max(1, Math.round(sampleRate * HOP_S));
  const frames = Math.floor(samples.length / hop);
  if (frames < 4 / HOP_S) return null; // under 4 seconds
  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    const start = f * hop;
    for (let i = start; i < start + hop; i++) sum += samples[i] * samples[i];
    energy[f] = Math.log1p(1000 * Math.sqrt(sum / hop));
  }
  // Onsets: positive changes in energy, minus a moving average.
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f++) onset[f] = Math.max(0, energy[f] - energy[f - 1]);
  const win = Math.round(0.3 / HOP_S);
  let acc = 0;
  const peaks = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    acc += onset[f] - (f >= win ? onset[f - win] : 0);
    peaks[f] = Math.max(0, onset[f] - acc / Math.min(win, f + 1));
  }
  // Spread each onset over ±20 ms, so a beat that falls between two frames still lines up.
  const spread = Math.max(1, Math.round(0.02 / HOP_S));
  const flat = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    if (!peaks[f]) continue;
    for (let d = -spread; d <= spread; d++) {
      const g = f + d;
      if (g >= 0 && g < frames) flat[g] += peaks[f] * (1 - Math.abs(d) / (spread + 1));
    }
  }
  const fps = 1 / HOP_S;
  const minLag = Math.floor((60 / 200) * fps);
  const maxLag = Math.ceil((60 / 60) * fps);
  let best = -1;
  let bestLag = 0;
  // Scored up to twice the slowest beat: the check at double the period below needs them.
  const topLag = Math.min(2 * maxLag, frames - 1);
  const scores = new Float32Array(topLag + 1);
  for (let lag = minLag; lag <= topLag; lag++) {
    let s = 0;
    for (let f = lag; f < frames; f++) s += flat[f] * flat[f - lag];
    scores[lag] = s / (frames - lag);
  }
  for (let lag = minLag; lag <= maxLag; lag++) {
    // A beat also shows at twice its period: reward lags that repeat.
    // Songs cluster around 120 BPM: a gentle preference settles 72-vs-108-vs-144 doubts.
    const prior = Math.exp(-0.5 * (Math.log2((60 * fps) / lag / 120) / 2.0) ** 2);
    const s = (scores[lag] + 0.5 * (scores[2 * lag] ?? 0)) * prior;
    if (s > best) {
      best = s;
      bestLag = lag;
    }
  }
  if (best <= 0 || !bestLag) return null;
  // Is there a pulse at all? The best lag must stand out from the average.
  let mean = 0;
  for (let lag = minLag; lag <= maxLag; lag++) mean += scores[lag];
  mean /= maxLag - minLag + 1;
  if (scores[bestLag] < mean * 1.5) return null;
  // Refine with the neighbours (parabolic peak).
  const a = scores[bestLag - 1] ?? 0;
  const b = scores[bestLag];
  const c = scores[bestLag + 1] ?? 0;
  const denom = a - 2 * b + c;
  const lag = denom ? bestLag + (0.5 * (a - c)) / denom : bestLag;
  // Half or double the real tempo stays possible: the form offers ×2 / ÷2 next to the result.
  return Math.round((60 * fps) / lag);
}

/** Seconds of audio analysed, from a little into the song (intros are often free time). */
const ANALYSE_FROM_S = 20;
const ANALYSE_S = 45;
const ANALYSE_RATE = 11025;

/** A song's audio (File or downloaded bytes) → BPM, or null. Browser / WebView only. */
export async function detectBpmFromAudio(data: ArrayBuffer): Promise<number | null> {
  const Ctx: typeof AudioContext | undefined =
    (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(data.slice(0));
    const from = decoded.duration > ANALYSE_FROM_S + 15 ? ANALYSE_FROM_S : 0;
    const length = Math.min(decoded.duration - from, ANALYSE_S);
    if (length < 5) return null;
    // Downmix and resample with an offline render: fast and done by the platform.
    const off = new OfflineAudioContext(1, Math.ceil(length * ANALYSE_RATE), ANALYSE_RATE);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start(0, from, length);
    const rendered = await off.startRendering();
    return detectBpm(rendered.getChannelData(0), ANALYSE_RATE);
  } finally {
    void ctx.close().catch(() => {});
  }
}
