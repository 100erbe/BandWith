import React, { useState } from 'react';
import { AlertTriangle, Lock, Bell } from '@/app/components/icons';
import { PillButton } from '@/app/components/bw/Form';
import { Toggle } from '@/app/components/bw/Toggle';
import { supabase } from '@/lib/supabase';
import { findEventConflicts } from '@/lib/eventConflicts';
import type { EventData } from '@/app/components/dashboard/EventCard';
import { formatDayShort, formatTime12 } from './format';

/* Personal gig (Figma 23:993): privacy note, band-event conflict, paid toggle. */

export const PersonalPrivacyCard: React.FC = () => (
  <div className="bg-card rounded-[16px] p-4 flex items-start gap-3">
    <Lock className="w-5 h-5 shrink-0 text-muted-foreground" aria-hidden />
    <p className="bw-body-md">
      Private to you. Your bands only see you as &ldquo;busy&rdquo; on this date.
    </p>
  </div>
);

/** First band gig / rehearsal on the same date as the personal gig. */
export const findBandConflict = (event: EventData, allEvents?: EventData[]): EventData | null => {
  if (!allEvents?.length) return null;
  const sameDay = findEventConflicts(allEvents, { eventId: event.eventId, date: event.date });
  return (
    sameDay.find((e) => {
      if (!e.band_id || e.id === event.id) return false;
      const s = String(e.status || '').toUpperCase();
      return s === 'CONFIRMED' || s === 'COMPLETED' || s === 'REHEARSAL';
    }) ?? null
  );
};

export const ScheduleConflictCard: React.FC<{
  conflict: EventData;
  onNotify?: (bandId: string, eventId: string) => Promise<void> | void;
}> = ({ conflict, onNotify }) => {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);
  const band = conflict.band_name || 'Your band';
  const kind = String(conflict.status || '').toUpperCase() === 'REHEARSAL' ? 'Rehearsal' : 'Gig';
  const when = [formatDayShort(conflict.date), formatTime12(conflict.time)].filter(Boolean).join(', ');

  const notify = async () => {
    if (!onNotify || !conflict.band_id || !conflict.eventId || state !== 'idle') return;
    setState('sending');
    setError(null);
    try {
      await onNotify(conflict.band_id, conflict.eventId);
      setState('sent');
    } catch (e: any) {
      setError(e?.message || 'Could not notify the admin.');
      setState('idle');
    }
  };

  return (
    <section className="dark bg-sheet text-sheet-foreground rounded-[16px] p-5 flex flex-col gap-3">
      <span className="bw-label-sm inline-flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-warning" aria-hidden />
        SCHEDULE CONFLICT
      </span>
      <p className="bw-body-md [overflow-wrap:anywhere]">
        {band} has a {kind} on the same evening{when ? ` (${when})` : ''}. Let the admin know.
      </p>
      {error && (
        <p role="alert" className="bw-body-sm text-destructive">
          {error}
        </p>
      )}
      {onNotify && conflict.band_id && conflict.eventId && (
        <PillButton
          variant="primary"
          size="md"
          onClick={notify}
          loading={state === 'sending'}
          disabled={state === 'sent'}
          icon={<Bell className="w-4 h-4" />}
          className="whitespace-normal"
        >
          {state === 'sent' ? 'ADMIN NOTIFIED' : `NOTIFY ${band.toUpperCase()} ADMIN`}
        </PillButton>
      )}
    </section>
  );
};

/** "Paid" row: saves events.payment_status ('paid' | 'pending'). */
export const PaidToggleRow: React.FC<{
  eventId?: string;
  initial?: 'pending' | 'partial' | 'paid';
  onSaved?: () => void;
}> = ({ eventId, initial, onSaved }) => {
  const [paid, setPaid] = useState(initial === 'paid');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (next: boolean) => {
    if (!eventId || saving) return;
    setPaid(next);
    setSaving(true);
    setError(null);
    const { data, error: upErr } = await supabase
      .from('events')
      .update({ payment_status: next ? 'paid' : 'pending' })
      .eq('id', eventId)
      .select('id');
    setSaving(false);
    if (upErr || !data?.length) {
      setPaid(!next);
      setError(upErr?.message || 'This gig could not be updated.');
      return;
    }
    onSaved?.();
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center justify-between gap-3 w-full min-w-0">
        <span className="bw-body-md text-muted-foreground">Paid</span>
        <Toggle checked={paid} onCheckedChange={change} disabled={!eventId || saving} aria-label="Paid" />
      </label>
      {error && (
        <p role="alert" className="bw-body-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};
