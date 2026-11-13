import React from 'react';
import { Calendar, Clock, EyeOff, MapPin, Pencil, Trash2 } from '@/app/components/icons';
import { BwSheet } from '@/app/components/bw/Screen';
import { PillButton } from '@/app/components/bw/Form';
import type { EventDraft } from '@/lib/wizardDrafts';
import { useT } from '@/lib/i18n';

export type DraftKind = 'gig' | 'rehearsal' | 'quote';

export const draftKindOf = (d: Pick<EventDraft, 'eventType'>): DraftKind =>
  d.eventType === 'rehearsal' ? 'rehearsal' : d.eventType === 'quote' ? 'quote' : 'gig';

export const DRAFT_KIND_LABEL: Record<DraftKind, string> = { gig: 'Gig', rehearsal: 'Rehearsal', quote: 'Quote' };

const longDate = (d?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/** Time range the wizard had, when there is one. */
export const draftTimes = (d: EventDraft): { start?: string; end?: string } => {
  const st = (d.state || {}) as Record<string, any>;
  const start = draftKindOf(d) === 'rehearsal' ? st.data?.time : st.details?.startTime;
  const end = draftKindOf(d) === 'rehearsal' ? st.endTime : st.details?.endTime;
  return { start: typeof start === 'string' && start ? start : undefined, end: typeof end === 'string' && end ? end : undefined };
};

const Fact: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="flex items-center gap-3 min-h-11">
    <span className="w-9 h-9 rounded-full bg-sheet-foreground/[0.1] flex items-center justify-center shrink-0 [&_svg]:w-4 [&_svg]:h-4" aria-hidden>
      {icon}
    </span>
    <span className="bw-body-md min-w-0 [overflow-wrap:anywhere]">{children}</span>
  </div>
);

/**
 * A saved draft (gig or rehearsal) opened from the calendar or from Drafts:
 * what it holds, that only its author sees it, and Continue / Delete.
 */
export const DraftPreviewSheet: React.FC<{
  draft: EventDraft | null;
  onClose: () => void;
  onContinue: (d: EventDraft) => void;
  onDelete: (d: EventDraft) => void;
}> = ({ draft, onClose, onContinue, onDelete }) => {
  const tr = useT();
  const [confirm, setConfirm] = React.useState(false);
  const last = React.useRef<EventDraft | null>(null);
  if (draft) last.current = draft;
  const d = draft || last.current;
  React.useEffect(() => {
    if (draft) setConfirm(false);
  }, [draft]);

  const kind = d ? draftKindOf(d) : 'gig';
  // Whole sentences per kind: the noun's gender changes the wording in other languages.
  const copy = {
    gig: {
      overline: tr('Gig draft'),
      untitled: tr('Untitled gig'),
      lost: tr('What you typed in this gig is lost. Nothing was sent to the band, so nobody else is affected.'),
      privateNote: tr("Still a draft: only you can see it. Members aren't notified and it isn't on their calendar until you create the gig."),
    },
    rehearsal: {
      overline: tr('Rehearsal draft'),
      untitled: tr('Untitled rehearsal'),
      lost: tr('What you typed in this rehearsal is lost. Nothing was sent to the band, so nobody else is affected.'),
      privateNote: tr("Still a draft: only you can see it. Members aren't notified and it isn't on their calendar until you create the rehearsal."),
    },
    quote: {
      overline: tr('Quote draft'),
      untitled: tr('Untitled quote'),
      lost: tr('What you typed in this quote is lost. Nothing was sent to the band, so nobody else is affected.'),
      privateNote: tr("Still a draft: only you can see it. Members aren't notified and it isn't on their calendar until you create the quote."),
    },
  }[kind];
  const date = longDate(d?.date);
  const times = d ? draftTimes(d) : {};

  return (
    <BwSheet
      open={!!draft}
      onClose={onClose}
      portal
      zIndex={150}
      overline={copy.overline}
      title={confirm ? tr('Delete this draft?') : d?.title || copy.untitled}
      footer={
        confirm ? (
          <div className="grid grid-cols-2 gap-2">
            <PillButton variant="white" onClick={() => setConfirm(false)}>
              {tr('Cancel')}
            </PillButton>
            <PillButton variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={() => d && onDelete(d)}>
              {tr('Delete')}
            </PillButton>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <PillButton icon={<Pencil className="w-4 h-4" />} onClick={() => d && onContinue(d)}>
              {tr('Continue editing')}
            </PillButton>
            <PillButton variant="danger" size="md" icon={<Trash2 className="w-4 h-4" />} onClick={() => setConfirm(true)}>
              {tr('Delete draft')}
            </PillButton>
          </div>
        )
      }
    >
      {confirm ? (
        <p className="bw-body-md text-sheet-foreground/80">
          {copy.lost}
        </p>
      ) : (
        <div className="@container flex flex-col gap-3">
          <div className="rounded-[16px] bg-sheet-foreground/[0.08] p-3 flex items-start gap-3">
            <EyeOff className="w-5 h-5 shrink-0 mt-0.5" aria-hidden />
            <p className="bw-body-sm">
              {copy.privateNote}
            </p>
          </div>
          <div className="grid grid-cols-1 @min-[420px]:grid-cols-2 gap-x-4">
            <Fact icon={<Calendar />}>{date || tr('No date yet')}</Fact>
            {times.start && (
              <Fact icon={<Clock />}>
                {times.start}
                {times.end ? ` – ${times.end}` : ''}
              </Fact>
            )}
            <Fact icon={<MapPin />}>{d?.venue || tr('No venue yet')}</Fact>
          </div>
          {d?.savedAt && (
            <p className="bw-body-sm text-sheet-foreground/70">
              {tr('Saved {time}', { time: new Date(d.savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })}
            </p>
          )}
        </div>
      )}
    </BwSheet>
  );
};
