import { describe, it, expect } from 'vitest';
import {
  deputyRecapText,
  deputyReplyUrl,
  deputyRequestText,
  deputyUpdateText,
  latestRequestByDeputy,
  type DeputyRequest,
} from '../services/deputies';
import { deputyMessageMode } from '@/app/components/band/AskDeputySheet';

const gig = {
  deputyName: 'Leo Marini',
  bandName: 'Velvet Static',
  eventTitle: 'Wedding Rossi',
  dateLabel: 'Sat 14 Nov 2026',
  timeLabel: '22:00',
  loadInLabel: '18:00',
  venue: 'Villa Clara, Via Prova 1, Como',
  role: 'Bass',
  fee: '€150',
  link: deputyReplyUrl('a'.repeat(64)),
};

const req = (o: Partial<DeputyRequest>): DeputyRequest => ({
  id: 'r', event_id: 'e', deputy_id: 'd1', deputy_name: 'Leo', replaces_user_id: null, role: null, fee_offered: null,
  token: 't', status: 'pending', reply_note: null, responded_at: null, created_at: '2026-11-13T10:00:00Z', ...o,
});

describe('deputy requests', () => {
  it('puts the reply link in the request', () => {
    const text = deputyRequestText(gig);
    expect(text).toContain('Hi Leo');
    expect(text).toContain('https://bandwith-beryl.vercel.app/deputy.html?t=' + 'a'.repeat(64));
    expect(deputyRequestText({ ...gig, link: null })).toContain('Let us know as soon as you can');
  });

  it('writes the recap and the update with load-in and link', () => {
    const recap = deputyRecapText(gig);
    expect(recap).toContain("you're confirmed for \"Wedding Rossi\"");
    expect(recap).toContain('Load-in 18:00');
    expect(recap).toContain('Via Prova 1');
    const update = deputyUpdateText(gig);
    expect(update).toContain('has changed');
    expect(update).toContain('Can you still make it? Answer here:');
  });

  it('picks the message: request, recap after a yes, update after a change', () => {
    expect(deputyMessageMode(undefined)).toBe('request');
    expect(deputyMessageMode(req({ status: 'pending' }))).toBe('request');
    expect(deputyMessageMode(req({ status: 'available', changes: [] }))).toBe('recap');
    expect(deputyMessageMode(req({ status: 'available', changes: ['start'] }))).toBe('update');
    expect(deputyMessageMode(req({ status: 'maybe', changes: ['venue'] }))).toBe('update');
    expect(deputyMessageMode(req({ status: 'cancelled' }))).toBe('request');
  });

  it('keeps the newest live request per deputy', () => {
    const rows = [
      req({ id: 'new', status: 'cancelled' }),
      req({ id: 'old', status: 'available' }),
      req({ id: 'other', deputy_id: 'd2', status: 'cancelled' }),
    ];
    const latest = latestRequestByDeputy(rows);
    expect(latest.d1.id).toBe('old');
    expect(latest.d2.id).toBe('other');
  });
});
