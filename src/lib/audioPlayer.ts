import { useSyncExternalStore } from 'react';
import { playableAudioUrl, resolveSongFileUrl } from './services/songFiles';

/**
 * One in-app audio player for song recordings (stored files and https links,
 * Google Drive share links included). The mini player (MiniPlayer.tsx) shows
 * what's playing with play/pause and stop; nothing opens the system browser.
 */

export interface PlayerTrack {
  id: string;
  title: string;
  artist?: string | null;
  /** Shown in the lyrics reader from the mini player. */
  lyrics?: string | null;
}

export interface PlayerState {
  track: PlayerTrack | null;
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
  position: number;
  duration: number;
  error: string | null;
  /** The link that failed, so the error can offer to open it elsewhere. */
  sourceUrl: string | null;
}

let state: PlayerState = { track: null, status: 'idle', position: 0, duration: 0, error: null, sourceUrl: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<PlayerState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

let audio: HTMLAudioElement | null = null;
let loadToken = 0;

const element = (): HTMLAudioElement => {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'auto';
  audio.setAttribute('playsinline', '');
  audio.addEventListener('playing', () => set({ status: 'playing', error: null }));
  audio.addEventListener('pause', () => {
    if (state.status === 'playing') set({ status: 'paused' });
  });
  audio.addEventListener('timeupdate', () => set({ position: audio!.currentTime }));
  audio.addEventListener('durationchange', () => set({ duration: Number.isFinite(audio!.duration) ? audio!.duration : 0 }));
  audio.addEventListener('ended', () => set({ status: 'paused', position: 0 }));
  audio.addEventListener('error', () => {
    if (!state.track) return;
    set({
      status: 'error',
      error: /drive\.(usercontent\.)?google\.com/.test(audio!.currentSrc || audio!.src)
        ? "Can't play this Drive file. In Google Drive, share it as “Anyone with the link”, or upload the MP3 to the song."
        : "Can't play this recording here.",
    });
  });
  return audio;
};

/** Start playing a song's recording (a stored-file ref or an https link). */
export async function playTrack(track: PlayerTrack, ref: string): Promise<void> {
  const a = element();
  const token = ++loadToken;
  a.pause();
  set({ track, status: 'loading', position: 0, duration: 0, error: null, sourceUrl: null });
  const resolved = await resolveSongFileUrl(ref);
  if (token !== loadToken) return;
  if (!resolved) {
    set({ status: 'error', error: "This recording's link isn't valid." });
    return;
  }
  const url = playableAudioUrl(resolved);
  set({ sourceUrl: resolved });
  a.src = url;
  try {
    await a.play();
  } catch (err) {
    if (token !== loadToken) return;
    // Autoplay refusals leave it ready: the play button starts it.
    if ((err as { name?: string })?.name === 'NotAllowedError') set({ status: 'paused' });
  }
}

export function togglePlay(): void {
  const a = audio;
  if (!a || !state.track) return;
  if (a.paused) void a.play().catch(() => set({ status: 'paused' }));
  else a.pause();
}

export function seekTo(seconds: number): void {
  if (audio && Number.isFinite(seconds)) audio.currentTime = Math.max(0, seconds);
}

/** Stop and close the player. */
export function stopPlayer(): void {
  loadToken++;
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  set({ track: null, status: 'idle', position: 0, duration: 0, error: null, sourceUrl: null });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getState = () => state;

export const usePlayer = (): PlayerState => useSyncExternalStore(subscribe, getState, getState);
