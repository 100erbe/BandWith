/**
 * Stable numeric id for a UUID string, for the legacy UI types that still key
 * on numbers. Hashes the whole string (FNV-1a, 32-bit), so two ids collide only
 * by chance, unlike the old "first 8 hex chars" scheme, where every id sharing
 * a prefix (and every non-hex id, via a Date.now() fallback) got the same number.
 * Always returns a positive integer, so `|| fallback` patterns never fire.
 */
export function uuidToNumericId(uuid: string | null | undefined): number {
  const s = String(uuid ?? '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) || 1;
}
