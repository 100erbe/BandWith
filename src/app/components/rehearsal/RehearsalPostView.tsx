import React, { useMemo } from 'react';
import { CheckCircle2, Calendar, X } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { Card, IconButton, PillButton, ScreenHeader, Tag } from '@/app/components/bw';
import { useT, intlLocale } from '@/lib/i18n';
import type { EventItem } from '@/app/data/events';
import { parseLocalDate } from '@/lib/dates';
import { useRehearsalSetlist } from './useRehearsalSetlist';
import type { RehearsalLineupMember } from './RehearsalLiveView';
import {
  elapsedSeconds, formatSpan, getSession, isLate, scheduledStart, sessionKey, summarize,
} from '@/lib/rehearsalSession';

interface Props {
  rehearsal: EventItem;
  lineup: RehearsalLineupMember[];
  /** The band's upcoming rehearsals, for the next session. */
  upcoming: EventItem[];
  onClose: () => void;
}

const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const RehearsalPostView: React.FC<Props> = ({ rehearsal, lineup, upcoming, onClose }) => {
  const t = useT();
  const session = getSession(sessionKey(rehearsal.eventId ?? rehearsal.id, rehearsal.date));
  const setlist = useRehearsalSetlist(rehearsal.setlistId);
  const summary = useMemo(() => summarize(session, setlist.map((s) => s.id)), [session, setlist]);
  const start = scheduledStart(rehearsal.date, rehearsal.time);
  const day = (date?: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }) =>
    date ? parseLocalDate(date.slice(0, 10)).toLocaleDateString(intlLocale('en-US'), opts) : '';
  const subtitle = [day(rehearsal.date), session ? formatSpan(elapsedSeconds(session)) : null].filter(Boolean).join(' · ');
  const rated = setlist.filter((s) => session?.verdicts[s.id]);
  const songTitle = new Map(setlist.map((s) => [s.id, s.title]));
  const thisDay = (rehearsal.date || '').slice(0, 10);
  const next = upcoming.find((r) => (r.date || '').slice(0, 10) > thisDay);

  return (
    <div className="bw-safe-inline fixed inset-0 z-[185] bg-background text-foreground flex flex-col overflow-y-auto">
      <ScreenHeader
        actions={<IconButton label={t('Close summary')} icon={<X />} variant="ghost" onClick={onClose} />}
        overline={
          <span className="inline-flex items-center gap-1.5 text-success">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t('Rehearsal completed')}
          </span>
        }
        title={rehearsal.title || t('Rehearsal')}
      >
        {subtitle && <p className="bw-body-sm text-muted-foreground">{subtitle}</p>}
      </ScreenHeader>

      <div
        className="w-full max-w-md mx-auto px-4 pt-6 flex flex-col gap-6"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 32px)' }}
      >
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: summary.played, label: t('Songs played'), cls: '' },
            { value: summary.needWork, label: t('Need work'), cls: 'text-warning' },
            { value: summary.problems, label: t('Problem'), cls: 'text-destructive' },
          ].map((s) => (
            <Card key={s.label} className="gap-2 p-4">
              <span className={cn('bw-value-lg', s.cls)}>{s.value}</span>
              <span className="bw-label-xs text-muted-foreground">{s.label}</span>
            </Card>
          ))}
        </div>

        {/* Feedback */}
        <section className="flex flex-col gap-3">
          <h3 className="bw-label-sm text-muted-foreground">{t('Feedback summary')}</h3>
          {rated.length === 0 ? (
            <p className="bw-body-sm text-muted-foreground">{t('No feedback given during this rehearsal.')}</p>
          ) : (
            rated.map((song) => {
              const v = session!.verdicts[song.id];
              return (
                <Card key={song.id} className="gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="bw-h3 min-w-0 [overflow-wrap:anywhere]">{song.title}</h4>
                    <Tag
                      variant={v === 'nailed' ? 'accent' : v === 'problem' ? 'solid' : 'outline'}
                      className={v === 'problem' ? 'bg-destructive-solid text-white' : undefined}
                    >
                      {v === 'nailed' ? t('Nailed it') : v === 'work' ? t('Needs work') : v === 'redo' ? t('Redo') : t('Problems')}
                    </Tag>
                  </div>
                </Card>
              );
            })
          )}
        </section>

        {/* Attendance */}
        {lineup.length > 0 && (
          <section className="flex flex-col gap-3">
            <h3 className="bw-label-sm text-muted-foreground">{t('Attendance')}</h3>
            <Card className="gap-0 py-2">
              {lineup.map((m) => {
                const arrived = session?.arrivals[m.userId];
                const late = !!arrived && isLate(arrived, start);
                return (
                  <div key={m.userId} className="flex items-center gap-3 py-2">
                    <CheckCircle2
                      className={cn('w-5 h-5 shrink-0', !arrived ? 'text-muted-foreground' : late ? 'text-warning' : 'text-success')}
                    />
                    <span className="flex-1 min-w-0 bw-body-lg truncate">{m.name}</span>
                    {late && <Tag variant="outline">{t('Late')}</Tag>}
                    <span className="bw-label-sm text-muted-foreground shrink-0">
                      {arrived ? t('Arrived {time}', { time: hhmm(arrived) }) : t('Not checked in')}
                    </span>
                  </div>
                );
              })}
            </Card>
          </section>
        )}

        {/* Next rehearsal, with the songs that need work */}
        {next && (
          <div className="rounded-[24px] p-5 flex flex-col gap-4 bg-surface-inverse text-surface-inverse-foreground">
            <p className="flex items-center gap-2 bw-label-sm opacity-70">
              <Calendar className="w-4 h-4" />
              {t('Next session')}
            </p>
            <div className="flex flex-col gap-1">
              <h3 className="bw-h2">{day(next.date, { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
              <p className="bw-body-sm opacity-70">{[next.location, next.time?.slice(0, 5)].filter(Boolean).join(' · ')}</p>
            </div>
            {summary.focus.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="bw-label-sm opacity-70">{t('Suggested focus')}</p>
                <ul className="flex flex-col gap-2 bw-body-md">
                  {summary.focus.map((id) => (
                    <li key={id} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                      {songTitle.get(id)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <PillButton variant="ghost" onClick={onClose}>
          {t('Close summary')}
        </PillButton>
      </div>
    </div>
  );
};
