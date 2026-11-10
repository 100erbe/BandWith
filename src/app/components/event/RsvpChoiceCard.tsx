import React, { useState } from 'react';
import { Check } from '@/app/components/icons';
import { PillButton } from '@/app/components/bw/Form';
import type { RsvpStatus } from '@/app/components/notifications/EventRSVPSheet';

export type RsvpAnswer = 'pending' | 'accepted' | 'maybe' | 'declined';

const toStatus: Record<RsvpAnswer, RsvpStatus | null> = {
  pending: null,
  accepted: 'confirmed',
  maybe: 'maybe',
  declined: 'declined',
};

/**
 * Rehearsal RSVP card (Figma 22:895): always shown to invited members, the
 * current answer selected, GOING / MAYBE / CAN'T.
 */
export const RsvpChoiceCard: React.FC<{
  title: string;
  current: RsvpAnswer;
  /** Resolves when saved; throws to keep the card as it was. */
  onChoose: (status: RsvpStatus) => Promise<void>;
  /** MAYBE needs a handler that can store it; hidden otherwise. */
  allowMaybe: boolean;
  caption?: string;
}> = ({ title, current, onChoose, allowMaybe, caption }) => {
  const [busy, setBusy] = useState<RsvpStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const selected = toStatus[current];

  const choose = async (status: RsvpStatus) => {
    if (busy || status === selected) return;
    setBusy(status);
    setError(null);
    try {
      await onChoose(status);
    } catch (e: any) {
      setError(e?.message || 'Could not save your answer. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const options: { value: RsvpStatus; label: string }[] = [
    { value: 'confirmed', label: 'GOING' },
    ...(allowMaybe ? [{ value: 'maybe' as const, label: 'MAYBE' }] : []),
    { value: 'declined', label: "CAN'T" },
  ];

  return (
    <section className="dark bg-sheet text-sheet-foreground rounded-[16px] p-5 flex flex-col gap-4">
      <span className="bw-label-sm">Your RSVP</span>
      <h2 className="bw-h1">{title}</h2>
      <div role="radiogroup" aria-label="Your RSVP" className={options.length === 3 ? 'grid grid-cols-3 gap-2' : 'grid grid-cols-2 gap-2'}>
        {options.map((o) => {
          const on = selected === o.value;
          return (
            <PillButton
              key={o.value}
              role="radio"
              aria-checked={on}
              variant={on ? 'primary' : 'outline'}
              size="md"
              className="px-2"
              onClick={() => choose(o.value)}
              loading={busy === o.value}
              disabled={!!busy && busy !== o.value}
              icon={on ? <Check className="w-4 h-4" /> : undefined}
            >
              {o.label}
            </PillButton>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="bw-body-sm text-destructive">
          {error}
        </p>
      )}
      {caption && <p className="bw-body-sm text-sheet-foreground/80">{caption}</p>}
    </section>
  );
};
