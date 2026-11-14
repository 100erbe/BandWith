/**
 * "Enable Face ID?" before a password sign-in: an account that answered
 * "Not now" on this device is not asked again for a while (the sign-in
 * screen is the only place that offers quick sign-in, so it comes back).
 */
const KEY = 'bw_quick_signin_declined';
const QUIET_MS = 30 * 24 * 60 * 60 * 1000;

type Entry = { e: string; at: number };

const read = (): Entry[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v)
      ? v.filter((x): x is Entry => !!x && typeof x.e === 'string' && typeof x.at === 'number')
      : [];
  } catch {
    return [];
  }
};

const norm = (email: string) => email.trim().toLowerCase();

export function quickSignInDeclined(email: string, now = Date.now()): boolean {
  const e = norm(email);
  return !!e && read().some((x) => x.e === e && now - x.at < QUIET_MS);
}

export function rememberQuickSignInDeclined(email: string, now = Date.now()) {
  const e = norm(email);
  if (!e) return;
  try {
    const list = read().filter((x) => x.e !== e && now - x.at < QUIET_MS);
    list.push({ e, at: now });
    // A few accounts at most on one device.
    localStorage.setItem(KEY, JSON.stringify(list.slice(-10)));
  } catch {
    /* storage blocked: asked again next time */
  }
}
