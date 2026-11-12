import { supabase } from '../supabase';
import { parseLocalDate, toLocalDateString, todayLocal } from '../dates';
import { t } from '@/lib/i18n';

/* ─────────────────────────────────────────────────────────────────────────
 * Contracts & riders (table `contracts`, migration 006).
 * Every write returns the error instead of throwing, and writes that RLS
 * silently filters (0 rows touched) are reported as errors too, so the UI
 * never diverges from the database.
 * ───────────────────────────────────────────────────────────────────────── */

export type ContractStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'expired';
export type ContractType = 'contract' | 'rider';

export interface Contract {
  id: string;
  band_id: string;
  event_id?: string | null;
  title: string;
  /** 'contract' | 'rider' (older rows may carry other values: treated as contracts). */
  type: string;
  status: ContractStatus;
  event_name?: string | null;
  event_date?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  /** Notes & terms entered on creation. */
  content?: string | null;
  file_url?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  signed_at?: string | null;
  expires_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface NewContractInput {
  bandId: string;
  type: ContractType;
  title: string;
  clientName: string;
  clientEmail?: string;
  eventName?: string;
  eventDate?: string;
  /** "Valid until" (YYYY-MM-DD). */
  expiresOn?: string;
  content?: string;
  /** Band event the document belongs to (optional). */
  eventId?: string | null;
}

export type ContractEdits = Omit<NewContractInput, 'bandId'>;

type Result<T> = { data: T | null; error: Error | null };

const noRowsMessage = () => t("This change wasn't saved: only band admins can manage contracts and riders.");

export const errorMessage = (err: unknown, fallback = t('Something went wrong. Please try again.')): string => {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  const e = err as { message?: string; details?: string };
  return e.message || e.details || fallback;
};

const asError = (err: unknown, fallback?: string) => new Error(errorMessage(err, fallback));

const blankToNull = (v?: string | null) => {
  const trimmed = (v ?? '').trim();
  return trimmed ? trimmed : null;
};

export const isRider = (c: Pick<Contract, 'type'>) => c.type === 'rider';

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

const dateOnly = (value?: string | null): string | null => {
  if (!value) return null;
  return value.includes('T') ? value.slice(0, 10) : value;
};

/**
 * Status to display. Signed stays signed. A document is shown as expired when
 * its status says so, when its "valid until" date has passed, or when the event
 * date has passed while it was still unsigned. Display only: nothing is written.
 */
export const effectiveStatus = (c: Pick<Contract, 'status' | 'expires_at' | 'event_date'>, today = todayLocal()): ContractStatus => {
  if (c.status === 'signed' || c.status === 'expired') return c.status;
  const expires = dateOnly(c.expires_at);
  if (expires && expires < today) return 'expired';
  const event = dateOnly(c.event_date);
  if (event && event < today) return 'expired';
  return c.status;
};

// ------------------------------------------------------------------ CRUD --

export async function listContracts(bandId: string): Promise<Result<Contract[]>> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('band_id', bandId)
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: asError(error, t('Could not load documents.')) };
  return { data: (data || []) as Contract[], error: null };
}

export async function createContract(input: NewContractInput): Promise<Result<Contract>> {
  const title = input.title.trim();
  const clientName = input.clientName.trim();
  if (!title || !clientName) return { data: null, error: new Error(t('Add a title and a client.')) };
  const email = blankToNull(input.clientEmail);
  if (email && !isValidEmail(email)) return { data: null, error: new Error(t('Enter a valid client email.')) };

  const { data, error } = await supabase
    .from('contracts')
    .insert({
      band_id: input.bandId,
      type: input.type,
      status: 'draft',
      title,
      client_name: clientName,
      client_email: email,
      event_name: blankToNull(input.eventName),
      event_date: blankToNull(input.eventDate),
      expires_at: blankToNull(input.expiresOn),
      content: blankToNull(input.content),
      event_id: input.eventId || null,
    })
    .select()
    .single();
  if (error) return { data: null, error: asError(error, t('Could not create the document.')) };
  if (!data) return { data: null, error: new Error(noRowsMessage()) };
  return { data: data as Contract, error: null };
}

/** Updates one row and returns it; 0 rows (RLS) is an error. */
export async function updateContract(id: string, patch: Partial<Contract>): Promise<Result<Contract>> {
  const { data, error } = await supabase.from('contracts').update(patch).eq('id', id).select();
  if (error) return { data: null, error: asError(error, t('Could not update the document.')) };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { data: null, error: new Error(noRowsMessage()) };
  return { data: row as Contract, error: null };
}

/** Saves the edit form; same checks as on creation. */
export async function saveContractEdits(id: string, input: ContractEdits): Promise<Result<Contract>> {
  const title = input.title.trim();
  const clientName = input.clientName.trim();
  if (!title || !clientName) return { data: null, error: new Error(t('Add a title and a client.')) };
  const email = blankToNull(input.clientEmail);
  if (email && !isValidEmail(email)) return { data: null, error: new Error(t('Enter a valid client email.')) };
  return updateContract(id, {
    type: input.type,
    title,
    client_name: clientName,
    client_email: email,
    event_name: blankToNull(input.eventName),
    event_date: blankToNull(input.eventDate),
    expires_at: blankToNull(input.expiresOn),
    content: blankToNull(input.content),
    event_id: input.eventId || null,
  });
}

/** Upcoming band events a document can be linked to (gigs, no rehearsals). */
export interface LinkableEvent {
  id: string;
  title: string;
  event_date: string | null;
  client_name: string | null;
  client_email: string | null;
  venue_name: string | null;
}

export async function listLinkableEvents(bandId: string, fromDate = todayLocal()): Promise<LinkableEvent[]> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, event_date, client_name, client_email, venue_name, event_type')
      .eq('band_id', bandId)
      .gte('event_date', fromDate)
      .order('event_date', { ascending: true })
      .limit(20);
    if (error || !data) return [];
    return (data as any[])
      .filter((e) => e.event_type !== 'rehearsal')
      .slice(0, 12)
      .map((e) => ({
        id: e.id,
        title: e.title || 'Untitled event',
        event_date: e.event_date ?? null,
        client_name: e.client_name ?? null,
        client_email: e.client_email ?? null,
        venue_name: e.venue_name ?? null,
      }));
  } catch {
    return [];
  }
}

/** Starting text for "Notes & terms"; the band edits it to fit the gig. */
export const STANDARD_TERMS: Record<ContractType, string> = {
  contract: [
    'Performance: the band performs live at the event on the date and times agreed.',
    'Fee & payment: a deposit confirms the booking; the balance is due on the event date. The deposit is non-refundable if the client cancels.',
    'Cancellation: if the client cancels less than 30 days before the event, the full fee is due.',
    'Venue: the client provides safe access for load-in, a stage area, power near the stage and a secure place for equipment.',
    'Hospitality: meals and soft drinks for the band and crew, plus parking for the band vehicles.',
    'Breaks & overtime: sets include short breaks; extra time on the day is charged at the agreed rate.',
    'Recordings: no professional audio or video recording without the band’s written consent.',
    'Force majeure: neither party is liable for cancellations caused by events beyond their control.',
  ].join('\n\n'),
  rider: [
    'Stage: minimum 6 × 4 m, level and covered if outdoors.',
    'Power: two separate 16 A outlets on the stage, on a circuit not shared with catering or lighting.',
    'Sound: PA suited to the room with monitor mixes for each musician, or time to set up the band’s own system.',
    'Times: access for load-in and setup 2 hours before the start; soundcheck before guests arrive.',
    'Backstage: a private, lockable room with mirror, seating and water.',
    'Hospitality: meals and soft drinks for the band and crew.',
    'Parking: spaces for the band vehicles close to the loading point.',
  ].join('\n\n'),
};

export const markContractSent = (id: string, clientEmail?: string | null, now = new Date()) =>
  updateContract(id, {
    status: 'sent',
    sent_at: now.toISOString(),
    ...(clientEmail ? { client_email: clientEmail.trim() } : {}),
  });

export const markContractSigned = (id: string, now = new Date()) =>
  updateContract(id, { status: 'signed', signed_at: now.toISOString() });

export async function deleteContract(id: string): Promise<{ error: Error | null }> {
  const { data, error } = await supabase.from('contracts').delete().eq('id', id).select('id');
  if (error) return { error: asError(error, t('Could not delete the document.')) };
  if (!data || (Array.isArray(data) && data.length === 0)) return { error: new Error(noRowsMessage()) };
  return { error: null };
}

/** Band name for the PDF header (optional: returns null on any failure). */
export async function fetchBandName(bandId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('bands').select('name').eq('id', bandId).maybeSingle();
    return (data as { name?: string } | null)?.name ?? null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------ formatting --

export const STATUS_LABEL: Record<ContractStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  signed: 'Signed',
  expired: 'Expired',
};

export const formatContractDate = (value?: string | null): string => {
  if (!value) return '';
  const d = parseLocalDate(dateOnly(value) || value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const contractFileName = (c: Pick<Contract, 'title' | 'type'>) => {
  const base = c.title.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '_').slice(0, 80);
  return `${base || (isRider(c) ? 'Rider' : 'Contract')}.pdf`;
};

/** Subject + body for the client email / share sheet. */
export const buildSendMessage = (c: Contract, bandName?: string | null) => {
  const kind = isRider(c) ? 'technical rider' : 'contract';
  const subject = `${c.title}${bandName ? ` — ${bandName}` : ''}`;
  const lines = [
    `Hi${c.client_name ? ` ${c.client_name}` : ''},`,
    '',
    `Please find attached the ${kind} "${c.title}"${c.event_date ? ` for ${c.event_name ? `${c.event_name} on ` : 'the event on '}${formatContractDate(c.event_date)}` : c.event_name ? ` for ${c.event_name}` : ''}.`,
    isRider(c) ? 'Let us know if anything needs adjusting.' : 'Please review it and send it back signed.',
    '',
    'Best regards,',
    bandName || '',
  ];
  return { subject, body: lines.join('\n').trimEnd() };
};

export const mailtoUrl = (to: string, subject: string, body: string) =>
  `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

// ------------------------------------------------------------------- PDF --
// Text-based PDF 1.4 with the standard Helvetica fonts: no dependencies, no
// canvas, selectable text and a few KB in size.

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Helvetica / Helvetica-Bold advance widths for ASCII 32..126 (AFM, 1/1000 em).
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const HELV_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611,
  611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** WinAnsiEncoding code points outside Latin-1. */
const WIN_ANSI: Record<string, number> = {
  '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c,
  'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99, 'š': 0x9a,
  '›': 0x9b, 'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
};

/** Maps a JS string to WinAnsi byte values (one char per byte). */
export const toWinAnsi = (text: string): string => {
  let out = '';
  for (const ch of text.normalize('NFC')) {
    const code = ch.codePointAt(0)!;
    if (ch === '\n') out += '\n';
    else if (ch === '\t') out += '    ';
    else if (code >= 32 && code < 127) out += ch;
    else if (code >= 0xa0 && code <= 0xff) out += String.fromCharCode(code);
    else if (WIN_ANSI[ch] != null) out += String.fromCharCode(WIN_ANSI[ch]);
    else if (code >= 32) out += '?';
  }
  return out;
};

const charWidth = (code: number, bold: boolean) => {
  if (code >= 32 && code <= 126) return (bold ? HELV_BOLD : HELV)[code - 32];
  return 556;
};

/** Width in points of WinAnsi text. */
export const textWidth = (winAnsi: string, size: number, bold = false) => {
  let w = 0;
  for (let i = 0; i < winAnsi.length; i++) w += charWidth(winAnsi.charCodeAt(i), bold);
  return (w * size) / 1000;
};

/** Word-wraps WinAnsi text to `maxWidth`; blank lines are kept, long words are split. */
export const wrapText = (winAnsi: string, size: number, maxWidth: number, bold = false): string[] => {
  const lines: string[] = [];
  for (const para of winAnsi.replace(/\r\n?/g, '\n').split('\n')) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    let current = '';
    for (const rawWord of para.split(/ +/)) {
      let word = rawWord;
      while (textWidth(word, size, bold) > maxWidth) {
        // Hard-split a word longer than the line.
        let cut = word.length - 1;
        while (cut > 1 && textWidth(word.slice(0, cut), size, bold) > maxWidth) cut--;
        if (current) {
          lines.push(current);
          current = '';
        }
        lines.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const test = current ? `${current} ${word}` : word;
      if (textWidth(test, size, bold) <= maxWidth) current = test;
      else {
        if (current) lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
};

const pdfString = (winAnsi: string) => `(${winAnsi.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')})`;

const n = (v: number) => (Math.round(v * 100) / 100).toString();

interface PdfOptions {
  bandName?: string | null;
  /** Generation date (tests pass a fixed one). */
  now?: Date;
}

/** Builds the PDF bytes (each char of the returned string is one byte). */
export const buildContractPdfBytes = (c: Contract, opts: PdfOptions = {}): Uint8Array => {
  const now = opts.now ?? new Date();
  const pages: string[][] = [];
  let ops: string[] = [];
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    ops = [];
    pages.push(ops);
    y = PAGE_H - MARGIN;
  };
  const ensure = (height: number) => {
    if (y - height < MARGIN + 28) newPage();
  };
  const text = (s: string, x: number, size: number, bold = false, gray = 0) => {
    ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${gray} g ${n(x)} ${n(y)} Td ${pdfString(s)} Tj ET`);
  };
  const rule = (gray = 0.82) => {
    ops.push(`${gray} G 0.75 w ${n(MARGIN)} ${n(y)} m ${n(PAGE_W - MARGIN)} ${n(y)} l S`);
  };

  newPage();

  // Header: band name + document kind.
  const kind = isRider(c) ? 'TECHNICAL RIDER' : 'CONTRACT';
  text(toWinAnsi((opts.bandName || '').toUpperCase()), MARGIN, 10, true, 0.35);
  const kindW = textWidth(kind, 10, true);
  text(kind, PAGE_W - MARGIN - kindW, 10, true, 0.35);
  y -= 34;

  // Title (wrapped).
  for (const line of wrapText(toWinAnsi(c.title), 24, CONTENT_W, true)) {
    ensure(30);
    text(line, MARGIN, 24, true);
    y -= 30;
  }
  y -= 4;
  const status = effectiveStatus(c, toLocalDateString(now));
  text(toWinAnsi(`Status: ${STATUS_LABEL[status]}`), MARGIN, 11, false, 0.35);
  y -= 18;
  rule();
  y -= 26;

  // Details.
  const rows: [string, string | null | undefined][] = [
    ['Document type', isRider(c) ? 'Rider' : 'Contract'],
    ['Client', c.client_name],
    ['Client email', c.client_email],
    ['Event', c.event_name],
    ['Event date', formatContractDate(c.event_date)],
    ['Valid until', formatContractDate(c.expires_at)],
    ['Sent', formatContractDate(c.sent_at)],
    ['Signed', formatContractDate(c.signed_at)],
  ];
  const labelW = 120;
  for (const [label, value] of rows) {
    if (!value) continue;
    const lines = wrapText(toWinAnsi(value), 12, CONTENT_W - labelW);
    ensure(lines.length * 17 + 4);
    text(toWinAnsi(label.toUpperCase()), MARGIN, 9, true, 0.45);
    for (const line of lines) {
      text(line, MARGIN + labelW, 12);
      y -= 17;
    }
    y -= 4;
  }

  // Notes & terms.
  if (c.content && c.content.trim()) {
    y -= 10;
    ensure(60);
    rule();
    y -= 26;
    text(isRider(c) ? 'REQUIREMENTS & NOTES' : 'NOTES & TERMS', MARGIN, 10, true, 0.35);
    y -= 22;
    for (const line of wrapText(toWinAnsi(c.content.trim()), 11.5, CONTENT_W)) {
      ensure(16);
      if (line) text(line, MARGIN, 11.5);
      y -= 16;
    }
  }

  // Signature block for contracts.
  if (!isRider(c)) {
    y -= 24;
    ensure(80);
    y -= 40;
    const half = (CONTENT_W - 32) / 2;
    ops.push(`0.6 G 0.75 w ${n(MARGIN)} ${n(y)} m ${n(MARGIN + half)} ${n(y)} l S`);
    ops.push(`0.6 G 0.75 w ${n(MARGIN + half + 32)} ${n(y)} m ${n(PAGE_W - MARGIN)} ${n(y)} l S`);
    y -= 14;
    text(toWinAnsi(opts.bandName ? `For ${opts.bandName}` : 'Band'), MARGIN, 9, false, 0.45);
    text(toWinAnsi(c.client_name ? `For ${c.client_name}` : 'Client'), MARGIN + half + 32, 9, false, 0.45);
  }

  // Footer on every page.
  const generated = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  pages.forEach((p, i) => {
    const left = toWinAnsi(`Generated with BandWith · ${generated}`);
    const right = `Page ${i + 1} of ${pages.length}`;
    p.push(`BT /F1 8 Tf 0.5 g ${n(MARGIN)} ${n(MARGIN - 20)} Td ${pdfString(left)} Tj ET`);
    p.push(`BT /F1 8 Tf 0.5 g ${n(PAGE_W - MARGIN - textWidth(right, 8))} ${n(MARGIN - 20)} Td ${pdfString(right)} Tj ET`);
  });

  // Assemble: 1 Catalog, 2 Pages, 3 F1, 4 F2, 5 Info, then Page + Contents per page.
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 6 + i * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  objects[5] = `<< /Title ${pdfString(toWinAnsi(c.title))} /Producer (BandWith) >>`;
  pages.forEach((p, i) => {
    const pageId = pageIds[i];
    const stream = p.join('\n');
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`;
    objects[pageId + 1] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
  return bytes;
};

export const buildContractPdf = (c: Contract, opts: PdfOptions = {}): Blob =>
  new Blob([buildContractPdfBytes(c, opts) as BlobPart], { type: 'application/pdf' });
