/**
 * Rider & stage set in the iPad gig composer (Figma iPad · 04 "New gig"),
 * saved once the gig exists: the stage (092) and, when asked, the rider
 * document linked to the gig (Contracts & docs), as on the gig's Rider &
 * stage tab.
 */
import { getLocale, t } from '@/lib/i18n';
import type { StageData } from '../stagePlot';
import { saveEventStage } from './eventStage';
import { createContract, standardTerms } from './contracts';

export interface ComposerStagePayload {
  stage: StageData | null;
  createRider: boolean;
}

/** Reads the composer's payload from the create-gig data (`_stage`, `_createRider`). */
export function composerStageOf(data: { _stage?: unknown; _createRider?: unknown }): ComposerStagePayload | null {
  const stage = data._stage && typeof data._stage === 'object' ? (data._stage as StageData) : null;
  const createRider = data._createRider === true;
  return stage || createRider ? { stage, createRider } : null;
}

/** Saves what the composer set. Returns the first error message, or null. */
export async function persistComposerStage(
  eventId: string,
  bandId: string,
  payload: ComposerStagePayload,
  gig: { title: string; date?: string; venue?: string },
): Promise<string | null> {
  let failed: string | null = null;
  if (payload.stage) {
    const { error } = await saveEventStage(eventId, bandId, payload.stage);
    if (error) failed = error.message;
  }
  if (payload.createRider) {
    const { error } = await createContract({
      bandId,
      type: 'rider',
      title: t('Technical rider · {event}', { event: gig.title }),
      clientName: gig.venue || gig.title,
      eventName: gig.title,
      eventDate: gig.date,
      content: standardTerms('rider', getLocale()),
      eventId,
    });
    if (error && !failed) failed = error.message;
  }
  return failed;
}
