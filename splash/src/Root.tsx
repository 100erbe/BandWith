import React from 'react';
import { Composition } from 'remotion';
import { DURATION, FPS, Splash } from './Splash';

/**
 * iPhone      1290×2796 (6.9" @3x, the largest portrait phone canvas)
 * iPhoneDuo   cover / outer display, 466×678 pt @3x
 */
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Splash" component={Splash} durationInFrames={DURATION} fps={FPS} width={1290} height={2796} />
    <Composition id="SplashCover" component={Splash} durationInFrames={DURATION} fps={FPS} width={1398} height={2034} />
  </>
);
