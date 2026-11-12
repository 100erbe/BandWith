import React from 'react';
import { ArrowLeft, Calendar, Check, ChevronRight, FileSignature, Loader2, Music, Plus, StickyNote } from '@/app/components/icons';
import { BwSheet } from '@/app/components/bw/Screen';
import { listEventTasks, syncEventTasks } from '@/lib/services/eventTasks';
import { saveEventDraft, useEventDrafts, type EventDraft } from '@/lib/wizardDrafts';
import type { TaskTemplate } from '@/lib/services/taskTemplates';
import { t, useT } from '@/lib/i18n';

export type TemplateTargetKind = 'gig' | 'rehearsal' | 'quote';

/** An upcoming event of the band the list can be added to. */
export interface TemplateTargetEvent {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  kind: TemplateTargetKind;
}

const shortDate = (d: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || '');
  if (!m) return t('No date');
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
  const t = useT();
  const kindLabel: Record<TemplateTargetKind, string> = { gig: t('Gigs'), rehearsal: t('Rehearsals'), quote: t('Quotes') };
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
  const count = tasks.length === 1 ? t('{count} task', { count: 1 }) : t('{count} tasks', { count: tasks.length });

  const addToEvent = async (ev: TemplateTargetEvent) => {
    if (!template || busy) return;
    setBusy(ev.id);
    setError(null);
    const { data, error: e1 } = await listEventTasks(ev.id);
    if (e1) {
      setBusy(null);
      setError(t('Could not load that event. Try again.'));
      return;
    }
    const have = new Set(data.map((task) => norm(task.title)));
    const add = tasks.filter((task) => task.title?.trim() && !have.has(norm(task.title))).map((task) => ({ title: task.title, dueOffset: task.dueOffset }));
    if (add.length === 0) {
      setBusy(null);
      onAdded(t('"{title}" already has these tasks', { title: ev.title }));
      return;
    }
    const { error: e2 } = await syncEventTasks(ev.id, add, ev.date, []);
    setBusy(null);
    if (e2) {
      setError(t('Could not add the tasks. Try again.'));
      return;
    }
    onAdded(
      add.length === 1
        ? t('{count} task added to "{title}"', { count: 1, title: ev.title })
        : t('{count} tasks added to "{title}"', { count: add.length, title: ev.title }),
    );
  };

  const addToDraft = (d: EventDraft) => {
    if (!template) return;
    // Rehearsal drafts keep the wizard's data (tasks with `text`); gig drafts keep `tasks` with `title`.
    const isRehearsal = d.eventType === 'rehearsal';
    const holder = (isRehearsal ? (d.state.data as Record<string, unknown> | undefined) : d.state) || {};
    const current = Array.isArray(holder.tasks) ? (holder.tasks as { title?: string; text?: string }[]) : [];
    const have = new Set(current.map((task) => norm(task.title || task.text || '')));
    const stamp = Date.now().toString(36);
    const fresh = tasks.filter((task) => task.title?.trim() && !have.has(norm(task.title)));
    if (fresh.length === 0) {
      onAdded(t('"{title}" already has these tasks', { title: d.title || t('Draft') }));
      return;
    }
    const add = fresh.map((task, i) =>
      isRehearsal
        ? { id: `task-tpl-${stamp}-${i}`, text: task.title, completed: false, assignedTo: ['all'], type: 'prepare', dueOffset: task.dueOffset }
        : { uid: `t-tpl-${stamp}-${i}`, title: task.title, completed: false, templateId: template.id, dueOffset: task.dueOffset },
    );
    const nextHolder = { ...holder, tasks: [...current, ...add] };
    const state = isRehearsal ? { ...d.state, data: nextHolder } : nextHolder;
    saveEventDraft({ id: d.id, userId: d.userId, bandId: d.bandId, title: d.title, date: d.date, venue: d.venue, eventType: d.eventType, state });
    onAdded(
      add.length === 1
        ? t('{count} task added to the draft "{title}"', { count: 1, title: d.title || t('Untitled') })
        : t('{count} tasks added to the draft "{title}"', { count: add.length, title: d.title || t('Untitled') }),
    );
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
      overline={template ? `${template.name} · ${count}` : t('To-do list')}
      title={step === 'choose' ? t('Use this list') : t('Add to…')}
    >
      {step === 'choose' ? (
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2" aria-label={t('Start something new')}>
            <p className="bw-label-sm text-sheet-foreground/85">{t('Start new, with these tasks')}</p>
            <Row icon={<Music />} title={t('New gig')} subtitle={t('The gig form opens with the tasks filled in')} onClick={() => onNew('gig')} />
            <Row icon={<Calendar />} title={t('New rehearsal')} subtitle={t('The rehearsal form opens with the tasks filled in')} onClick={() => onNew('rehearsal')} />
            <Row icon={<FileSignature />} title={t('New quote')} subtitle={t('The tasks are added when the quote is saved')} onClick={() => onNew('quote')} />
          </section>
          <section className="flex flex-col gap-2" aria-label={t('Add to an existing one')}>
            <p className="bw-label-sm text-sheet-foreground/85">{t('Or add them to')}</p>
            <Row
              icon={<Plus />}
              title={t('An existing gig, rehearsal or quote')}
              subtitle={t('Or one of your saved drafts')}
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
            <ArrowLeft className="w-4 h-4" /> {t('Back')}
          </button>
          {error && <p role="alert" className="bw-body-sm text-destructive">{error}</p>}
          {nothing && <p className="bw-body-sm text-sheet-foreground/80">{t('No upcoming gigs, rehearsals, quotes or drafts yet. Start a new one instead.')}</p>}
          {groups.map((g) => (
            <section key={g.kind} className="flex flex-col gap-2" aria-label={kindLabel[g.kind]}>
              <p className="bw-label-sm text-sheet-foreground/85">{kindLabel[g.kind]}</p>
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
            <section className="flex flex-col gap-2" aria-label={t('Saved drafts')}>
              <p className="bw-label-sm text-sheet-foreground/85">{t('Saved drafts')}</p>
              <div className="grid grid-cols-1 @min-[600px]:grid-cols-2 gap-2">
                {drafts.map((d) => (
                  <Row
                    key={d.id}
                    icon={<StickyNote />}
                    title={d.title || t('Untitled draft')}
                    subtitle={
                      d.eventType === 'rehearsal'
                        ? t('Rehearsal draft · {date}', { date: d.date ? shortDate(d.date) : t('no date') })
                        : t('Gig draft · {date}', { date: d.date ? shortDate(d.date) : t('no date') })
                    }
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
