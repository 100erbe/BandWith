import { describe, expect, it } from 'vitest';
import {
  decodeStageState,
  encodeStageState,
  fromBase64,
  seqBytes,
  setlistFingerprint,
  stageServiceUuid,
  toBase64,
} from '../stageBle';

// jsdom has no WebCrypto; the app runs where it does (WKWebView, Android WebView).
// (A variable module name keeps the app's tsconfig, which has no Node types, out of it.)
const nodeCrypto = 'node:crypto';
if (!globalThis.crypto?.subtle) {
  const { webcrypto } = (await import(/* @vite-ignore */ nodeCrypto)) as { webcrypto: Crypto };
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

const KEY = toBase64(new Uint8Array(32).map((_, i) => i * 7));
const OTHER_KEY = toBase64(new Uint8Array(32).map((_, i) => 255 - i));
const ids = ['a1', 'b2', 'c3', 'd4'];

describe('stageBle', () => {
  it('round-trips a state through bytes', async () => {
    const state = { seq: 42, from: 'k3x9q2ab', songId: 'c3', order: ['c3', 'a1', 'b2', 'd4'] };
    const bytes = await encodeStageState(state, ids, KEY);
    expect(bytes).not.toBeNull();
    // 1 + 4 + 1 + 8 + 4 + 1 + 1 + 4 + 8
    expect(bytes!.length).toBe(32);
    expect(await decodeStageState(bytes!, ids, KEY)).toEqual({ ok: true, state });
  });

  it('keeps "saved order" and "no song" as such', async () => {
    const state = { seq: 1, from: 'x', songId: null, order: null };
    const bytes = await encodeStageState(state, ids, KEY);
    expect(await decodeStageState(bytes!, ids, KEY)).toEqual({ ok: true, state });
  });

  it('stays small for a long set', async () => {
    const many = Array.from({ length: 30 }, (_, i) => `id-${i}`);
    const bytes = await encodeStageState({ seq: 9, from: 'abcdefgh', songId: 'id-3', order: [...many].reverse() }, many, KEY);
    expect(bytes!.length).toBeLessThan(80);
  });

  it('rejects another key, tampering and a different setlist', async () => {
    const bytes = (await encodeStageState({ seq: 5, from: 'lead', songId: 'b2', order: null }, ids, KEY))!;
    expect(await decodeStageState(bytes, ids, OTHER_KEY)).toEqual({ ok: false, reason: 'auth' });
    const tampered = bytes.slice();
    tampered[4] ^= 1;
    expect(await decodeStageState(tampered, ids, KEY)).toEqual({ ok: false, reason: 'auth' });
    expect(await decodeStageState(bytes, ['a1', 'c3', 'b2', 'd4'], KEY)).toEqual({ ok: false, reason: 'setlist' });
    expect(await decodeStageState(new Uint8Array([9, 9, 9]), ids, KEY)).toEqual({ ok: false, reason: 'format' });
  });

  it('refuses what it cannot send', async () => {
    expect(await encodeStageState({ seq: 1, from: 'x', songId: 'zz', order: null }, ids, KEY)).toBeNull();
    expect(await encodeStageState({ seq: 1, from: 'x', songId: null, order: ['a1', 'zz'] }, ids, KEY)).toBeNull();
    expect(await encodeStageState({ seq: 1, from: '', songId: null, order: null }, ids, KEY)).toBeNull();
  });

  it('derives a stable per-gig service UUID', async () => {
    const a = await stageServiceUuid(KEY);
    expect(a).toMatch(/^[0-9a-f]{8}-5b1e-4c6a-9b3d-6e0a2f7c1d42$/);
    expect(await stageServiceUuid(KEY)).toBe(a);
    expect(await stageServiceUuid(OTHER_KEY)).not.toBe(a);
  });

  it('helpers', async () => {
    expect([...seqBytes(258)]).toEqual([0, 0, 1, 2]);
    expect([...fromBase64(toBase64(new Uint8Array([0, 255, 7])))]).toEqual([0, 255, 7]);
    expect((await setlistFingerprint(ids)).length).toBe(4);
  });
});
