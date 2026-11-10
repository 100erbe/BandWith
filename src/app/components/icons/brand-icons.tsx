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

export const GoogleBrandIcon: React.FC<IconProps> = ({ size = 20, className = '', ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden={props['aria-label'] ? undefined : true}
    className={className}
    {...props}
  >
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

export const AppleBrandIcon: React.FC<IconProps> = ({ size = 20, className = '', ...props }) => (
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
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
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
