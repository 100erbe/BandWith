/**
 * Demo mode: an in-memory stand-in for the Supabase client, used only in
 * development (see `isDemoMode` in ../supabase.ts). It implements the subset
 * of supabase-js the app calls: the PostgREST query builder (filters, order,
 * limit, embedded relations), auth, realtime channels, storage, functions and
 * RPCs. Data comes from ./seed.ts and is kept in localStorage so changes
 * survive a reload; signing out wipes it.
 */
import { buildSeed, DEMO_USER, type DemoDB, type Row } from './seed';
import { memberStatsFromRows } from '@/lib/memberStats';

const DB_KEY = 'bw-demo-db-v4';
const SESSION_KEY = 'bw-demo-session';

// ---------------------------------------------------------------- storage --

const readLS = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const writeLS = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: demo still works in memory */
  }
};

let db: DemoDB | null = null;
const getDB = (): DemoDB => {
  if (db) return db;
  const raw = readLS(DB_KEY);
  if (raw) {
    try {
      db = JSON.parse(raw) as DemoDB;
      // Tables added to the seed after this demo was saved start seeded.
      const seed = buildSeed();
      for (const t of Object.keys(seed)) if (!(t in db)) db[t] = seed[t];
      return db;
    } catch {
      /* corrupt: reseed */
    }
  }
  db = buildSeed();
  persist();
  return db;
};
const persist = () => {
  if (db) writeLS(DB_KEY, JSON.stringify(db));
};
const table = (name: string): Row[] => {
  const d = getDB();
  if (!d[name]) d[name] = [];
  return d[name];
};

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));

const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

// ------------------------------------------------------- relation helpers --

/** FK column name → table it points to. */
const FK_TABLE: Record<string, string> = {
  user_id: 'profiles',
  invited_by: 'profiles',
  assigned_to: 'profiles',
  proposed_by: 'profiles',
  created_by: 'profiles',
  sender_id: 'profiles',
  added_by: 'profiles',
  accepted_by: 'profiles',
  band_id: 'bands',
  event_id: 'events',
  song_id: 'songs',
  chat_id: 'chats',
  poll_id: 'rehearsal_polls',
  option_id: 'rehearsal_poll_options',
  setlist_id: 'setlists',
  quote_id: 'quotes',
  proposal_id: 'song_proposals',
  reply_to_id: 'messages',
};

/** Table → the FK column other tables use to point at it. */
const BACK_FK: Record<string, string> = {
  profiles: 'user_id',
  bands: 'band_id',
  events: 'event_id',
  songs: 'song_id',
  chats: 'chat_id',
  rehearsal_polls: 'poll_id',
  rehearsal_poll_options: 'option_id',
  setlists: 'setlist_id',
  quotes: 'quote_id',
  song_proposals: 'proposal_id',
};

const KNOWN_TABLES = new Set([...Object.values(FK_TABLE), ...Object.keys(BACK_FK)]);

interface SelectField {
  kind: 'star' | 'col' | 'rel';
  name: string; // column or relation token
  alias?: string;
  hint?: string;
  inner?: boolean;
  children?: SelectField[];
}

/** Split on top-level commas (ignores commas inside parentheses). */
const splitTop = (s: string): string[] => {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
};

const parseSelect = (s: string | undefined): SelectField[] => {
  if (!s || !s.trim()) return [{ kind: 'star', name: '*' }];
  return splitTop(s.replace(/\s+/g, ' ')).map((tok): SelectField => {
    const paren = tok.indexOf('(');
    if (paren === -1) {
      if (tok === '*') return { kind: 'star', name: '*' };
      const [a, b] = tok.split(':').map((x) => x.trim());
      const name = (b ?? a).split('::')[0];
      return { kind: 'col', name, alias: b ? a : undefined };
    }
    const head = tok.slice(0, paren).trim();
    const body = tok.slice(paren + 1, tok.lastIndexOf(')'));
    let alias: string | undefined;
    let rel = head;
    if (head.includes(':')) {
      [alias, rel] = head.split(':').map((x) => x.trim());
    }
    const [name, ...hints] = rel.split('!').map((x) => x.trim());
    const inner = hints.includes('inner');
    const hint = hints.find((h) => h !== 'inner' && h !== 'left');
    return { kind: 'rel', name, alias, hint, inner, children: parseSelect(body) };
  });
};

/** Resolve an embedded relation for one row. Returns undefined when unknown. */
const resolveRelation = (srcTable: string, row: Row, f: SelectField): Row | Row[] | null => {
  let target = f.name;
  let fkCol: string | undefined;

  if (!KNOWN_TABLES.has(target) && FK_TABLE[target]) {
    // `alias:fk_column(...)` form
    fkCol = target;
    target = FK_TABLE[target];
  }
  if (f.hint) {
    const h = f.hint.replace(new RegExp(`^${srcTable}_`), '').replace(/_fkey$/, '');
    if (h in row) fkCol = h;
  }

  // Many-to-one: the row carries the FK.
  if (!fkCol) {
    const singular = BACK_FK[target];
    if (singular && singular in row) fkCol = singular;
    else if (target === 'profiles' && 'id' in row && srcTable === 'auth_users') fkCol = 'id';
  }
  if (fkCol) {
    const id = row[fkCol];
    if (id == null) return null;
    return table(target).find((r) => r.id === id) ?? null;
  }

  // One-to-many: target rows point back at this row.
  const back = BACK_FK[srcTable];
  if (back) return table(target).filter((r) => r[back] === row.id);
  return null;
};

const project = (srcTable: string, row: Row, fields: SelectField[]): Row | null => {
  const out: Row = {};
  for (const f of fields) {
    if (f.kind === 'star') Object.assign(out, clone(row));
    else if (f.kind === 'col') out[f.alias ?? f.name] = clone(row[f.name] ?? null);
  }
  for (const f of fields) {
    if (f.kind !== 'rel') continue;
    const key = f.alias ?? f.name;
    const targetTable = !KNOWN_TABLES.has(f.name) && FK_TABLE[f.name] ? FK_TABLE[f.name] : f.name;
    const rel = resolveRelation(srcTable, row, f);
    if (Array.isArray(rel)) {
      const items = rel.map((r) => project(targetTable, r, f.children!)).filter(Boolean) as Row[];
      if (f.inner && items.length === 0) return null;
      out[key] = items;
    } else if (rel) {
      out[key] = project(targetTable, rel, f.children!);
    } else {
      if (f.inner) return null;
      out[key] = null;
    }
  }
  return out;
};

// ----------------------------------------------------------------- filters --

type Pred = (row: Row) => boolean;

const coerce = (v: any): any => {
  if (v === 'null') return null;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
};
const cmp = (a: any, b: any) => {
  if (a == null || b == null) return NaN;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) - Number(b);
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
};
const likeToRe = (pattern: string, ci: boolean) =>
  new RegExp(
    '^' + String(pattern).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.') + '$',
    ci ? 'i' : ''
  );
const containsVal = (have: any, want: any): boolean => {
  if (Array.isArray(want)) return Array.isArray(have) && want.every((w) => have.includes(w));
  if (want && typeof want === 'object')
    return !!have && typeof have === 'object' && Object.entries(want).every(([k, v]) => containsVal(have[k], v));
  return have === want;
};

const opPred = (col: string, op: string, val: any): Pred => {
  switch (op) {
    case 'eq':
      return (r) => r[col] === coerce(val) || (r[col] != null && String(r[col]) === String(val));
    case 'neq':
      return (r) => r[col] !== coerce(val) && String(r[col]) !== String(val);
    case 'gt':
      return (r) => cmp(r[col], val) > 0;
    case 'gte':
      return (r) => cmp(r[col], val) >= 0;
    case 'lt':
      return (r) => cmp(r[col], val) < 0;
    case 'lte':
      return (r) => cmp(r[col], val) <= 0;
    case 'like':
      return (r) => r[col] != null && likeToRe(val, false).test(String(r[col]));
    case 'ilike':
      return (r) => r[col] != null && likeToRe(val, true).test(String(r[col]));
    case 'is':
      return (r) => (coerce(val) === null ? r[col] == null : r[col] === coerce(val));
    case 'in': {
      const list = Array.isArray(val)
        ? val
        : String(val).replace(/^\(|\)$/g, '').split(',').map((x) => x.trim().replace(/^"|"$/g, ''));
      return (r) => list.some((x: any) => r[col] === x || String(r[col]) === String(x));
    }
    case 'cs':
    case 'contains':
      return (r) => containsVal(r[col], typeof val === 'string' ? safeJSON(val) : val);
    default:
      return () => true;
  }
};
const safeJSON = (s: string) => {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
};

/** Parse a PostgREST `or=(...)` expression such as `a.eq.1,and(b.is.null,c.eq.2)`. */
const parseLogic = (expr: string, mode: 'or' | 'and'): Pred => {
  const parts = splitTop(expr).map((p): Pred => {
    const m = p.match(/^(and|or)\((.*)\)$/);
    if (m) return parseLogic(m[2], m[1] as 'or' | 'and');
    const [col, maybeNot, ...rest] = p.split('.');
    if (maybeNot === 'not') {
      const [op, ...v] = rest;
      const inner = opPred(col, op, v.join('.'));
      return (r) => !inner(r);
    }
    return opPred(col, maybeNot, rest.join('.'));
  });
  return mode === 'or' ? (r) => parts.some((p) => p(r)) : (r) => parts.every((p) => p(r));
};

// ----------------------------------------------------------- query builder --

const UNIQUE_KEYS: Record<string, string[]> = {
  profiles: ['id'],
  onboarding_progress: ['user_id'],
  push_tokens: ['token'],
  chat_participants: ['chat_id', 'user_id'],
  event_members: ['event_id', 'user_id'],
  band_members: ['band_id', 'user_id'],
  rehearsal_poll_votes: ['option_id', 'user_id'],
  proposal_votes: ['proposal_id', 'user_id'],
};

type Result = { data: any; error: any; count?: number | null; status: number; statusText: string };

class DemoQuery implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private selectStr: string | undefined;
  private returning = false;
  private countMode: string | undefined;
  private head = false;
  private preds: Pred[] = [];
  private orders: { col: string; asc: boolean; nullsFirst?: boolean }[] = [];
  private lim: number | undefined;
  private from: number | undefined;
  private to: number | undefined;
  private mode: 'many' | 'single' | 'maybe' = 'many';
  private payload: Row | Row[] | undefined;
  private onConflict: string[] | undefined;
  private ignoreDuplicates = false;

  constructor(private readonly name: string) {}

  select(cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === 'select') {
      this.selectStr = cols;
      this.countMode = opts?.count;
      this.head = !!opts?.head;
    } else {
      this.returning = true;
      this.selectStr = cols;
    }
    return this;
  }
  insert(values: Row | Row[]) {
    this.op = 'insert';
    this.payload = values;
    return this;
  }
  upsert(values: Row | Row[], opts?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    this.op = 'upsert';
    this.payload = values;
    if (opts?.onConflict) this.onConflict = opts.onConflict.split(',').map((s) => s.trim());
    this.ignoreDuplicates = !!opts?.ignoreDuplicates;
    return this;
  }
  update(values: Row) {
    this.op = 'update';
    this.payload = values;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }

  private add(p: Pred) {
    this.preds.push(p);
    return this;
  }
  eq(c: string, v: any) { return this.add(opPred(c, 'eq', v)); }
  neq(c: string, v: any) { return this.add(opPred(c, 'neq', v)); }
  gt(c: string, v: any) { return this.add(opPred(c, 'gt', v)); }
  gte(c: string, v: any) { return this.add(opPred(c, 'gte', v)); }
  lt(c: string, v: any) { return this.add(opPred(c, 'lt', v)); }
  lte(c: string, v: any) { return this.add(opPred(c, 'lte', v)); }
  like(c: string, v: any) { return this.add(opPred(c, 'like', v)); }
  ilike(c: string, v: any) { return this.add(opPred(c, 'ilike', v)); }
  is(c: string, v: any) { return this.add(opPred(c, 'is', v)); }
  in(c: string, v: any[]) { return this.add(opPred(c, 'in', v)); }
  contains(c: string, v: any) { return this.add(opPred(c, 'contains', v)); }
  match(obj: Row) {
    Object.entries(obj).forEach(([c, v]) => this.add(opPred(c, 'eq', v)));
    return this;
  }
  not(c: string, op: string, v: any) {
    const p = opPred(c, op, v);
    return this.add((r) => !p(r));
  }
  or(expr: string) { return this.add(parseLogic(expr, 'or')); }
  filter(c: string, op: string, v: any) {
    if (op.startsWith('not.')) return this.not(c, op.slice(4), v);
    return this.add(opPred(c, op, v));
  }
  textSearch(c: string, q: string) { return this.add(opPred(c, 'ilike', `%${q}%`)); }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean; foreignTable?: string; referencedTable?: string }) {
    if (!opts?.foreignTable && !opts?.referencedTable) {
      this.orders.push({ col, asc: opts?.ascending !== false, nullsFirst: opts?.nullsFirst });
    }
    return this;
  }
  limit(n: number, opts?: { foreignTable?: string; referencedTable?: string }) {
    if (!opts?.foreignTable && !opts?.referencedTable) this.lim = n;
    return this;
  }
  range(from: number, to: number) {
    this.from = from;
    this.to = to;
    return this;
  }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }
  abortSignal() { return this; }
  returns() { return this; }
  throwOnError() { return this; }
  overrideTypes() { return this; }

  private matches(): Row[] {
    return table(this.name).filter((r) => this.preds.every((p) => p(r)));
  }

  private shape(rows: Row[]): Result {
    const fields = parseSelect(this.selectStr);
    let data = rows.map((r) => project(this.name, r, fields)).filter(Boolean) as Row[];
    const count = this.countMode ? data.length : null;
    if (this.op === 'select') {
      for (const o of [...this.orders].reverse()) {
        data = [...data].sort((a, b) => {
          const av = a[o.col];
          const bv = b[o.col];
          if (av == null && bv == null) return 0;
          if (av == null) return o.nullsFirst ? -1 : 1;
          if (bv == null) return o.nullsFirst ? 1 : -1;
          const c = cmp(av, bv);
          return o.asc ? c : -c;
        });
      }
      if (this.from !== undefined) data = data.slice(this.from, (this.to ?? data.length) + 1);
      if (this.lim !== undefined) data = data.slice(0, this.lim);
    }
    if (this.head) return ok(null, count);
    if (this.op !== 'select' && !this.returning) return ok(null, count);
    if (this.mode === 'single') {
      if (data.length !== 1) {
        return {
          data: null,
          error: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
            details: `The result contains ${data.length} rows`,
            hint: null,
          },
          count,
          status: 406,
          statusText: 'Not Acceptable',
        };
      }
      return ok(data[0], count);
    }
    if (this.mode === 'maybe') return ok(data[0] ?? null, count);
    return ok(data, count);
  }

  private withDefaults(row: Row): Row {
    const now = new Date().toISOString();
    const out: Row = { id: uuid(), created_at: now, updated_at: now, ...row };
    if (this.name === 'band_members' && out.is_active === undefined) out.is_active = true;
    if (this.name === 'notifications' && out.read === undefined) out.read = false;
    if (this.name === 'messages' && out.deleted === undefined) out.deleted = false;
    return out;
  }

  private run(): Result {
    const t = table(this.name);
    switch (this.op) {
      case 'select':
        return this.shape(this.matches());
      case 'insert': {
        const rows = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((r) => this.withDefaults(r));
        t.push(...rows);
        persist();
        return this.shape(rows);
      }
      case 'upsert': {
        const keys = this.onConflict ?? UNIQUE_KEYS[this.name] ?? ['id'];
        const out: Row[] = [];
        for (const r of Array.isArray(this.payload) ? this.payload : [this.payload!]) {
          const existing = keys.every((k) => r[k] !== undefined)
            ? t.find((x) => keys.every((k) => x[k] === r[k]))
            : undefined;
          if (existing) {
            if (!this.ignoreDuplicates) Object.assign(existing, r, { updated_at: new Date().toISOString() });
            out.push(existing);
          } else {
            const row = this.withDefaults(r);
            t.push(row);
            out.push(row);
          }
        }
        persist();
        return this.shape(out);
      }
      case 'update': {
        const rows = this.matches();
        for (const r of rows) Object.assign(r, this.payload, { updated_at: new Date().toISOString() });
        persist();
        return this.shape(rows);
      }
      case 'delete': {
        const rows = this.matches();
        const gone = new Set(rows);
        const kept = t.filter((r) => !gone.has(r));
        getDB()[this.name] = kept;
        persist();
        return this.shape(rows);
      }
    }
  }

  then<A = Result, B = never>(
    onFulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: any) => B | PromiseLike<B>) | null
  ): Promise<A | B> {
    let res: Result;
    try {
      res = this.run();
    } catch (e: any) {
      res = { data: null, error: { message: String(e?.message ?? e), code: 'DEMO' }, status: 500, statusText: 'Error' };
    }
    // Resolve on a later tick, like a network round-trip.
    return new Promise<Result>((r) => setTimeout(() => r(res), 40)).then(onFulfilled, onRejected);
  }
  catch<B = never>(onRejected?: ((reason: any) => B | PromiseLike<B>) | null) {
    return this.then(undefined, onRejected);
  }
  finally(cb?: (() => void) | null) {
    return this.then(
      (v) => { cb?.(); return v; },
      (e) => { cb?.(); throw e; }
    );
  }
}

const ok = (data: any, count: number | null = null): Result => ({ data, error: null, count, status: 200, statusText: 'OK' });

// -------------------------------------------------------------------- auth --

type AuthListener = (event: string, session: any) => void;
const listeners = new Set<AuthListener>();

const makeSession = () => ({
  access_token: 'demo-access-token',
  refresh_token: 'demo-refresh-token',
  token_type: 'bearer',
  expires_in: 3600 * 24,
  expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
  user: DEMO_USER,
});

const isSignedIn = () => readLS(SESSION_KEY) === '1';
const emit = (event: string) => {
  const s = isSignedIn() ? makeSession() : null;
  listeners.forEach((cb) => {
    try {
      cb(event, s);
    } catch (e) {
      console.error('[demo] auth listener failed', e);
    }
  });
};

const signInDemo = async () => {
  writeLS(SESSION_KEY, '1');
  getDB();
  setTimeout(() => emit('SIGNED_IN'), 0);
  return { data: { user: DEMO_USER, session: makeSession() }, error: null };
};

const auth = {
  getSession: async () => ({ data: { session: isSignedIn() ? makeSession() : null }, error: null }),
  getUser: async () => ({ data: { user: isSignedIn() ? DEMO_USER : null }, error: null }),
  refreshSession: async () => ({ data: { session: isSignedIn() ? makeSession() : null, user: DEMO_USER }, error: null }),
  onAuthStateChange: (cb: AuthListener) => {
    listeners.add(cb);
    return { data: { subscription: { id: uuid(), callback: cb, unsubscribe: () => listeners.delete(cb) } } };
  },
  // Any email/password opens the demo account.
  signInWithPassword: async () => signInDemo(),
  signUp: async () => signInDemo(),
  signInWithOAuth: async () => {
    await signInDemo();
    return { data: { provider: 'demo', url: null }, error: null };
  },
  signInWithOtp: async () => ({ data: {}, error: null }),
  signOut: async () => {
    writeLS(SESSION_KEY, null);
    writeLS(DB_KEY, null);
    db = null;
    setTimeout(() => emit('SIGNED_OUT'), 0);
    return { error: null };
  },
  resetPasswordForEmail: async () => ({ data: {}, error: null }),
  updateUser: async (attrs: Row) => {
    if (attrs?.data) Object.assign(DEMO_USER.user_metadata, attrs.data);
    return { data: { user: DEMO_USER }, error: null };
  },
  exchangeCodeForSession: async () => signInDemo(),
  setSession: async () => signInDemo(),
  verifyOtp: async () => signInDemo(),
};

// ---------------------------------------------------- realtime / storage --

/**
 * Demo channels: database changes never arrive, but broadcast and presence
 * reach the other tabs of the same demo (BroadcastChannel), so two tabs can
 * try live features such as Stage mode's "follow the leader".
 */
const makeChannel = (name: string) => {
  const handlers: { type: string; event?: string; cb: (msg: any) => void }[] = [];
  let bc: BroadcastChannel | null = null;
  const key = Math.random().toString(36).slice(2);
  const open = () => {
    if (bc || typeof BroadcastChannel === 'undefined') return bc;
    bc = new BroadcastChannel(`bw-demo-rt:${name}`);
    bc.onmessage = (e: MessageEvent) => {
      const m = e.data || {};
      for (const h of handlers) {
        if (m.kind === 'broadcast' && h.type === 'broadcast' && (!h.event || h.event === '*' || h.event === m.event)) {
          h.cb({ type: 'broadcast', event: m.event, payload: m.payload });
        } else if (m.kind === 'join' && h.type === 'presence' && h.event === 'join') {
          h.cb({ event: 'join', key: m.key, newPresences: [m.meta], currentPresences: [] });
        }
      }
    };
    return bc;
  };
  const ch: any = {
    topic: name,
    on: (type: string, filter: { event?: string } | undefined, cb: (msg: any) => void) => {
      if ((type === 'broadcast' || type === 'presence') && typeof cb === 'function') {
        handlers.push({ type, event: filter?.event, cb });
      }
      return ch;
    },
    subscribe: (cb?: (status: string) => void) => {
      if (handlers.length > 0) open();
      setTimeout(() => cb?.('SUBSCRIBED'), 0);
      return ch;
    },
    unsubscribe: async () => {
      bc?.close();
      bc = null;
      return 'ok';
    },
    send: async (msg: { type?: string; event?: string; payload?: unknown }) => {
      if (msg?.type === 'broadcast') open()?.postMessage({ kind: 'broadcast', event: msg.event, payload: msg.payload });
      return 'ok';
    },
    track: async (meta?: unknown) => {
      open()?.postMessage({ kind: 'join', key, meta: meta ?? {} });
      return 'ok';
    },
    untrack: async () => 'ok',
    presenceState: () => ({}),
  };
  return ch;
};

const storage = {
  from: (bucket: string) => ({
    upload: async (path: string) => ({ data: { path, id: uuid(), fullPath: `${bucket}/${path}` }, error: null }),
    update: async (path: string) => ({ data: { path }, error: null }),
    remove: async () => ({ data: [], error: null }),
    list: async () => ({ data: [], error: null }),
    download: async () => ({ data: null, error: { message: 'Not available in demo mode' } }),
    getPublicUrl: () => ({ data: { publicUrl: '' } }),
    createSignedUrl: async () => ({ data: { signedUrl: '' }, error: null }),
  }),
};

// -------------------------------------------------------------------- rpc --

const rpc = (fn: string, args: Row = {}) => {
  let data: any = null;
  let error: any = null;
  switch (fn) {
    case 'generate_quote_number': {
      const n = table('quotes').length + 1;
      data = `Q-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;
      break;
    }
    case 'bw_my_pending_invitations':
      data = [];
      break;
    case 'bw_preview_invitation':
    case 'bw_accept_invitation':
    case 'bw_decline_invitation':
      error = { message: 'Invitations are not available in demo mode', code: 'DEMO' };
      break;
    case 'bw_search_invitable_users': {
      const q = String(args.p_query ?? '').trim().toLowerCase();
      const members = new Set(table('band_members').filter((r) => r.band_id === args.p_band_id).map((r) => r.user_id));
      data = q.length < 3 ? [] : table('profiles')
        .filter((p) => p.id !== DEMO_USER.id && !members.has(p.id))
        .filter((p) => String(p.email ?? '').toLowerCase() === q || String(p.full_name ?? '').toLowerCase().includes(q))
        .slice(0, 8)
        .map((p) => {
          const email = String(p.email ?? '');
          const exact = email.toLowerCase() === q;
          return {
            id: p.id,
            full_name: p.full_name ?? null,
            avatar_url: p.avatar_url ?? null,
            email_hint: exact ? email : `${email.split('@')[0].slice(0, 2)}•••@${email.split('@')[1] ?? ''}`,
            email_exact: exact,
          };
        });
      break;
    }
    case 'bw_mark_chats_delivered':
      data = 0;
      break;
    // Member stats (083): every member for an admin, own row otherwise.
    case 'bw_member_stats': {
      const bandId = args.p_band_id;
      const from = String(args.p_from ?? '');
      const to = String(args.p_to ?? '');
      const members = table('band_members').filter((r) => r.band_id === bandId && r.user_id);
      const me = members.find((r) => r.user_id === DEMO_USER.id);
      const isAdmin = me?.role === 'admin' && me?.is_active !== false;
      const events = new Map(
        table('events')
          .filter((e) => e.band_id === bandId && e.event_date >= from && e.event_date <= to)
          .map((e) => [e.id, e]),
      );
      const rows = table('event_members')
        .filter((em) => events.has(em.event_id))
        .map((em) => {
          const e = events.get(em.event_id)!;
          return {
            user_id: String(em.user_id), answer: em.status, fee: em.fee, paid_at: em.paid_at,
            event_date: String(e.event_date), event_type: e.event_type, event_status: e.status,
          };
        });
      const visible = (isAdmin ? members : members.filter((r) => r.user_id === DEMO_USER.id))
        .map((r) => ({ user_id: String(r.user_id), is_active: r.is_active !== false }));
      data = memberStatsFromRows(rows, visible, String(args.p_today ?? new Date().toISOString().slice(0, 10)));
      break;
    }
    // Fees and payouts (071). The demo user is the band admin.
    case 'bw_event_member_money': {
      const ids: string[] | null = Array.isArray(args.p_event_ids) ? args.p_event_ids : null;
      data = table('event_members')
        .filter((r) => (ids ? ids.includes(r.event_id) : r.user_id === DEMO_USER.id))
        .map((r) => ({ event_id: r.event_id, user_id: r.user_id, fee: r.fee ?? 0, paid_at: r.paid_at ?? null }));
      break;
    }
    // Member fees (076): all rows of bands the user administers, own row elsewhere.
    case 'bw_band_member_fees': {
      const ids: string[] = Array.isArray(args.p_band_ids) ? args.p_band_ids : [];
      const members = table('band_members');
      const adminOf = new Set(members.filter((r) => r.user_id === DEMO_USER.id && r.role === 'admin').map((r) => r.band_id));
      data = members
        .filter((r) => ids.includes(r.band_id) && (r.user_id === DEMO_USER.id || adminOf.has(r.band_id)))
        .map((r) => ({ band_id: r.band_id, user_id: r.user_id, default_fee: r.default_fee ?? null, fee_percentage: r.fee_percentage ?? null }));
      break;
    }
    // Band banking, tax and pricing (077): bands the user administers only.
    case 'bw_band_private': {
      const ids: string[] = Array.isArray(args.p_band_ids) ? args.p_band_ids : [];
      const adminOf = new Set(table('band_members').filter((r) => r.user_id === DEMO_USER.id && r.role === 'admin').map((r) => r.band_id));
      const PRIVATE = [
        'pricing_settings', 'pricing_rules', 'extra_services', 'core_musician_fee', 'additional_musician_fee',
        'ceremony_musician_fee', 'cocktail_musician_fee', 'dj_hourly_rate', 'production_standard_fee',
        'production_pro_fee', 'production_extra_location_fee', 'travel_rate_per_km', 'default_payment_terms',
        'bank_account_holder', 'bank_iban', 'bank_bic_swift', 'bank_name', 'tax_vat_id', 'legal_company_name',
        'legal_address', 'signature_url', 'signer_name', 'signer_role', 'contact_email', 'contact_phone', 'stripe_customer_id',
      ];
      data = table('bands')
        .filter((b) => ids.includes(b.id) && adminOf.has(b.id))
        .map((b) => ({ band_id: b.id, private: Object.fromEntries(PRIVATE.map((k) => [k, b[k] ?? null])) }));
      break;
    }
    // Gig price, payments and client (078): events the user manages only.
    case 'bw_event_private': {
      const ids: string[] = Array.isArray(args.p_event_ids) ? args.p_event_ids : [];
      const adminOf = new Set(table('band_members').filter((r) => r.user_id === DEMO_USER.id && r.role === 'admin').map((r) => r.band_id));
      const PRIVATE = [
        'price', 'fee', 'pay', 'deposit_amount', 'deposit_paid', 'payment_status', 'client_name', 'client_email',
        'client_phone', 'client_company', 'internal_notes', 'contract_url', 'contract_signed',
      ];
      data = table('events')
        .filter((e) => ids.includes(e.id) && (e.band_id ? adminOf.has(e.band_id) : e.created_by === DEMO_USER.id))
        .map((e) => ({ event_id: e.id, private: Object.fromEntries(PRIVATE.map((k) => [k, e[k] ?? null])) }));
      break;
    }
    case 'bw_save_event_lineup': {
      const rows = table('event_members');
      const now = new Date().toISOString();
      const list: Row[] = Array.isArray(args.p_rows) ? args.p_rows : [];
      list.forEach((r) => {
        const existing = rows.find((x) => x.event_id === args.p_event_id && x.user_id === r.user_id);
        if (existing) {
          existing.role = r.role ?? null;
          existing.fee = r.fee ?? 0;
        } else {
          rows.push({ id: uuid(), created_at: now, event_id: args.p_event_id, user_id: r.user_id, role: r.role ?? null, fee: r.fee ?? 0, status: r.status ?? 'pending' });
        }
      });
      persist();
      data = list.length;
      break;
    }
    case 'bw_mark_event_paid': {
      const now = new Date().toISOString();
      data = table('event_members')
        .filter((r) => r.event_id === args.p_event_id && !r.paid_at && r.status !== 'declined')
        .map((r) => {
          r.paid_at = now;
          return { user_id: r.user_id, paid_at: now };
        });
      persist();
      break;
    }
    case 'bw_mark_chat_read': {
      const now = new Date().toISOString();
      table('chat_participants')
        .filter((r) => r.chat_id === args.p_chat_id && r.user_id === DEMO_USER.id)
        .forEach((r) => { r.last_read_at = now; r.last_delivered_at = now; });
      persist();
      data = true;
      break;
    }
    // Deputy reply links (084): the request is real in the demo, the page is not.
    case 'bw_deputy_request_open': {
      const rows = table('deputy_requests');
      let r = rows.find((x) => x.event_id === args.p_event_id && x.deputy_id === args.p_deputy_id && x.status !== 'cancelled');
      if (!r) {
        const dep = table('band_deputies').find((x) => x.id === args.p_deputy_id);
        const ev = table('events').find((x) => x.id === args.p_event_id);
        const now = new Date().toISOString();
        r = {
          id: uuid(), band_id: ev?.band_id, event_id: args.p_event_id, deputy_id: args.p_deputy_id,
          deputy_name: dep?.name || 'Deputy', replaces_user_id: args.p_replaces_user_id ?? null,
          role: args.p_role ?? null, fee_offered: args.p_fee ?? null, currency: ev?.currency ?? null,
          token: (uuid() + uuid()).replace(/-/g, ''), status: 'pending', reply_note: null,
          responded_at: null, answer_snapshot: null, created_at: now, updated_at: now,
        };
        rows.push(r);
        persist();
      }
      data = [{ id: r.id, token: r.token, status: r.status }];
      break;
    }
    case 'bw_deputy_request_view':
      data = { changes: [] };
      break;
    case 'update_setlist_song_count': {
      const id = args.p_setlist_id ?? args.setlist_id;
      const s = table('setlists').find((r) => r.id === id);
      if (s) s.song_count = table('setlist_songs').filter((r) => r.setlist_id === id).length;
      persist();
      break;
    }
  }
  const res = { data, error, count: null, status: error ? 400 : 200, statusText: error ? 'Bad Request' : 'OK' };
  const p: any = Promise.resolve(res);
  // rpc() is sometimes chained with .single()/.maybeSingle().
  p.single = () => p;
  p.maybeSingle = () => p;
  p.select = () => p;
  return p;
};

// ------------------------------------------------------------------ client --

export const createDemoClient = () => {
  const channels = new Set<any>();
  return {
    from: (name: string) => new DemoQuery(name),
    rpc,
    auth,
    storage,
    functions: {
      invoke: async () => ({ data: { success: true, demo: true }, error: null }),
    },
    channel: (name: string) => {
      const ch = makeChannel(name);
      channels.add(ch);
      return ch;
    },
    removeChannel: async (ch: any) => {
      channels.delete(ch);
      await ch?.unsubscribe?.();
      return 'ok';
    },
    removeAllChannels: async () => {
      await Promise.all([...channels].map((ch) => ch?.unsubscribe?.()));
      channels.clear();
      return [];
    },
    getChannels: () => [...channels],
  };
};
