import { describe, it, expect, vi, beforeEach } from 'vitest';

type Call = { table: string; op: string; payload?: any; filters: [string, any][]; selected: boolean };
type Handler = (call: Call) => { data?: any; error?: any };

const calls: Call[] = [];
let handler: Handler = () => ({ data: null, error: null });

/** Minimal chainable stand-in for the PostgREST builder: records each query. */
const builder = (table: string) => {
  const call: Call = { table, op: 'select', filters: [], selected: false };
  const b: any = {
    select: () => ((call.selected = true), b),
    insert: (v: any) => ((call.op = 'insert'), (call.payload = v), b),
    update: (v: any) => ((call.op = 'update'), (call.payload = v), b),
    delete: () => ((call.op = 'delete'), b),
    eq: (c: string, v: any) => (call.filters.push([c, v]), b),
    order: () => b,
    single: () => b,
    maybeSingle: () => b,
    then: (res: any, rej: any) => {
      calls.push(call);
      const out = handler(call);
      return Promise.resolve({ data: out.data ?? null, error: out.error ?? null }).then(res, rej);
    },
  };
  return b;
};

vi.mock('@/lib/supabase', () => ({ supabase: { from: (t: string) => builder(t) } }));
vi.mock('../../supabase', () => ({ supabase: { from: (t: string) => builder(t) } }));

import {
  buildContractPdfBytes,
  buildSendMessage,
  contractFileName,
  createContract,
  deleteContract,
  effectiveStatus,
  mailtoUrl,
  markContractSent,
  markContractSigned,
  toWinAnsi,
  wrapText,
  type Contract,
} from '../contracts';
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  insertStarterTemplates,
  listTemplates,
  updateTemplate,
  STARTER_TEMPLATES,
} from '../taskTemplates';
import {
  canonicalCategory,
  createInventoryItem,
  deleteInventoryItem,
  INVENTORY_CATEGORIES,
  toInventoryRow,
  updateInventoryItem,
} from '../inventory';

beforeEach(() => {
  calls.length = 0;
  handler = () => ({ data: null, error: null });
});

const contract = (over: Partial<Contract> = {}): Contract => ({
  id: 'c1',
  band_id: 'b1',
  title: 'Wedding (Gala) agreement',
  type: 'contract',
  status: 'draft',
  client_name: 'Giulia Bianchi',
  client_email: 'giulia@example.com',
  event_name: 'Giulia & Marco',
  event_date: '2026-12-01',
  content: 'Load-in 16:00.\nFee: €2.500 — 50% deposit.',
  created_at: '2026-11-01T10:00:00Z',
  ...over,
});

const ascii = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

// ---------------------------------------------------------------- contracts --

describe('contract PDF', () => {
  it('builds a valid PDF with correct xref offsets and the document text', () => {
    const bytes = buildContractPdfBytes(contract(), { bandName: 'The Band', now: new Date(2026, 10, 10) });
    const s = ascii(bytes);
    expect(s.startsWith('%PDF-1.4')).toBe(true);
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true);
    const startxref = Number(/startxref\n(\d+)/.exec(s)![1]);
    expect(s.slice(startxref, startxref + 4)).toBe('xref');
    const entries = s.slice(startxref).split('\n').slice(3).filter((l) => / 00000 n $/.test(l));
    entries.forEach((line, i) => {
      const off = Number(line.slice(0, 10));
      expect(s.slice(off, off + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
    // Parentheses escaped, WinAnsi euro / em dash, notes included.
    expect(s).toContain('Wedding \\(Gala\\) agreement');
    expect(s).toContain('Fee: \x802.500 \x97 50% deposit.');
    expect(s).toContain('(Giulia Bianchi)');
    expect(s).toContain('CONTRACT');
    // Stream lengths match their content.
    for (const m of s.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
      const start = m.index! + m[0].length;
      expect(s.slice(start + Number(m[1]), start + Number(m[1]) + 10)).toBe('\nendstream');
    }
  });

  it('flows long notes onto more pages', () => {
    const long = Array.from({ length: 200 }, (_, i) => `Clause ${i + 1}: the band performs as agreed.`).join('\n');
    const s = ascii(buildContractPdfBytes(contract({ content: long, type: 'rider' })));
    const count = Number(/\/Count (\d+)/.exec(s)![1]);
    expect(count).toBeGreaterThan(1);
    expect(s).toContain(`Page ${count} of ${count}`);
    expect(s).toContain('TECHNICAL RIDER');
  });

  it('wraps and hard-splits text to the width', () => {
    const lines = wrapText(toWinAnsi('a '.repeat(200) + 'x'.repeat(300)), 12, 200);
    expect(lines.length).toBeGreaterThan(3);
    expect(toWinAnsi('ok 漢')).toBe('ok ?');
    expect(toWinAnsi('a\nb')).toBe('a\nb');
  });

  it('derives Expired for display only', () => {
    expect(effectiveStatus({ status: 'sent', event_date: '2026-01-01' }, '2026-11-10')).toBe('expired');
    expect(effectiveStatus({ status: 'draft', expires_at: '2026-11-09T00:00:00Z', event_date: '2027-01-01' }, '2026-11-10')).toBe('expired');
    expect(effectiveStatus({ status: 'signed', event_date: '2026-01-01' }, '2026-11-10')).toBe('signed');
    expect(effectiveStatus({ status: 'draft', event_date: '2026-12-01' }, '2026-11-10')).toBe('draft');
  });

  it('builds file name, message and mailto', () => {
    expect(contractFileName(contract())).toBe('Wedding_Gala_agreement.pdf');
    const { subject, body } = buildSendMessage(contract(), 'The Band');
    expect(subject).toBe('Wedding (Gala) agreement — The Band');
    expect(body).toContain('Hi Giulia Bianchi,');
    expect(body).toContain('signed');
    expect(mailtoUrl('a@b.co', 'S 1', 'x&y')).toBe('mailto:a%40b.co?subject=S%201&body=x%26y');
  });
});

describe('contract writes', () => {
  it('saves notes into content and blank optional fields as null', async () => {
    handler = () => ({ data: { id: 'new' } });
    const { data, error } = await createContract({
      bandId: 'b1', type: 'rider', title: ' Rider ', clientName: 'Venue', content: 'Two DI boxes', eventName: ' ', eventDate: '',
    });
    expect(error).toBeNull();
    expect(data).toEqual({ id: 'new' });
    expect(calls[0].payload).toMatchObject({
      band_id: 'b1', type: 'rider', status: 'draft', title: 'Rider', client_name: 'Venue',
      content: 'Two DI boxes', event_name: null, event_date: null, expires_at: null, client_email: null,
    });
  });

  it('returns insert errors instead of a local row', async () => {
    handler = () => ({ error: { message: 'new row violates row-level security policy' } });
    const { data, error } = await createContract({ bandId: 'b1', type: 'contract', title: 'T', clientName: 'C' });
    expect(data).toBeNull();
    expect(error?.message).toMatch(/row-level security/);
  });

  it('rejects an invalid client email before writing', async () => {
    const { error } = await createContract({ bandId: 'b1', type: 'contract', title: 'T', clientName: 'C', clientEmail: 'nope' });
    expect(error).not.toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('marks sent with sent_at + email, and signed with signed_at', async () => {
    handler = (c) => ({ data: [{ id: 'c1', ...c.payload }] });
    const now = new Date('2026-11-10T12:00:00Z');
    const sent = await markContractSent('c1', ' a@b.co ', now);
    expect(sent.data).toMatchObject({ status: 'sent', sent_at: now.toISOString(), client_email: 'a@b.co' });
    const signed = await markContractSigned('c1', now);
    expect(signed.data).toMatchObject({ status: 'signed', signed_at: now.toISOString() });
    expect(calls.every((c) => c.selected && c.filters[0][1] === 'c1')).toBe(true);
  });

  it('treats 0 updated / deleted rows (RLS) as errors', async () => {
    handler = () => ({ data: [] });
    expect((await markContractSigned('c1')).error).not.toBeNull();
    expect((await deleteContract('c1')).error).not.toBeNull();
    handler = () => ({ data: [{ id: 'c1' }] });
    expect((await deleteContract('c1')).error).toBeNull();
  });
});

// ----------------------------------------------------------- task templates --

describe('task templates', () => {
  it('updates the existing row on edit (no insert)', async () => {
    handler = (c) => ({ data: [{ id: 't1', band_id: 'b1', ...c.payload }] });
    const { data, error } = await updateTemplate('t1', {
      name: ' Festival ', description: '', category: 'festival', tasks: [{ id: 'x', title: 'Pack', dueOffset: -1, required: true }],
    });
    expect(error).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ table: 'task_templates', op: 'update', filters: [['id', 't1']] });
    expect(calls[0].payload).toEqual({
      name: 'Festival', description: null, category: 'festival', tasks: [{ id: 'x', title: 'Pack', dueOffset: -1, required: true }],
    });
    expect(data?.name).toBe('Festival');
  });

  it('duplicates by inserting a non-default copy', async () => {
    handler = (c) => ({ data: { id: 'copy', ...c.payload } });
    const { data } = await duplicateTemplate({
      id: 't1', band_id: 'b1', name: 'Wedding', description: 'd', category: 'wedding', tasks: [], is_default: true, created_at: '',
    });
    expect(calls[0].op).toBe('insert');
    expect(calls[0].payload).toMatchObject({ band_id: 'b1', name: 'Wedding (Copy)', is_default: false });
    expect(data?.id).toBe('copy');
  });

  it('surfaces create, delete and load errors', async () => {
    handler = () => ({ error: { message: 'boom' } });
    expect((await createTemplate('b1', { name: 'A', category: 'other', tasks: [] })).error?.message).toBe('boom');
    expect((await listTemplates('b1')).error?.message).toBe('boom');
    handler = () => ({ data: [] });
    expect((await deleteTemplate('t1')).error).not.toBeNull();
  });

  it('inserts the starter templates for real, tagged default', async () => {
    handler = (c) => ({ data: c.payload.map((r: any, i: number) => ({ id: `s${i}`, ...r })) });
    const { data } = await insertStarterTemplates('b1');
    expect(calls[0].payload).toHaveLength(STARTER_TEMPLATES.length);
    expect(calls[0].payload.every((r: any) => r.is_default === true && r.band_id === 'b1')).toBe(true);
    expect(data?.every((t) => t.is_default && t.tasks.length > 0)).toBe(true);
  });

  it('normalises task JSON from older rows', async () => {
    handler = () => ({ data: [{ id: 't9', band_id: 'b1', name: 'Old', category: 'weird', tasks: [{ title: 'A', due_offset: -3 }] }] });
    const { data } = await listTemplates('b1');
    expect(data?.[0]).toMatchObject({ category: 'other', description: '', tasks: [{ id: 't9-0', title: 'A', dueOffset: -3, required: false }] });
  });
});

// ---------------------------------------------------------------- inventory --

describe('inventory', () => {
  it('keeps the Figma category order, then the extra categories', () => {
    expect(INVENTORY_CATEGORIES).toEqual(['Instruments', 'Cables', 'Microphones', 'Stands', 'Lighting', 'Cases', 'Other']);
    expect(canonicalCategory('microphones')).toBe('Microphones');
  });

  it('writes status and the optional fields (no unknown columns)', async () => {
    handler = (c) => ({ data: { id: 'i1', ...c.payload } });
    await createInventoryItem('b1', {
      name: ' SM58 ', category: 'Microphones', quantity: 4, status: 'in_use', purchasePrice: '99,5', location: ' ', serialNumber: 'X1',
    });
    expect(calls[0].payload).toEqual({
      band_id: 'b1', name: 'SM58', category: 'Microphones', quantity: 4, status: 'in_use', location: null, notes: null,
      serial_number: 'X1', purchase_date: null, purchase_price: 99.5,
    });
  });

  it('validates before writing', () => {
    expect(toInventoryRow({ name: '', category: 'Other', quantity: 1, status: 'available' }).error).not.toBeNull();
    expect(toInventoryRow({ name: 'A', category: 'Other', quantity: 1, status: 'available', purchasePrice: 'abc' }).error).not.toBeNull();
  });

  it('updates by id and reports RLS-filtered writes', async () => {
    handler = (c) => (c.op === 'update' ? { data: [{ id: 'i1', ...c.payload }] } : { data: [] });
    const { data } = await updateInventoryItem('i1', { name: 'Amp', category: 'Other', quantity: 0, status: 'maintenance' });
    expect(data).toMatchObject({ id: 'i1', status: 'maintenance', quantity: 0 });
    expect(calls[0].filters).toEqual([['id', 'i1']]);
    expect((await deleteInventoryItem('i1')).error).not.toBeNull();
  });
});
