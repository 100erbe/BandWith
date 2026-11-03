import React from 'react';
import { createIcon, IconProps } from './IconBase';

/* ── BandWith Stage Audio Jacks (Connection Status) ── */

export const PlugsConnectedIcon = createIcon(
  'PlugsConnectedIcon',
  () => (
    <>
      <path d="M14.106 7.76854L7.76881 14.1058C6.74369 15.1309 6.74369 16.7929 7.76881 17.8181L10.1818 20.2311C11.2069 21.2562 12.869 21.2562 13.8941 20.2311L20.2314 13.8938C21.2565 12.8687 21.2565 11.2067 20.2314 10.1815L17.8183 7.76854C16.7932 6.74341 15.1312 6.74341 14.106 7.76854Z" />
      <path d="M9.625 9.625L18.375 18.375" />
      <path d="M25.3752 2.625L19.0248 8.97531" />
      <path d="M8.97531 19.0244L2.625 25.3747" />
      <path d="M10.5 3.5L11.375 5.6875" />
      <path d="M3.5 10.5L5.6875 11.375" />
      <path d="M22.3125 16.625L24.5 17.5" />
      <path d="M16.625 22.3125L17.5 24.5" />
    </>
  ),
  '0 0 28 28',
  1.85
);

export const PlugsDisconnectedIcon = createIcon(
  'PlugsDisconnectedIcon',
  () => (
    <>
      <path d="M15.75 15.75L13.125 18.375" />
      <path d="M12.25 12.25L9.625 14.875" />
      <path d="M7 12.25L15.75 21" />
      <path d="M6.35031 21.6494L2.625 25.3747" />
      <path d="M14.4375 19.6875L11.2656 22.8594C10.7734 23.3516 10.1057 23.6282 9.40955 23.6282C8.71339 23.6282 8.04574 23.3516 7.55346 22.8594L5.14065 20.4433C4.64941 19.9511 4.3735 19.2842 4.3735 18.5888C4.3735 17.8935 4.64941 17.2265 5.14065 16.7344L8.31252 13.5625" />
      <path d="M12.25 7L21 15.75" />
      <path d="M21.6496 6.35031L25.3749 2.625" />
      <path d="M19.6875 14.4373L22.8594 11.2654C23.3516 10.7732 23.6282 10.1055 23.6282 9.40934C23.6282 8.71318 23.3516 8.04553 22.8594 7.55325L20.4433 5.14044C19.9511 4.64919 19.2842 4.37329 18.5888 4.37329C17.8935 4.37329 17.2265 4.64919 16.7344 5.14044L13.5625 8.31231" />
    </>
  ),
  '0 0 28 28',
  1.85
);

export const ChecksIcon = createIcon(
  'ChecksIcon',
  () => (
    <>
      <path d="M3 24.4294L10.2 31.5L27 15" stroke="var(--success, currentColor)" />
      <path d="M23.6177 27L28.2002 31.5L45.0002 15" stroke="var(--success, currentColor)" />
    </>
  ),
  '0 0 48 48',
  3
);

/* ── Primary Bottom Navigation Dock Icons (Architectural 2.65px–2.85px Suite) ── */

export const IconHome = createIcon(
  'IconHome',
  () => (
    <path d="M4 10.8V18.5A2 2 0 0 0 6 20.5h12a2 2 0 0 0 2-2v-7.7a2 2 0 0 0-.72-1.54l-6-5a2 2 0 0 0-2.56 0l-6 5A2 2 0 0 0 4 10.8Z" />
  ),
  '0 0 24 24',
  2.65
);

export const IconCalendar = createIcon(
  'IconCalendar',
  () => (
    <>
      <rect x="3.5" y="4.5" width="17" height="16" rx="3" />
      <path d="M8 2.75v3" />
      <path d="M16 2.75v3" />
      <path d="M3.5 9.75h17" />
    </>
  ),
  '0 0 24 24',
  2.65
);

export const IconMusic = createIcon(
  'IconMusic',
  () => (
    <>
      <circle cx="6.25" cy="18" r="2.75" />
      <circle cx="17.25" cy="15.75" r="2.75" />
      <path d="M9 18V5.5l11-2.25v12.5" />
      <path d="M9 9.5l11-2.25" />
    </>
  ),
  '0 0 24 24',
  2.65
);

export const IconPlus = createIcon(
  'IconPlus',
  () => (
    <>
      <path d="M4.25 12h15.5" />
      <path d="M12 4.25v15.5" />
    </>
  ),
  '0 0 24 24',
  2.85
);

export const IconChat = createIcon(
  'IconChat',
  () => (
    <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8.5a2.5 2.5 0 0 1-2.5 2.5H8.2L4.6 20.6A.5.5 0 0 1 4 20.2V6.5Z" />
  ),
  '0 0 24 24',
  2.65
);

export const IconMenu = createIcon(
  'IconMenu',
  () => (
    <>
      <path d="M4 6.5h16" />
      <path d="M4 12h16" />
      <path d="M4 17.5h16" />
    </>
  ),
  '0 0 24 24',
  2.65
);

export const IconClose = createIcon(
  'IconClose',
  () => (
    <>
      <path d="M5.25 5.25l13.5 13.5" />
      <path d="M18.75 5.25l-13.5 13.5" />
    </>
  ),
  '0 0 24 24',
  2.65
);

/* ── Bespoke Musical Instrument Vector Suite (24×24 Studio Proportions) ── */

export const InstrumentGuitar = createIcon('InstrumentGuitar', () => (
  <>
    <path d="M11.6 12.4c-2.1-.9-4.6-.4-6.2 1.2a4.4 4.4 0 0 0 6.2 6.2c1.6-1.6 2.1-4.1 1.2-6.2" />
    <circle cx="9.2" cy="14.8" r="1.2" />
    <path d="M12.4 11.6 18.5 5.5" />
    <path d="M17.5 3.5l3 3" />
  </>
));

export const InstrumentBass = createIcon('InstrumentBass', () => (
  <>
    <path d="M10.8 13.2c-2-.8-4.3-.3-5.8 1.2a4.1 4.1 0 0 0 5.8 5.8c1.5-1.5 2-3.8 1.2-5.8" />
    <path d="M8 14.6l1.4 1.4" />
    <path d="M11.6 12.4 19.2 4.8" />
    <path d="M18.4 2.8 21.2 5.6l-1.3 1.3" />
  </>
));

export const InstrumentDrums = createIcon('InstrumentDrums', () => (
  <>
    <ellipse cx="12" cy="11.5" rx="8" ry="2.8" />
    <path d="M4 11.5v5c0 1.55 3.58 2.8 8 2.8s8-1.25 8-2.8v-5" />
    <path d="M8.5 14.1v4.9" />
    <path d="M15.5 14.1v4.9" />
    <path d="M5.5 3.5 11.5 8" />
    <path d="M18.5 3.5 12.5 8" />
  </>
));

export const InstrumentVocals = createIcon('InstrumentVocals', () => (
  <>
    <circle cx="16.5" cy="7.5" r="4" />
    <path d="M13.7 4.7l5.6 5.6" />
    <path d="M13.3 8 4.7 16.6a2.1 2.1 0 0 0 2.7 2.7L16 10.7" />
    <path d="M3 21l2-2" />
  </>
));

export const InstrumentKeys = createIcon('InstrumentKeys', () => (
  <>
    <rect x="2.5" y="5" width="19" height="14" rx="3" />
    <path d="M7 5v7" />
    <path d="M11 5v7" />
    <path d="M16.5 5v7" />
    <path d="M2.5 12h19" />
    <path d="M9 12v7" />
    <path d="M14 12v7" />
  </>
));

export const InstrumentSax = createIcon('InstrumentSax', () => (
  <>
    <path d="M6.5 3.5H9l1.5 2V15a2.75 2.75 0 0 0 5.5 0v-2.5" />
    <path d="M13.5 12.5h5" />
    <path d="M10.5 8.5h2" />
    <path d="M10.5 11.5h2" />
  </>
));

export const InstrumentTrumpet = createIcon('InstrumentTrumpet', () => (
  <>
    <path d="M3 11h12c2.2 0 4.2-1.2 5.5-3v8c-1.3-1.8-3.3-3-5.5-3H7a2 2 0 0 1 0-4" />
    <path d="M3 9.5v3" />
    <path d="M8.5 8v3" />
    <path d="M11 8v3" />
    <path d="M13.5 8v3" />
  </>
));

export const InstrumentViolin = createIcon('InstrumentViolin', () => (
  <>
    <path d="M11.6 12.4c-2.1-.9-4.5-.4-6.1 1.2a4.3 4.3 0 0 0 6.1 6.1c1.6-1.6 2.1-4 1.2-6.1" />
    <path d="M8.2 14.4l2.4 2.4" />
    <path d="M12.4 11.6 19 5a1.4 1.4 0 1 1 1.8 1.8" />
    <path d="M15.5 4.5l4 4" />
  </>
));

export const InstrumentDJ = createIcon('InstrumentDJ', () => (
  <>
    <rect x="2.5" y="4" width="19" height="16" rx="3" />
    <circle cx="10.25" cy="12" r="4.75" />
    <circle cx="10.25" cy="12" r="1.25" />
    <path d="M18.25 7.5v5l-1.75 2.25" />
  </>
));

export const InstrumentOther = createIcon('InstrumentOther', () => (
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M8.5 12h7" />
    <path d="M12 8.5v7" />
  </>
));

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
