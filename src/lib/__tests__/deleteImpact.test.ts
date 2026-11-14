import { describe, expect, it } from 'vitest';
import { setlistDeleteText, songDeleteText } from '../deleteImpact';

describe('deleteImpact', () => {
  it('says which setlists and upcoming gigs lose a song', () => {
    const text = songDeleteText({ setlists: ['Wedding set', 'Jazz night'], gigs: [{ title: 'Rossi wedding', date: '2026-12-05' }] }, true);
    expect(text).toContain('2 setlists: Wedding set and Jazz night');
    expect(text).toContain('Rossi wedding (Dec 5)');
    expect(text).toContain('recording and chart are deleted for good');
    expect(text).toMatch(/can’t be undone\.$/);
  });

  it('keeps it short when nothing uses the song, and is careful when offline', () => {
    expect(songDeleteText({ setlists: [], gigs: [] }, false)).toBe('This can’t be undone.');
    expect(songDeleteText(null, false)).toContain('every setlist');
    expect(songDeleteText({ setlists: ['A'], gigs: [] }, false)).toContain('the setlist A.');
  });

  it('names the gigs that lose a setlist (at most five)', () => {
    const gigs = Array.from({ length: 7 }, (_, i) => ({ title: `Gig ${i + 1}`, date: '2026-12-0' + (i + 1) }));
    const text = setlistDeleteText(gigs);
    expect(text).toContain('Gig 5 (Dec 5)');
    expect(text).not.toContain('Gig 6');
    expect(text).toContain('2 more');
    expect(setlistDeleteText([])).toBe('The songs stay in your library. This can’t be undone.');
  });
});
