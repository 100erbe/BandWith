import { describe, it, expect } from 'vitest';
import { calendarFile, gigEvent, gigIcs, gigWindow, googleCalendarUrl, type DeputyGig } from '../deputyCalendar';

const L = { loadIn: 'Load-in', soundcheck: 'Soundcheck', show: 'Show', role: 'Role' };
const gig: DeputyGig = {
  title: 'Wedding Rossi', bandName: 'Velvet Static', date: '2026-12-31', loadIn: '17:30:00', start: '21:00:00', end: '01:30:00',
  venue: 'Villa Clara', city: 'Como', address: 'Via Prova 1', role: 'Bass', url: 'https://bandwith-beryl.vercel.app/deputy.html?t=abc',
};

describe('deputy calendar', () => {
  it('starts at load-in and ends after midnight on the next day', () => {
    const w = gigWindow(gig);
    if (w.allDay) throw new Error('expected times');
    expect([w.start.getDate(), w.start.getHours(), w.start.getMinutes()]).toEqual([31, 17, 30]);
    expect([w.end.getFullYear(), w.end.getMonth(), w.end.getDate(), w.end.getHours()]).toEqual([2027, 0, 1, 1]);
  });

  it('lasts 3 hours from the show when there is no end time, all day without times', () => {
    const w = gigWindow({ ...gig, end: null });
    if (w.allDay) throw new Error('expected times');
    expect(w.end.getHours()).toBe(0);
    expect(gigWindow({ ...gig, loadIn: null, start: null, end: null }).allDay).toBe(true);
  });

  it('writes a valid .ics', () => {
    const ics = gigIcs(gig, L, 'req-1', { now: new Date(Date.UTC(2026, 10, 13, 10, 0, 0)) });
    expect(ics).toContain('DTSTART:20261231T173000');
    expect(ics).toContain('DTEND:20270101T013000');
    expect(ics).toContain('SUMMARY:Wedding Rossi · Velvet Static');
    expect(ics).toContain('LOCATION:Villa Clara\\, Via Prova 1\\, Como');
    expect(ics).toContain('DTSTAMP:20261113T100000Z');
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    const allDay = gigIcs({ ...gig, loadIn: null, start: null, end: null }, L, 'req-2');
    expect(allDay).toContain('DTSTART;VALUE=DATE:20261231');
    expect(allDay).toContain('DTEND;VALUE=DATE:20270101');
  });

  it('keeps the UID and raises SEQUENCE when the gig changes; marks cancellations', () => {
    const a = gigEvent(gig, L, 'r1', { updatedAt: '2026-11-13T10:00:00Z' }).join('\n');
    const b = gigEvent(gig, L, 'r1', { updatedAt: '2026-11-14T10:00:00Z', cancelled: true }).join('\n');
    const seq = (s: string) => Number(/SEQUENCE:(\d+)/.exec(s)![1]);
    expect(a).toContain('UID:r1@bandwith');
    expect(seq(b)).toBeGreaterThan(seq(a));
    expect(a).toContain('STATUS:CONFIRMED');
    expect(b).toContain('STATUS:CANCELLED');
    const feed = calendarFile([gigEvent(gig, L, 'r1'), gigEvent({ ...gig, date: '2027-01-05' }, L, 'r2')], 'Velvet Static · BandWith');
    expect(feed.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(feed).toContain('X-WR-CALNAME:Velvet Static · BandWith');
  });

  it('builds a Google Calendar link', () => {
    const u = new URL(googleCalendarUrl(gig, L));
    expect(u.searchParams.get('dates')).toBe('20261231T173000/20270101T013000');
    expect(u.searchParams.get('location')).toBe('Villa Clara, Via Prova 1, Como');
    expect(u.searchParams.get('details')).toContain('Load-in 17:30');
  });
});
