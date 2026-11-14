import { describe, it, expect } from 'vitest';
import { localizePushLabel, pushLanguage, pushCollapseId, pushThreadId } from '../pushLabels';

describe('push labels', () => {
  it('reads the reader language from the profile', () => {
    expect(pushLanguage('it')).toBe('it');
    expect(pushLanguage('pt-BR')).toBe('pt');
    expect(pushLanguage('en')).toBeNull();
    expect(pushLanguage(null)).toBeNull();
  });

  it('translates the label and keeps the event title', () => {
    expect(localizePushLabel('Gig Alert · Summer Fest', 'it')).toBe('Avviso gig · Summer Fest');
    expect(localizePushLabel('Private Message', 'de')).toBe('Private Nachricht');
    expect(localizePushLabel('Band Chat', 'fr')).toBe('Discussion du groupe');
  });

  it('leaves band names, unknown labels and English as they are', () => {
    expect(localizePushLabel('Velvet Static', 'es')).toBe('Velvet Static');
    expect(localizePushLabel('Gig Alert · Summer Fest', null)).toBe('Gig Alert · Summer Fest');
    expect(localizePushLabel(undefined, 'it')).toBeUndefined();
  });

  it('collapses only duplicate invites to the same event', () => {
    expect(pushCollapseId('event_invite', { event_id: 'e1' })).toBe('invite:e1');
    expect(pushCollapseId('chat_message', { chat_id: 'c1', tag: 'Direct Message' })).toBeUndefined();
    expect(pushCollapseId('member_dropped_out', { event_id: 'e1', tag: 'Gig Alert' })).toBeUndefined();
  });

  it('groups by chat, then by event', () => {
    expect(pushThreadId({ chat_id: 'c1', event_id: 'e1' })).toBe('chat:c1');
    expect(pushThreadId({ event_id: 'e1' })).toBe('event:e1');
    expect(pushThreadId({})).toBeUndefined();
  });
});
