import { describe, expect, it } from 'vitest';
import { composerStageOf } from '@/lib/services/composerStage';
import { EMPTY_STAGE } from '@/lib/stagePlot';

describe('composerStageOf', () => {
  it('is null when the composer set nothing', () => {
    expect(composerStageOf({})).toBeNull();
    expect(composerStageOf({ _stage: null, _createRider: false })).toBeNull();
  });

  it('keeps the stage and the rider request', () => {
    expect(composerStageOf({ _stage: EMPTY_STAGE, _createRider: true })).toEqual({ stage: EMPTY_STAGE, createRider: true });
    expect(composerStageOf({ _createRider: true })).toEqual({ stage: null, createRider: true });
    expect(composerStageOf({ _stage: 'x', _createRider: 'yes' })).toBeNull();
  });
});
