// What a client sees of a quote on /quote.html (migration 099).
// The app builds it (src/lib/services/quoteLinks.ts) from the same numbers
// and labels as the PDF, already in the client's language, and publishes
// it with bw_quote_link_publish. Only client-facing data: never the
// musicians, their fees or the band's internal notes.

export interface ClientQuoteItem {
  label: string;
  detail?: string | null;
  /** null = included. */
  amount: number | null;
}

export interface ClientQuoteOption {
  label: string;
  detail?: string | null;
  total: number;
}

export interface ClientQuoteSnapshot {
  v: 1;
  ref: string;
  title: string;
  eventType?: string | null;
  /** YYYY-MM-DD */
  date?: string | null;
  /** HH:MM, 24h */
  start?: string | null;
  end?: string | null;
  venue?: string | null;
  city?: string | null;
  guests?: number | null;
  lineup?: string | null;
  sets?: string | null;
  items: ClientQuoteItem[];
  currency: string;
  subtotal: number;
  discount: number;
  discountNote?: string | null;
  net: number;
  vatLabel: string;
  vat: number;
  total: number;
  /** The total as text, for notifications ("€1,200.00"). */
  totalLabel: string;
  deposit?: { percent: number; amount: number } | null;
  validUntil?: string | null;
  notes?: string | null;
  terms?: string | null;
  /** Package options shown side by side in the PDF summary page. */
  options?: ClientQuoteOption[];
}

export type QuoteLinkStatus = 'draft' | 'sent' | 'viewed' | 'discussing' | 'accepted' | 'declined';

export interface QuoteLinkMessage {
  from: 'client' | 'band';
  body: string;
  at: string;
}

/** bw_quote_link_view / _seen / _respond / _message */
export interface QuoteLinkView {
  status: QuoteLinkStatus;
  lang: string;
  band_name: string;
  client_name: string | null;
  quote: ClientQuoteSnapshot;
  version: number;
  updated_at: string | null;
  pdf_url: string | null;
  accepted_name: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  expired: boolean;
  messages: QuoteLinkMessage[];
  /** respond: the quote changed since the client loaded it; nothing was recorded. */
  stale?: boolean;
}
