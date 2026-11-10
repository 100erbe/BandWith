import React from 'react';
import { CheckCircle2, Calendar, X } from '@/app/components/icons';
import { cn } from '@/app/components/ui/utils';
import { Card, IconButton, PillButton, ScreenHeader, Tag } from '@/app/components/bw';

interface Props {
  onClose: () => void;
}

const FEEDBACK = [
  { song: "Sweet Child O' Mine", verdict: 'Nailed it', note: 'Intro solo was perfect today', tone: 'good' },
  { song: 'Bohemian Rhapsody', verdict: 'Needs work', note: 'Timing issue in the bridge', tone: 'work' },
  { song: 'Hotel California', verdict: 'Problems', note: 'Wrong key - need to transpose', tone: 'problem' },
] as const;

const ATTENDANCE = [
  { id: '1', name: 'Gianluca', status: 'ok', time: '21:00' },
  { id: '2', name: 'Centerbe', status: 'ok', time: '21:05' },
  { id: '3', name: 'Marco', status: 'ok', time: '21:02' },
  { id: '4', name: 'Luca', status: 'late', time: '21:20' },
];

export const RehearsalPostView: React.FC<Props> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[185] bg-background text-foreground flex flex-col overflow-y-auto">
      <ScreenHeader
        actions={<IconButton label="Close summary" icon={<X />} variant="ghost" onClick={onClose} />}
        overline={
          <span className="inline-flex items-center gap-1.5 text-success">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Rehearsal completed
          </span>
        }
        title="Weekly band practice"
      >
        <p className="bw-body-sm text-muted-foreground">Monday, Jan 27, 2026 · 2h 15m</p>
      </ScreenHeader>

      <div
        className="w-full max-w-md mx-auto px-4 pt-6 flex flex-col gap-6"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 32px)' }}
      >
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 4, label: 'Songs played', cls: '' },
            { value: 2, label: 'Need work', cls: 'text-warning' },
            { value: 1, label: 'Problem', cls: 'text-destructive' },
          ].map((s) => (
            <Card key={s.label} className="gap-2 p-4">
              <span className={cn('bw-value-lg', s.cls)}>{s.value}</span>
              <span className="bw-label-xs text-muted-foreground">{s.label}</span>
            </Card>
          ))}
        </div>

        {/* Feedback */}
        <section className="flex flex-col gap-3">
          <h3 className="bw-label-sm text-muted-foreground">Feedback summary</h3>
          {FEEDBACK.map((f) => (
            <Card key={f.song} className="gap-2">
              <div className="flex items-start justify-between gap-3">
                <h4 className="bw-h3">{f.song}</h4>
                <Tag
                  variant={f.tone === 'good' ? 'accent' : f.tone === 'work' ? 'outline' : 'solid'}
                  className={f.tone === 'problem' ? 'bg-destructive-solid text-white' : undefined}
                >
                  {f.verdict}
                </Tag>
              </div>
              <p className="bw-body-sm text-muted-foreground">“{f.note}”</p>
            </Card>
          ))}
        </section>

        {/* Attendance */}
        <section className="flex flex-col gap-3">
          <h3 className="bw-label-sm text-muted-foreground">Attendance</h3>
          <Card className="gap-0 py-2">
            {ATTENDANCE.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2">
                <CheckCircle2 className={cn('w-5 h-5 shrink-0', m.status === 'late' ? 'text-warning' : 'text-success')} />
                <span className="flex-1 min-w-0 bw-body-lg truncate">{m.name}</span>
                {m.status === 'late' && <Tag variant="outline">Late</Tag>}
                <span className="bw-label-sm text-muted-foreground shrink-0">Arrived {m.time}</span>
              </div>
            ))}
          </Card>
        </section>

        {/* Next Rehearsal Suggestion */}
        <div className="rounded-[24px] p-5 flex flex-col gap-4 bg-surface-inverse text-surface-inverse-foreground">
          <p className="flex items-center gap-2 bw-label-sm opacity-70">
            <Calendar className="w-4 h-4" />
            Next session
          </p>
          <div className="flex flex-col gap-1">
            <h3 className="bw-h2">Monday, Feb 3</h3>
            <p className="bw-body-sm opacity-70">Rehearsal Studios XYZ · 21:00</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="bw-label-sm opacity-70">Suggested focus</p>
            <ul className="flex flex-col gap-2 bw-body-md">
              {['Bohemian Rhapsody (bridge)', 'Purple Rain (modulation)', 'Superstition (new!)'].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <PillButton onClick={onClose}>Schedule next</PillButton>
        </div>

        <PillButton variant="ghost" onClick={onClose}>
          Close summary
        </PillButton>
      </div>
    </div>
  );
};
