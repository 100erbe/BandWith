import React from 'react';
import { Calendar, MapPin, Users } from '@/app/components/icons';
import { Tag } from '@/app/components/bw/Screen';

/**
 * Figma "Duo · 04": while the new gig wizard is on its first step in the
 * two-pane book layout, the leading page shows the gig as it will be saved,
 * filling in as the user types. Read-only, styled like the wizard's
 * "Review & confirm" summary card. Every value comes from the wizard's form.
 */
export interface LiveGigPreviewProps {
  /** "Gig" or "Quote". */
  kindLabel: string;
  /** Event type label, e.g. "Wedding". */
  typeLabel?: string | null;
  /** "indoor" / "outdoor". */
  settingLabel?: string | null;
  title: string;
  /** Formatted date, or null while not set. */
  dateLabel?: string | null;
  /** e.g. "20:00 – 23:30". */
  timeLabel?: string | null;
  venue?: string | null;
  city?: string | null;
  lineupCount: number;
  /** Names of the selected musicians. */
  lineupNames?: string[];
  /** Formatted total fee; omit for members or when nothing is set. */
  fee?: string | null;
  /** Event colour (CSS colour / var) and its foreground. */
  accent: string;
  accentFg: string;
}

export const LiveGigPreview: React.FC<LiveGigPreviewProps> = ({
  kindLabel,
  typeLabel,
  settingLabel,
  title,
  dateLabel,
  timeLabel,
  venue,
  city,
  lineupCount,
  lineupNames = [],
  fee,
  accent,
  accentFg,
}) => {
  const place = [venue?.trim(), city?.trim()].filter(Boolean).join(', ');
  return (
    <div className="flex flex-col gap-3 px-4 pt-4 pb-6" aria-live="polite">
      <p className="bw-label-sm text-muted-foreground">Live preview</p>
      <section
        className="rounded-[24px] p-5 flex flex-col gap-3"
        style={{ backgroundColor: accent, color: accentFg }}
        aria-label={`${kindLabel} preview`}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Tag variant="solid">{kindLabel}</Tag>
          {typeLabel && <span className="bw-label-xs">{typeLabel}</span>}
          {settingLabel && <span className="bw-label-xs opacity-70">{settingLabel}</span>}
        </div>
        <h2 className="bw-display-lg [overflow-wrap:anywhere]">{title}</h2>

        <div className="flex items-start gap-2">
          <Calendar className="w-4 h-4 shrink-0 mt-[3px]" />
          <span className="bw-body-md">
            {dateLabel || 'Date TBD'}
            {timeLabel ? ` · ${timeLabel}` : ''}
          </span>
        </div>
        <div className="flex items-start gap-2 min-w-0">
          <MapPin className="w-4 h-4 shrink-0 mt-[3px]" />
          <span className="bw-body-md [overflow-wrap:anywhere]">{place || 'Venue TBD'}</span>
        </div>
        <div className="flex items-start gap-2 min-w-0">
          <Users className="w-4 h-4 shrink-0 mt-[3px]" />
          <span className="bw-body-md [overflow-wrap:anywhere]">
            {lineupCount} {lineupCount === 1 ? 'musician' : 'musicians'}
            {lineupNames.length > 0 && <span className="opacity-70"> · {lineupNames.join(', ')}</span>}
          </span>
        </div>

        {fee && (
          <div
            className="flex items-baseline justify-between gap-3 pt-2"
            style={{ borderTop: '1px solid color-mix(in srgb, currentColor 20%, transparent)' }}
          >
            <span className="bw-label-sm">Fee</span>
            <span className="bw-value-md shrink-0">{fee}</span>
          </div>
        )}
      </section>
    </div>
  );
};

export default LiveGigPreview;
