import React from 'react';
import { cn } from '@/app/components/ui/utils';

/**
 * Figma "Duo · 06": while the quote wizard is on steps 1–2 in the two-pane
 * book layout, the leading page shows the quote as the client will read it,
 * updating as the user types. Read-only, styled like the wizard's step 3
 * ("Review & confirm") hero and breakdown. All values are formatted by the
 * wizard from its own state and quote math.
 */
export interface LiveQuoteRow {
  label: string;
  value: string;
  tone?: 'success';
}

export interface LiveQuotePreviewProps {
  title: string;
  /** Event type label, e.g. "Wedding". */
  typeLabel?: string | null;
  quoteNumber?: string | null;
  client?: string | null;
  clientEmail?: string | null;
  /** Formatted date, or null while not set. */
  dateLabel?: string | null;
  /** e.g. "20:00 – 23:30". */
  timeLabel?: string | null;
  venue?: string | null;
  city?: string | null;
  /** e.g. "Full band (5) · 2 × 120 min". */
  lineup: string;
  lineupNames?: string[];
  /** Breakdown rows (lineup, extras, travel, discount, VAT). */
  rows: LiveQuoteRow[];
  /** Formatted total. */
  total: string;
  /** e.g. "Total · 30% deposit". */
  totalLabel?: string;
}

const Row: React.FC<LiveQuoteRow> = ({ label, value, tone }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="bw-body-md text-muted-foreground min-w-0">{label}</span>
    <span className={cn('bw-label-md shrink-0', tone === 'success' ? 'text-success' : 'text-foreground')}>{value}</span>
  </div>
);

export const LiveQuotePreview: React.FC<LiveQuotePreviewProps> = ({
  title,
  typeLabel,
  quoteNumber,
  client,
  clientEmail,
  dateLabel,
  timeLabel,
  venue,
  city,
  lineup,
  lineupNames = [],
  rows,
  total,
  totalLabel = 'Total',
}) => {
  const place = [venue?.trim(), city?.trim()].filter(Boolean).join(', ');
  const chip: React.CSSProperties = { backgroundColor: 'var(--accent-quote-fg)', color: 'var(--accent-quote)' };
  const tint: React.CSSProperties = { backgroundColor: 'color-mix(in srgb, currentColor 14%, transparent)' };
  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-6" aria-live="polite">
      <p className="bw-label-sm text-muted-foreground">Live preview</p>

      <section
        className="rounded-[24px] p-5 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--accent-quote)', color: 'var(--accent-quote-fg)' }}
        aria-label="Quote preview"
      >
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="h-4 px-1.5 rounded-full bw-label-xs inline-flex items-center" style={chip}>
            Quote{quoteNumber ? ` · ${quoteNumber}` : ''}
          </span>
          {typeLabel && (
            <span className="h-4 px-1.5 rounded-full bw-label-xs inline-flex items-center" style={tint}>
              {typeLabel}
            </span>
          )}
        </div>
        <h2 className="bw-display [overflow-wrap:anywhere]">{title}</h2>
        <div className="flex flex-col gap-3 bw-body-md">
          <p className="[overflow-wrap:anywhere]">
            Client: {client?.trim() || 'Client TBD'}
            {clientEmail ? ` · ${clientEmail}` : ''}
          </p>
          <p className="[overflow-wrap:anywhere]">
            {dateLabel || 'Date TBD'}
            {timeLabel ? ` · ${timeLabel}` : ''} · {place || 'Venue TBD'}
          </p>
          <p className="[overflow-wrap:anywhere]">
            {lineup}
            {lineupNames.length > 0 && <span className="opacity-70"> · {lineupNames.join(', ')}</span>}
          </p>
        </div>
      </section>

      <section className="rounded-[24px] bg-card p-4 flex flex-col gap-3" aria-label="Breakdown">
        <span className="bw-label-sm text-muted-foreground">Breakdown</span>
        {rows.map((r) => (
          <Row key={r.label} {...r} />
        ))}
        <hr className="border-0 h-px bg-border" />
        <div className="flex items-baseline justify-between gap-3">
          <span className="bw-label-sm text-foreground">{totalLabel}</span>
          <span className="bw-value-md text-foreground shrink-0 tabular-nums">{total}</span>
        </div>
      </section>
    </div>
  );
};

export default LiveQuotePreview;
