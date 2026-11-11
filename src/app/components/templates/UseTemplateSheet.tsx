import React from 'react';
import { ArrowLeft, Calendar, Check, ChevronRight, FileSignature, Loader2, Music, Plus, StickyNote } from '@/app/components/icons';
import { BwSheet } from '@/app/components/bw/Screen';
import { listEventTasks, syncEventTasks } from '@/lib/services/eventTasks';
import { saveEventDraft, useEventDrafts, type EventDraft } from '@/lib/wizardDrafts';
import type { TaskTemplate } from '@/lib/services/taskTemplates';

export type TemplateTargetKind = 'gig' | 'rehearsal' | 'quote';

/** An upcoming event of the band the list can be added to. */
export interface TemplateTargetEvent {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  kind: TemplateTargetKind;
}

const KIND_LABEL: Record<TemplateTargetKind, string> = { gig: 'Gigs', rehearsal: 'Rehearsals', quote: 'Quotes' };

const shortDate = (d: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
  if (!m) return 'No date';
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

const norm = (s: string) => s.trim().toLowerCase();

const Row: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick: () => void;
  busy?: boolean;
  done?: boolean;
  disabled?: boolean;
}> = ({ icon, title, subtitle, onClick, busy, done, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="w-full flex items-center gap-3 p-3 rounded-[16px] bg-sheet-foreground/[0.08] text-left active:scale-[0.99] transition-transform disabled:opacity-50"
  >
    <span className="w-10 h-10 rounded-full bg-sheet-foreground/[0.1] flex items-center justify-center shrink-0 [&_svg]:w-5 [&_svg]:h-5">
      {icon}
    </span>
    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
      <span className="bw-label-md truncate">{title}</span>
      {subtitle && <span className="bw-body-sm text-sheet-foreground/70 truncate">{subtitle}</span>}
    </span>
    {busy ? (
      <Loader2 className="w-5 h-5 animate-spin shrink-0" />
    ) : done ? (
      <Check className="w-5 h-5 shrink-0" />
    ) : (
      <ChevronRight className="w-5 h-5 shrink-0" aria-hidden />
    )}
  </button>
);

/**
 * "Use this list": start a new gig / rehearsal / quote with the list's tasks,
 * or add them to one the band already has (or to a saved gig draft).
 */
export const UseTemplateSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  template: TaskTemplate | null;
  events: TemplateTargetEvent[];
  userId?: string | null;
  bandId: string;
  onNew: (kind: TemplateTargetKind) => void;
  onAdded: (message: string) => void;
}> = ({ open, onClose, template, events, userId, bandId, onNew, onAdded }) => {
  const [step, setStep] = React.useState<'choose' | 'existing'>('choose');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const drafts = useEventDrafts(userId, bandId);

  React.useEffect(() => {
    if (open) {
      setStep('choose');
      setError(null);
      setBusy(null);
    }
  }, [open]);

  const tasks = template?.tasks || [];
  const count = `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`;

  const addToEvent = async (ev: TemplateTargetEvent) => {
    if (!template || busy) return;
    setBusy(ev.id);
    setError(null);
    const { data, error: e1 } = await listEventTasks(ev.id);
    if (e1) {
      setBusy(null);
      setError('Could not load that event. Try again.');
      return;
    }
    const have = new Set(data.map((t) => norm(t.title)));
    const add = tasks.filter((t) => t.title?.trim() && !have.has(norm(t.title))).map((t) => ({ title: t.title, dueOffset: t.dueOffset }));
    if (add.length === 0) {
      setBusy(null);
      onAdded(`"${ev.title}" already has these tasks`);
      return;
    }
    const { error: e2 } = await syncEventTasks(ev.id, add, ev.date, []);
    setBusy(null);
    if (e2) {
      setError('Could not add the tasks. Try again.');
      return;
    }
    onAdded(`${add.length} ${add.length === 1 ? 'task' : 'tasks'} added to "${ev.title}"`);
  };

  const addToDraft = (d: EventDraft) => {
    if (!template) return;
    // Rehearsal drafts keep the wizard's data (tasks with `text`); gig drafts keep `tasks` with `title`.
    const isRehearsal = d.eventType === 'rehearsal';
    const holder = (isRehearsal ? (d.state.data as Record<string, unknown> | undefined) : d.state) || {};
    const current = Array.isArray(holder.tasks) ? (holder.tasks as { title?: string; text?: string }[]) : [];
    const have = new Set(current.map((t) => norm(t.title || t.text || '')));
    const stamp = Date.now().toString(36);
    const fresh = tasks.filter((t) => t.title?.trim() && !have.has(norm(t.title)));
    if (fresh.length === 0) {
      onAdded(`"${d.title || 'Draft'}" already has these tasks`);
      return;
    }
    const add = fresh.map((t, i) =>
      isRehearsal
        ? { id: `task-tpl-${stamp}-${i}`, text: t.title, completed: false, assignedTo: ['all'], type: 'prepare', dueOffset: t.dueOffset }
        : { uid: `t-tpl-${stamp}-${i}`, title: t.title, completed: false, templateId: template.id, dueOffset: t.dueOffset },
    );
    const nextHolder = { ...holder, tasks: [...current, ...add] };
    const state = isRehearsal ? { ...d.state, data: nextHolder } : nextHolder;
    saveEventDraft({ id: d.id, userId: d.userId, bandId: d.bandId, title: d.title, date: d.date, venue: d.venue, eventType: d.eventType, state });
    onAdded(`${add.length} ${add.length === 1 ? 'task' : 'tasks'} added to the draft "${d.title || 'Untitled'}"`);
  };

  const groups = (['gig', 'rehearsal', 'quote'] as TemplateTargetKind[])
    .map((k) => ({ kind: k, items: events.filter((e) => e.kind === k) }))
    .filter((g) => g.items.length > 0);
  const nothing = groups.length === 0 && drafts.length === 0;

  return (
    <BwSheet
      open={open}
      onClose={onClose}
      portal
      zIndex={112}
      overline={template ? `${template.name} · ${count}` : 'To-do list'}
      title={step === 'choose' ? 'Use this list' : 'Add to…'}
    >
      {step === 'choose' ? (
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2" aria-label="Start something new">
            <p className="bw-label-sm text-sheet-foreground/85">Start new, with these tasks</p>
            <Row icon={<Music />} title="New gig" subtitle="The gig form opens with the tasks filled in" onClick={() => onNew('gig')} />
            <Row icon={<Calendar />} title="New rehearsal" subtitle="The rehearsal form opens with the tasks filled in" onClick={() => onNew('rehearsal')} />
            <Row icon={<FileSignature />} title="New quote" subtitle="The tasks are added when the quote is saved" onClick={() => onNew('quote')} />
          </section>
          <section className="flex flex-col gap-2" aria-label="Add to an existing one">
            <p className="bw-label-sm text-sheet-foreground/85">Or add them to</p>
            <Row
              icon={<Plus />}
              title="An existing gig, rehearsal or quote"
              subtitle="Or one of your saved drafts"
              onClick={() => setStep('existing')}
            />
          </section>
        </div>
      ) : (
        <div className="@container flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setStep('choose')}
            className="self-start inline-flex items-center gap-2 bw-label-sm text-sheet-foreground/85 min-h-11"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          {error && <p role="alert" className="bw-body-sm text-destructive">{error}</p>}
          {nothing && <p className="bw-body-sm text-sheet-foreground/80">No upcoming gigs, rehearsals, quotes or drafts yet. Start a new one instead.</p>}
          {groups.map((g) => (
            <section key={g.kind} className="flex flex-col gap-2" aria-label={KIND_LABEL[g.kind]}>
              <p className="bw-label-sm text-sheet-foreground/85">{KIND_LABEL[g.kind]}</p>
              <div className="grid grid-cols-1 @min-[600px]:grid-cols-2 gap-2">
                {g.items.map((ev) => (
                  <Row
                    key={ev.id}
                    icon={g.kind === 'rehearsal' ? <Calendar /> : g.kind === 'quote' ? <FileSignature /> : <Music />}
                    title={ev.title}
                    subtitle={shortDate(ev.date)}
                    busy={busy === ev.id}
                    disabled={!!busy && busy !== ev.id}
                    onClick={() => void addToEvent(ev)}
                  />
                ))}
              </div>
            </section>
          ))}
          {drafts.length > 0 && (
            <section className="flex flex-col gap-2" aria-label="Saved drafts">
              <p className="bw-label-sm text-sheet-foreground/85">Saved drafts</p>
              <div className="grid grid-cols-1 @min-[600px]:grid-cols-2 gap-2">
                {drafts.map((d) => (
                  <Row
                    key={d.id}
                    icon={<StickyNote />}
                    title={d.title || 'Untitled draft'}
                    subtitle={`${d.eventType === 'rehearsal' ? 'Rehearsal' : 'Gig'} draft · ${d.date ? shortDate(d.date) : 'no date'}`}
                    disabled={!!busy}
                    onClick={() => addToDraft(d)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </BwSheet>
  );
};
