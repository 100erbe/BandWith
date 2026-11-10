import React from 'react';
import { IconProps } from './IconBase';
import { box, dot, dotIcon, ring } from './dots';
import { CheckCheck, Drum, Guitar, Mic2, Music, Plus, MessageCircle, X, Calendar, Home } from './custom-icons';

/* ═══════════════════════════════════════════════════════════════════════════
   BandWith Dot Icons — app chrome, status & instruments.
   Third-party marks (Google, Apple, Spotify, Apple Music) at the bottom of
   this file stay exactly as their owners draw them.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Connection status: two jacks, plugged / unplugged ── */

const PLUG = `M9 2V5.5M15 2V5.5M6 9H18V11.5A6 6 0 0 1 6 11.5Z${dot(12, 21)}`;

/** Live connection: a plugged power jack. */
export const PlugsConnectedIcon = dotIcon('PlugsConnectedIcon', { d: PLUG });

/** Offline: the same jack, struck through. */
export const PlugsDisconnectedIcon = dotIcon('PlugsDisconnectedIcon', { d: `${PLUG}M3 3L21 21` });

/** Delivered/read ticks, drawn in the success colour. */
export const ChecksIcon: React.FC<IconProps> = ({ style, ...props }) => (
  <CheckCheck {...props} style={{ color: 'var(--success, currentColor)', ...style }} />
);

/* ── Bottom navigation ── */

export const IconHome = Home;
export const IconCalendar = Calendar;
export const IconMusic = Music;
export const IconPlus = Plus;
export const IconChat = MessageCircle;
export const IconClose = X;

export const IconSettings = dotIcon('IconSettings', {
  d: `M4 8H7.5M18.5 8H20${dot(4, 16)}M15 16H20`,
  solid: [
    [13, 8, 2],
    [10, 16, 2],
  ],
});

export const IconMenu = dotIcon('IconMenu', { d: `M4 6H20M4 12H20M4 18H13${dot(17, 18)}` });

/* ── Instruments ── */

export const InstrumentGuitar = Guitar;

export const InstrumentBass = dotIcon('InstrumentBass', {
  d: `${ring(8, 16, 4.5, 9, -25)}M13.3 10.7L19 5${dot(21.5, 2.5)}`,
  solid: [[8, 16, 1]],
});

export const InstrumentDrums = Drum;
export const InstrumentVocals = Mic2;

export const InstrumentKeys = dotIcon('InstrumentKeys', {
  d: box(2.5, 4.5, 19, 15) + dot(7.5, 16, 12, 16, 16.5, 16),
  bold: 'M7.5 8.5V10.5M12 8.5V10.5M16.5 8.5V10.5',
  boldScale: 1.6,
});

export const InstrumentSax = dotIcon('InstrumentSax', {
  d: `M5.5 3L9 5V15A4 4 0 0 0 17 15V10.5M14.5 7H19.5${dot(5.5, 9.5, 5.5, 13)}`,
});

export const InstrumentTrumpet = dotIcon('InstrumentTrumpet', {
  d: `${dot(2.5, 13)}M6 13H14.5M17 9.5L21.5 7V19L17 16.5M7.5 8.5V10M10.5 8.5V10M13.5 8.5V10`,
});

export const InstrumentViolin = dotIcon('InstrumentViolin', {
  d: `M12 9.5C9 9.5 8 11 9 13S7 16 7 18A4 4 0 0 0 17 18C17 16 14 15 15 13S15 9.5 12 9.5ZM12 2.5V7${dot(10.5, 17, 13.5, 17)}`,
});

export const InstrumentDJ = dotIcon('InstrumentDJ', {
  d: `${box(2.5, 4, 19, 16)}${ring(10, 12, 4.5, 8)}M17.5 8.5V15.5`,
  solid: [[10, 12, 1]],
});

export const InstrumentOther = dotIcon('InstrumentOther', {
  d: ring(12, 12, 9.5, 16) + dot(8, 12, 12, 12, 16, 12),
});

export const InstrumentIcon: React.FC<IconProps & { instrumentId: string }> = ({
  instrumentId,
  ...props
}) => {
  const key = (instrumentId || '').toLowerCase();
  if (key === 'guitar') return <InstrumentGuitar {...props} />;
  if (key === 'bass') return <InstrumentBass {...props} />;
  if (key === 'drums') return <InstrumentDrums {...props} />;
  if (key === 'vocals') return <InstrumentVocals {...props} />;
  if (key === 'keys' || key === 'piano' || key === 'keyboard') return <InstrumentKeys {...props} />;
  if (key === 'saxophone' || key === 'sax') return <InstrumentSax {...props} />;
  if (key === 'trumpet' || key === 'brass' || key === 'horns') return <InstrumentTrumpet {...props} />;
  if (key === 'violin' || key === 'strings' || key === 'cello') return <InstrumentViolin {...props} />;
  if (key === 'dj' || key === 'turntable') return <InstrumentDJ {...props} />;
  return <InstrumentOther {...props} />;
};

/* ── Third-Party OAuth & Music Streaming Marks ── */

/** Official Google "G" (logo_googleg_48dp, Google Sign-In branding assets). Keep the four colours. */
export const GoogleBrandIcon: React.FC<IconProps> = ({ size = 20, className = '', ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="-1 0 120 120"
    aria-hidden={props['aria-label'] ? undefined : true}
    className={className}
    {...props}
  >
    <path fill="#4285F4" d="M117.6,61.3636364 C117.6,57.1090909 117.218182,53.0181818 116.509091,49.0909091 L60,49.0909091 L60,72.3 L92.2909091,72.3 C90.9,79.8 86.6727273,86.1545455 80.3181818,90.4090909 L80.3181818,105.463636 L99.7090909,105.463636 C111.054545,95.0181818 117.6,79.6363636 117.6,61.3636364 L117.6,61.3636364 Z" />
    <path fill="#34A853" d="M60,120 C76.2,120 89.7818182,114.627273 99.7090909,105.463636 L80.3181818,90.4090909 C74.9454545,94.0090909 68.0727273,96.1363636 60,96.1363636 C44.3727273,96.1363636 31.1454545,85.5818182 26.4272727,71.4 L6.38181818,71.4 L6.38181818,86.9454545 C16.2545455,106.554545 36.5454545,120 60,120 L60,120 Z" />
    <path fill="#FBBC05" d="M26.4272727,71.4 C25.2272727,67.8 24.5454545,63.9545455 24.5454545,60 C24.5454545,56.0454545 25.2272727,52.2 26.4272727,48.6 L26.4272727,33.0545455 L6.38181818,33.0545455 C2.31818182,41.1545455 0,50.3181818 0,60 C0,69.6818182 2.31818182,78.8454545 6.38181818,86.9454545 L26.4272727,71.4 L26.4272727,71.4 Z" />
    <path fill="#EA4335" d="M60,23.8636364 C68.8090909,23.8636364 76.7181818,26.8909091 82.9363636,32.8363636 L100.145455,15.6272727 C89.7545455,5.94545455 76.1727273,0 60,0 C36.5454545,0 16.2545455,13.4454545 6.38181818,33.0545455 L26.4272727,48.6 C31.1454545,34.4181818 44.3727273,23.8636364 60,23.8636364 L60,23.8636364 Z" />
  </svg>
);

/** Official Apple logo, as drawn by Apple's Sign in with Apple JS button. Single colour (currentColor). */
export const AppleBrandIcon: React.FC<IconProps> = ({ size = 20, className = '', ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="18.5 16 19 19"
    fill="currentColor"
    aria-hidden={props['aria-label'] ? undefined : true}
    className={className}
    {...props}
  >
    <path fillRule="nonzero" d="M28.2226562,20.3846154 C29.0546875,20.3846154 30.0976562,19.8048315 30.71875,19.0317864 C31.28125,18.3312142 31.6914062,17.352829 31.6914062,16.3744437 C31.6914062,16.2415766 31.6796875,16.1087095 31.65625,16 C30.7304687,16.0362365 29.6171875,16.640178 28.9492187,17.4494596 C28.421875,18.06548 27.9414062,19.0317864 27.9414062,20.0222505 C27.9414062,20.1671964 27.9648438,20.3121424 27.9765625,20.3604577 C28.0351562,20.3725366 28.1289062,20.3846154 28.2226562,20.3846154 Z M25.2929688,35 C26.4296875,35 26.9335938,34.214876 28.3515625,34.214876 C29.7929688,34.214876 30.109375,34.9758423 31.375,34.9758423 C32.6171875,34.9758423 33.4492188,33.792117 34.234375,32.6325493 C35.1132812,31.3038779 35.4765625,29.9993643 35.5,29.9389701 C35.4179688,29.9148125 33.0390625,28.9122695 33.0390625,26.0979021 C33.0390625,23.6579784 34.9140625,22.5588048 35.0195312,22.474253 C33.7773438,20.6382708 31.890625,20.5899555 31.375,20.5899555 C29.9804688,20.5899555 28.84375,21.4596313 28.1289062,21.4596313 C27.3554688,21.4596313 26.3359375,20.6382708 25.1289062,20.6382708 C22.8320312,20.6382708 20.5,22.5950413 20.5,26.2911634 C20.5,28.5861411 21.3671875,31.013986 22.4335938,32.5842339 C23.3476562,33.9129053 24.1445312,35 25.2929688,35 Z" />
  </svg>
);

export const SpotifyBrandIcon: React.FC<IconProps> = ({ size = 24, className = '', ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden={props['aria-label'] ? undefined : true}
    className={className}
    {...props}
  >
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
  </svg>
);

export const AppleMusicBrandIcon: React.FC<IconProps> = ({ size = 24, className = '', ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden={props['aria-label'] ? undefined : true}
    className={className}
    {...props}
  >
    <path d="M16.5 3.25a.75.75 0 0 1 .94-.72l.06.02v12.2a3.25 3.25 0 1 1-1.5-2.73V7.3l-7 1.55v7.9a3.25 3.25 0 1 1-1.5-2.73V5.4a.75.75 0 0 1 .59-.73l8-1.78a.75.75 0 0 1 .41.36Z" />
  </svg>
);
