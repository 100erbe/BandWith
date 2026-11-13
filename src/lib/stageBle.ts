/**
 * Stage mode over Bluetooth: the bytes on the air (no React, no plugins, so
 * it can be tested). See also src/lib/stageLive.ts (the same StageLiveState
 * travels over the internet) and migration 087 (the per-gig key).
 *
 * The admin's phone is a Bluetooth peripheral with one service and one
 * characteristic. Readers get the full state; subscribers are notified with
 * just the 4-byte seq and then read, so no message ever depends on the
 * negotiated MTU.
 *
 * Full state (all integers big-endian):
 *   [0]      format version (1)
 *   [1..4]   seq (Lamport clock)
 *   [5]      sender id length L (≤ 16), then L ASCII bytes
 *   4 bytes  fingerprint of the saved setlist (row ids in saved order)
 *   1 byte   current song, as an index into the saved order (255 = none)
 *   1 byte   n, then n indexes into the saved order (n = 0: saved order)
 *   8 bytes  HMAC-SHA256(key, everything before), truncated
 *
 * The service UUID is derived from the gig's key, so a member's app only
 * finds its own gig's leader, and the HMAC means only someone holding the
 * key (an active band member, migration 087) can publish an accepted state.
 */
import type { StageLiveState } from './stageLive';

export const STAGE_BLE_VERSION = 1;
/** Characteristic carrying the state (same for every gig). */
export const STAGE_BLE_CHARACTERISTIC = 'b7d50001-5b1e-4c6a-9b3d-6e0a2f7c1d42';
const SERVICE_SUFFIX = '-5b1e-4c6a-9b3d-6e0a2f7c1d42';
const NONE = 255;
const MAX_SONGS = 254;
const MAC_BYTES = 8;

const enc = new TextEncoder();
/** WebCrypto wants ArrayBuffer-backed views; ours always are. */
const bs = (u: Uint8Array) => u as Uint8Array<ArrayBuffer>;

export const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
};

export const fromBase64 = (b64: string) => {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
};

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

const hmacKey = (keyB64: string) =>
  crypto.subtle.importKey('raw', bs(fromBase64(keyB64)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

const hmac = async (keyB64: string, data: Uint8Array) =>
  new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(keyB64), bs(data)));

/** The gig's Bluetooth service UUID, derived from its key. */
export async function stageServiceUuid(keyB64: string): Promise<string> {
  const tag = (await hmac(keyB64, enc.encode('bandwith-stage-service'))).slice(0, 4);
  return `${hex(tag)}${SERVICE_SUFFIX}`;
}

/** 4 bytes identifying the saved setlist (row ids in saved order). */
export async function setlistFingerprint(savedIds: string[]): Promise<Uint8Array> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bs(enc.encode(savedIds.join(',')))));
  return digest.slice(0, 4);
}

/** Notification value: just the seq (subscribers then read the full state). */
export const seqBytes = (seq: number) => {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, seq >>> 0);
  return out;
};

/**
 * Bytes for `state`, or null when it can't be sent (too many songs, a song
 * the saved setlist doesn't have, or a sender id that isn't short ASCII).
 */
export async function encodeStageState(
  state: StageLiveState,
  savedIds: string[],
  keyB64: string,
): Promise<Uint8Array | null> {
  if (savedIds.length > MAX_SONGS || !/^[\x20-\x7e]{1,16}$/.test(state.from)) return null;
  const index = new Map(savedIds.map((id, i) => [id, i]));
  const current = state.songId === null ? NONE : index.get(state.songId);
  if (current === undefined) return null;
  const order: number[] = [];
  if (state.order) {
    for (const id of state.order) {
      const i = index.get(id);
      if (i === undefined) return null;
      order.push(i);
    }
  }
  const from = enc.encode(state.from);
  const fp = await setlistFingerprint(savedIds);
  const body = new Uint8Array(1 + 4 + 1 + from.length + 4 + 1 + 1 + order.length);
  const view = new DataView(body.buffer);
  let o = 0;
  body[o++] = STAGE_BLE_VERSION;
  view.setUint32(o, state.seq >>> 0);
  o += 4;
  body[o++] = from.length;
  body.set(from, o);
  o += from.length;
  body.set(fp, o);
  o += 4;
  body[o++] = current;
  body[o++] = order.length;
  body.set(order, o);
  const mac = (await hmac(keyB64, body)).slice(0, MAC_BYTES);
  const out = new Uint8Array(body.length + MAC_BYTES);
  out.set(body);
  out.set(mac, body.length);
  return out;
}

export type DecodeResult =
  | { ok: true; state: StageLiveState }
  | { ok: false; reason: 'format' | 'auth' | 'setlist' };

/** Checks and reads a state; `savedIds` is this phone's saved setlist. */
export async function decodeStageState(bytes: Uint8Array, savedIds: string[], keyB64: string): Promise<DecodeResult> {
  if (bytes.length < 1 + 4 + 1 + 4 + 1 + 1 + MAC_BYTES || bytes[0] !== STAGE_BLE_VERSION) return { ok: false, reason: 'format' };
  const body = bytes.slice(0, bytes.length - MAC_BYTES);
  const mac = bytes.slice(bytes.length - MAC_BYTES);
  const expected = (await hmac(keyB64, body)).slice(0, MAC_BYTES);
  let diff = 0;
  for (let i = 0; i < MAC_BYTES; i++) diff |= mac[i] ^ expected[i];
  if (diff !== 0) return { ok: false, reason: 'auth' };

  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  let o = 1;
  const seq = view.getUint32(o);
  o += 4;
  const fromLen = body[o++];
  if (fromLen < 1 || fromLen > 16 || o + fromLen + 4 + 2 > body.length) return { ok: false, reason: 'format' };
  const from = new TextDecoder().decode(body.slice(o, o + fromLen));
  o += fromLen;
  const fp = body.slice(o, o + 4);
  o += 4;
  const current = body[o++];
  const n = body[o++];
  if (o + n !== body.length) return { ok: false, reason: 'format' };
  const mine = await setlistFingerprint(savedIds);
  if (hex(fp) !== hex(mine)) return { ok: false, reason: 'setlist' };
  if (current !== NONE && current >= savedIds.length) return { ok: false, reason: 'format' };
  const order: string[] = [];
  for (let i = 0; i < n; i++) {
    const idx = body[o + i];
    if (idx >= savedIds.length) return { ok: false, reason: 'format' };
    order.push(savedIds[idx]);
  }
  return {
    ok: true,
    state: { seq, from, songId: current === NONE ? null : savedIds[current], order: n > 0 ? order : null },
  };
}
