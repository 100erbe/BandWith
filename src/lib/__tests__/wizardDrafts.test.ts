import { describe, it, expect, beforeEach } from 'vitest';
import { listEventDrafts, saveEventDraft, deleteEventDraft, newDraftId } from '../wizardDrafts';

describe('wizardDrafts', () => {
  beforeEach(() => localStorage.clear());

  it('saves, updates in place and deletes drafts per user and band', () => {
    const id = newDraftId();
    saveEventDraft({ id, userId: 'u1', bandId: 'b1', title: 'Wedding Gig', state: { step: 1 } });
    saveEventDraft({ id: newDraftId(), userId: 'u2', bandId: 'b1', title: 'Other', state: {} });
    expect(listEventDrafts('u1', 'b1').map((d) => d.title)).toEqual(['Wedding Gig']);
    expect(listEventDrafts('u1', 'b2')).toEqual([]);

    saveEventDraft({ id, userId: 'u1', bandId: 'b1', title: 'Wedding Gig · Rossi', state: { step: 2 } });
    const mine = listEventDrafts('u1', 'b1');
    expect(mine).toHaveLength(1);
    expect(mine[0].title).toBe('Wedding Gig · Rossi');
    expect(mine[0].state).toEqual({ step: 2 });

    deleteEventDraft(id);
    expect(listEventDrafts('u1', 'b1')).toEqual([]);
    expect(listEventDrafts(null)).toEqual([]);
  });
});
