// /unsubscribe.html — personal link from product update emails (065).
// The link carries the user id and an HMAC; the database checks it in
// bw_email_unsubscribe. Asking for a click first keeps link scanners from
// unsubscribing people by just opening the URL.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const params = new URL(window.location.href).searchParams;
const user = params.get('u') ?? '';
const sig = params.get('s') ?? '';

const show = (id: 'ask' | 'done' | 'invalid') => {
  for (const s of ['ask', 'done', 'invalid']) {
    document.getElementById(s)?.toggleAttribute('hidden', s !== id);
  }
};
const errorNote = document.getElementById('error');
const button = document.getElementById('confirm') as HTMLButtonElement | null;

const looksValid = /^[0-9a-f-]{36}$/i.test(user) && /^[0-9a-f]{64}$/i.test(sig);
if (!looksValid || !SUPABASE_URL || !ANON_KEY) show('invalid');

button?.addEventListener('click', async () => {
  if (!SUPABASE_URL || !ANON_KEY) return;
  button.disabled = true;
  errorNote?.setAttribute('hidden', '');
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/bw_email_unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ p_user: user, p_sig: sig }),
    });
    if (!res.ok) throw new Error(String(res.status));
    show((await res.json()) === true ? 'done' : 'invalid');
  } catch {
    errorNote?.removeAttribute('hidden');
    button.disabled = false;
  }
});
