import { createIcon } from './IconBase';
import {
  CLOUD,
  DOC,
  arc,
  arcDots,
  box,
  dot,
  dotIcon,
  head,
  open,
  ring,
  seg,
  star,
} from './dots';

/* ═══════════════════════════════════════════════════════════════════════════
   BandWith Dot Icons — UI & domain set
   Built only from pills and dots (see ./dots.tsx for the rules). Same export
   names and props as before (size, color, strokeWidth, className), so every
   call site keeps working.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── 1. Music & audio ── */

export const Music = dotIcon('Music', {
  d: 'M8.75 18V8.5M18.75 16V6.5M8.75 5L18.75 3',
  solid: [
    [6.5, 18, 2.25],
    [16.5, 16, 2.25],
  ],
});

export const Music2 = dotIcon('Music2', {
  d: `M11.5 18V4M15 5L18.5 8.5${dot(18.5, 12)}`,
  solid: [[9, 18, 2.5]],
});

export const ListMusic = dotIcon('ListMusic', {
  d: `${dot(3, 6)}M7 6H14${dot(3, 12)}M7 12H12${dot(3, 18)}M7 18H10M17.75 17.5V8${dot(21, 9.25)}`,
  solid: [[16, 18, 1.75]],
});

export const FileMusic = dotIcon('FileMusic', {
  d: `${DOC}M12.25 16.5V10.5${dot(15.5, 12)}`,
  solid: [[10.5, 16.5, 1.5]],
});

export const Disc3 = dotIcon('Disc3', {
  d: ring(12, 12, 9.5, 16) + arc(12, 12, 5.5, 195, 255),
  solid: [[12, 12, 1.5]],
});

export const Guitar = dotIcon('Guitar', {
  d: `${ring(9, 15, 5.5, 10, -27)}M15 9L18.5 5.5${dot(21, 3)}`,
  solid: [[9, 15, 1.25]],
});

export const Mic2 = dotIcon('Mic2', {
  d: 'M10.5 13.5L4.5 19.5',
  solid: [[15.5, 8.5, 3.25]],
});

export const Mic = dotIcon('Mic', {
  d: `${arc(12, 11, 6.5, 0, 180)}M9.5 21H14.5`,
  bold: 'M12 6V10',
  boldScale: 3.5,
});

export const Drum = dotIcon('Drum', {
  d: `M4 8a8 3 0 1 0 16 0a8 3 0 1 0-16 0M4 12.5V16M20 12.5V16M7 19.6C9.5 20.5 14.5 20.5 17 19.6${dot(8, 14.5, 12, 15.5, 16, 14.5)}`,
});

export const Sliders = dotIcon('Sliders', {
  d: `M3 6H8M18 6H21M12 12H21M3 18H11${dot(21, 18)}`,
  solid: [
    [13, 6, 1.5],
    [7, 12, 1.5],
    [16, 18, 1.5],
  ],
});

const SPEAKER = 'M3.5 10V14M7.5 8.5L11.5 5M7.5 15.5L11.5 19M11.5 8.5V15.5';

export const Volume2 = dotIcon('Volume2', {
  d: SPEAKER + arc(12, 12, 4.5, -40, 40) + arcDots(12, 12, 8.5, -45, 45, 4),
});

export const VolumeX = dotIcon('VolumeX', {
  d: SPEAKER + dot(16, 9.5, 21, 9.5, 18.5, 12, 16, 14.5, 21, 14.5),
});

export const Play = dotIcon('Play', { fill: 'M8 5.5v13l10.5-6.5z', d: 'M8 5.5v13l10.5-6.5z' });

export const Pause = dotIcon('Pause', { bold: 'M8.5 6v12M15.5 6v12', boldScale: 1.75 });

export const Repeat = dotIcon('Repeat', {
  d: 'M4 11V9.5A3.5 3.5 0 0 1 7.5 6H15M17.5 3L20.5 6L17.5 9M20 13V14.5A3.5 3.5 0 0 1 16.5 18H9M6.5 15L3.5 18L6.5 21',
});

export const SkipForward = dotIcon('SkipForward', {
  fill: 'M5 6v12l9-6z',
  d: 'M5 6v12l9-6zM18.5 6V18',
});

export const SkipBack = dotIcon('SkipBack', {
  fill: 'M19 6v12l-9-6z',
  d: 'M19 6v12l-9-6zM5.5 6V18',
});

export const Radio = dotIcon('Radio', {
  d:
    arc(12, 12, 5, -40, 40) +
    arc(12, 12, 5, 140, 220) +
    arcDots(12, 12, 9, -40, 40, 3) +
    arcDots(12, 12, 9, 140, 220, 3),
  solid: [[12, 12, 1.5]],
});

/* ── 2. Calendar, time & logistics ── */

const CAL = 'M3.5 8V18.5M20.5 8V18.5M7 21.5H17M11 4.5H13M7.5 2.5V6.5M16.5 2.5V6.5';

export const Calendar = dotIcon('Calendar', {
  d: CAL + dot(8, 11.5, 12, 11.5, 16, 11.5, 8, 16, 12, 16, 16, 16),
});

export const CalendarPlus = dotIcon('CalendarPlus', { d: `${CAL}M12 11V17M9 14H15` });

export const Clock = dotIcon('Clock', { d: `${ring(12, 12, 9.5, 12)}M12 7.5V12L15 14` });

export const Timer = dotIcon('Timer', { d: `${ring(12, 13.5, 8, 12)}M10 2H14M12 13.5L15 10.5` });

export const History = dotIcon('History', {
  d: arcDots(12, 12, 9, 275, 485, 7) + arc(12, 12, 9, 245, 205) + head(12, 12, 9, 205, -1) + 'M12 7.5V12L15 14',
});

export const MapPin = dotIcon('MapPin', {
  d: `${arc(12, 9.5, 6.5, 145, 395)}M9 16.3L10.4 18.3M15 16.3L13.6 18.3${dot(12, 21.5)}`,
  solid: [[12, 9.5, 1.75]],
});

export const Truck = dotIcon('Truck', {
  d: 'M2.5 6.5V12.5M5.5 3.5H11.5M14.5 6.5V12.5M17.5 8H19L21.5 11V14.5',
  solid: [
    [6.5, 18.5, 1.75],
    [17.5, 18.5, 1.75],
  ],
});

export const Briefcase = dotIcon('Briefcase', {
  d: `M3.5 10.5V18M20.5 10.5V18M6.5 7.5H17.5M6.5 21H17.5M9.5 3.5H14.5${dot(12, 14)}`,
});

export const Hotel = dotIcon('Hotel', {
  d: `M3.5 5V19.5M7.5 15.5H20.5${dot(20.5, 19.5)}M13 10.5H18.5`,
  solid: [[8, 10.5, 1.5]],
});

export const Plane = dotIcon('Plane', {
  d: 'M12 2.5V17M3 14.5L12 10L21 14.5M8.5 21L12 19.25L15.5 21',
  transform: 'rotate(45 12 12)',
});

const FORK = 'M5 3V7.5M10 3V7.5M5 11a2.5 2.5 0 0 0 5 0M7.5 17V21.5';
const KNIFE = 'M18 3C15.5 5 14.5 8.5 14.5 12H18V3M18 15.5V21.5';

export const Utensils = dotIcon('Utensils', { d: FORK + KNIFE });

export const UtensilsCrossed = dotIcon('UtensilsCrossed', [
  { d: 'M10.5 2.5V6.5M13.5 2.5V6.5M10.5 9.5a1.5 1.5 0 0 0 3 0M12 13V21.5', transform: 'rotate(-40 12 12)' },
  { d: 'M12 2.5C10.2 4 9.5 6.5 9.5 9.5H12V2.5M12 13V21.5', transform: 'rotate(40 12 12)' },
]);

export const Wine = dotIcon('Wine', {
  d: `M6.5 3C6.5 8.5 9 11.5 12 11.5S17.5 8.5 17.5 3M12 14.5V18M8.5 21.5H15.5${dot(12, 7.25)}`,
});

export const Navigation = dotIcon('Navigation', {
  fill: 'M3.5 11L20.5 3.5L13 20.5L11 13Z',
  d: 'M3.5 11L20.5 3.5L13 20.5L11 13Z',
});

/* ── 3. Navigation & directional ── */

export const ArrowLeft = dotIcon('ArrowLeft', { d: 'M20 12H9M10.5 5.5L4 12L10.5 18.5' });
export const ArrowRight = dotIcon('ArrowRight', { d: 'M4 12H15M13.5 5.5L20 12L13.5 18.5' });
export const ArrowUpRight = dotIcon('ArrowUpRight', { d: 'M8 5.5H18.5V16M5.5 18.5L14.5 9.5' });
export const ArrowDownLeft = dotIcon('ArrowDownLeft', { d: 'M16 18.5H5.5V8M18.5 5.5L9.5 14.5' });

export const ChevronDown = dotIcon('ChevronDown', { d: 'M6 9L12 15L18 9' });
export const ChevronUp = dotIcon('ChevronUp', { d: 'M6 15L12 9L18 15' });
export const ChevronLeft = dotIcon('ChevronLeft', { d: 'M15 6L9 12L15 18' });
export const ChevronRight = dotIcon('ChevronRight', { d: 'M9 6L15 12L9 18' });

export const Home = dotIcon('Home', { d: 'M3 10.5L12 3L21 10.5M5.5 14V21M18.5 14V21M12 16.5V21' });

export const PanelLeft = dotIcon('PanelLeft', { d: `${box(3.5, 3.5, 17, 17)}M9.5 8V16` });

/* ── 4. Actions & controls ── */

export const Plus = dotIcon('Plus', { d: `M12 4.5V8.5M12 15.5V19.5M4.5 12H8.5M15.5 12H19.5${dot(12, 12)}` });
export const Minus = dotIcon('Minus', { d: 'M5 12H19' });

export const X = dotIcon('X', {
  d: `M6 6L9.5 9.5M14.5 14.5L18 18M18 6L14.5 9.5M9.5 14.5L6 18${dot(12, 12)}`,
});

const RING = ring(12, 12, 9.5, 16);

export const XCircle = dotIcon('XCircle', { d: `${RING}M9 9L15 15M15 9L9 15` });

export const Check = dotIcon('Check', { d: 'M4.5 12.5L9.5 17.5L19.5 6.5' });
export const CheckCheck = dotIcon('CheckCheck', { d: 'M2 12.5L6.5 17L15.5 7M13 15.5L14.5 17L22 8.5' });

const SMALL_CHECK = 'M8 12.5L10.75 15.25L16 9.5';
export const CheckCircle = dotIcon('CheckCircle', { d: RING + SMALL_CHECK });
export const CheckCircle2 = CheckCircle;
export const CheckSquare = dotIcon('CheckSquare', { d: box(3, 3, 18, 18) + SMALL_CHECK });

/** Primitive circle: an outline that fills with `fill-current` (radio dots, menu bullets). */
export const Circle = dotIcon('Circle', { shape: 'M21.5 12A9.5 9.5 0 1 1 2.5 12A9.5 9.5 0 1 1 21.5 12Z' });

/** Primitive square: outline that fills with `fill-current` (media stop). */
export const Square = dotIcon('Square', {
  shape: 'M7 3.5H17A3.5 3.5 0 0 1 20.5 7V17A3.5 3.5 0 0 1 17 20.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5Z',
});

/** Pencil: tip dot · body · eraser dot. */
const PENCIL = { d: dot(6.5, 17.5, 19.5, 4.5), bold: 'M10 14L16 8' };

export const Pencil = dotIcon('Pencil', PENCIL);
export const Edit2 = Pencil;
export const Edit3 = dotIcon('Edit3', { d: `${dot(4, 18.5, 17, 5.5)}M12 21H20`, bold: 'M7.5 15L13.5 9' });
export const Edit = dotIcon('Edit', {
  d: `M3.5 7V17M7 20.5H17M20.5 13.5V17M7 3.5H10.5${dot(9, 15)}`,
  bold: 'M12.5 11.5L19 5',
});

export const Trash2 = dotIcon('Trash2', {
  d: 'M3.5 6.5H20.5M9.5 3H14.5M6 10V18.5M18 10V18.5M9 21.5H15M10 11.5V16.5M14 11.5V16.5',
});

export const Save = dotIcon('Save', {
  d:
    open(
      [
        [3.5, 3.5],
        [16.5, 3.5],
        [20.5, 7.5],
        [20.5, 20.5],
        [3.5, 20.5],
      ],
      true,
      2.75,
    ) + 'M8.5 7.5H13.5',
  solid: [[12, 14.5, 2]],
});

export const Copy = dotIcon('Copy', { d: `M3.5 6.5V13M6.5 3.5H13${box(8, 8, 12.5, 12.5)}` });

const TRAY = 'M3.5 15V17.5M20.5 15V17.5M6.5 20.5H17.5';
export const Download = dotIcon('Download', { d: `M12 3.5V9.5M7.5 10L12 14.5L16.5 10${TRAY}` });
export const Upload = dotIcon('Upload', { d: `M7.5 8L12 3.5L16.5 8M12 8.5V14${TRAY}` });

export const UploadCloud = dotIcon('UploadCloud', {
  d: 'M8 18.9A7 7 0 1 1 15.71 10H17.5A4.5 4.5 0 0 1 19.5 18.5M9 13L12 10L15 13M12 15V21.5',
});

/* Rotation arrows: a trail of dots that firms up into the arrow (motion). */
export const RefreshCw = dotIcon('RefreshCw', {
  d:
    arcDots(12, 12, 8.5, 190, 235, 2) +
    arc(12, 12, 8.5, 262, 330) +
    head(12, 12, 8.5, 330, 1) +
    arcDots(12, 12, 8.5, 10, 55, 2) +
    arc(12, 12, 8.5, 82, 150) +
    head(12, 12, 8.5, 150, 1),
});

const ROTATE = arcDots(12, 12, 8.5, 60, 240, 6) + arc(12, 12, 8.5, 270, 335) + head(12, 12, 8.5, 335, 1);
export const RotateCw = dotIcon('RotateCw', { d: ROTATE });
export const RotateCcw = dotIcon('RotateCcw', { d: ROTATE, transform: 'matrix(-1 0 0 1 24 0)' });

export const MoreHorizontal = dotIcon('MoreHorizontal', { bold: dot(5, 12, 12, 12, 19, 12), boldScale: 1.6 });
export const GripVertical = dotIcon('GripVertical', {
  bold: dot(9, 6, 15, 6, 9, 12, 15, 12, 9, 18, 15, 18),
  boldScale: 1.4,
});

const EYE = 'M3.5 10C5.5 7 8.5 5.5 12 5.5S18.5 7 20.5 10M3.5 14C5.5 17 8.5 18.5 12 18.5S18.5 17 20.5 14';
export const Eye = dotIcon('Eye', { d: EYE, solid: [[12, 12, 2]] });
export const EyeOff = dotIcon('EyeOff', { d: `${EYE}M4.5 4.5L19.5 19.5` });

export const Search = dotIcon('Search', { d: `${ring(10, 10, 6, 10)}M16.7 16.7L21 21` });

/** Spinner: eight dots fading round the ring (use with animate-spin). */
export const Loader2 = createIcon('Loader2', () => (
  <>
    {Array.from({ length: 8 }, (_, i) => {
      const a = ((-90 + i * 45) * Math.PI) / 180;
      return (
        <path
          key={i}
          d={dot(12 + 8.5 * Math.cos(a), 12 + 8.5 * Math.sin(a))}
          opacity={1 - i * 0.11}
        />
      );
    })}
  </>
));

/* ── 5. Communication ── */

export const Mail = dotIcon('Mail', { d: `${box(3, 4.5, 18, 15)}M7 9L12 12.5L17 9` });

const TYPING = dot(8, 11.5, 12, 11.5, 16, 11.5);
export const MessageCircle = dotIcon('MessageCircle', {
  d: `${arc(12, 11.5, 8.5, 140, 455)}M7 20L4.5 21.5${TYPING}`,
});

export const MessageSquare = dotIcon('MessageSquare', {
  d: `M3.5 6.5V14M20.5 6.5V14.5M6.5 3.5H17.5M10.5 17.5H17.5M6.5 18.5L4 21${dot(8, 10.5, 12, 10.5, 16, 10.5)}`,
});

export const Phone = dotIcon('Phone', {
  d: 'M8.5 3.5H6A2.5 2.5 0 0 0 3.5 6C3.5 13.5 10.5 20.5 18 20.5A2.5 2.5 0 0 0 20.5 18V15.5',
  bold: 'M8.5 3.5L10 7.5M20.5 15.5L16.5 14',
  boldScale: 1.5,
});

export const Send = dotIcon('Send', {
  d:
    open(
      [
        [21, 3],
        [3, 10.5],
        [10.5, 13.5],
        [13.5, 21],
      ],
      true,
      2.5,
    ) + seg(10.5, 13.5, 21, 3, 3.5),
});

export const Reply = dotIcon('Reply', { d: 'M9.5 5L4 10.5L9.5 16M9 10.5H14A6.5 6.5 0 0 1 20.5 17V19' });

export const Share2 = dotIcon('Share2', {
  d: 'M10.3 9.5L13.7 7.5M10.3 14.5L13.7 16.5',
  solid: [
    [18, 5, 1.5],
    [6, 12, 1.5],
    [18, 19, 1.5],
  ],
});

const BELL = `M6 15V10.5A6 6 0 0 1 18 10.5V15M3.5 18.5H20.5${dot(12, 21.75)}`;
export const Bell = dotIcon('Bell', { d: BELL });
export const BellOff = dotIcon('BellOff', { d: `${BELL}M3 3L21 21` });

export const Paperclip = dotIcon('Paperclip', {
  d: 'M20.5 11.5L12 20A5.5 5.5 0 0 1 4 12L12.5 3.5A3.5 3.5 0 0 1 17.5 8.5L9 17A1.5 1.5 0 0 1 7 15L14.5 7.5',
});

const THUMB = {
  d: 'M8.5 11L11.5 3.5A2.5 2.5 0 0 1 14.5 6.5L13.5 10H18.5A2 2 0 0 1 20.5 12.5L19 19A2 2 0 0 1 17 20.5H8.5Z',
  bold: 'M4 11.5V19.5',
  boldScale: 1.75,
};
export const ThumbsUp = dotIcon('ThumbsUp', THUMB);
export const ThumbsDown = dotIcon('ThumbsDown', { ...THUMB, transform: 'rotate(180 12 12)' });

/* ── 6. People & security ── */

export const User = dotIcon('User', { d: 'M4.5 21A7.5 6.5 0 0 1 19.5 21', solid: [[12, 7.5, 3]] });

export const Users = dotIcon('Users', {
  d: 'M2.5 21A6.5 6 0 0 1 15.5 21M17.5 13.5A5 5.5 0 0 1 21.5 19',
  solid: [
    [9, 8, 2.75],
    [17, 6.5, 2],
  ],
});

const PERSON = { d: 'M2 21A7 6.5 0 0 1 16 21', solid: [[9, 7.5, 3]] as [number, number, number][] };
export const UserPlus = dotIcon('UserPlus', { ...PERSON, d: `${PERSON.d}M19 6V12M16 9H22` });
export const UserCheck = dotIcon('UserCheck', { ...PERSON, d: `${PERSON.d}M15.5 9L17.5 11L21.5 6.5` });
export const UserCog = dotIcon('UserCog', {
  d: `M2 21A7 6.5 0 0 1 13.5 15.5${ring(18.5, 17, 4, 6, -90)}`,
  solid: [
    [9, 7.5, 3],
    [18.5, 17, 1],
  ],
});

export const Crown = dotIcon('Crown', {
  d: `M5.5 20H18.5M4.5 16.5L3.5 10L8.5 13L12 7L15.5 13L20.5 10L19.5 16.5${dot(3, 6.5, 12, 3.5, 21, 6.5)}`,
});

const LOCK_BODY = 'M4.5 15.5V18.5M19.5 15.5V18.5M7.5 12H16.5M7.5 21.5H16.5';
export const Lock = dotIcon('Lock', {
  d: `M7.5 8.5V7.5A4.5 4.5 0 0 1 16.5 7.5V8.5${LOCK_BODY}`,
  solid: [[12, 16.75, 1.25]],
});
export const Unlock = dotIcon('Unlock', {
  d: `M7.5 8.5V7.5A4.5 4.5 0 0 1 16 5.5${LOCK_BODY}`,
  solid: [[12, 16.75, 1.25]],
});

export const LogOut = dotIcon('LogOut', { d: 'M3.5 6.5V17.5M6.5 3.5H10M6.5 20.5H10M16 7.5L20.5 12L16 16.5M9 12H15.5' });

export const Shield = dotIcon('Shield', {
  d: 'M10.3 20.6C6.5 18.5 4.5 15.5 4.5 11.5V6.5L10 3.8M13.7 20.6C17.5 18.5 19.5 15.5 19.5 11.5V6.5L14 3.8',
  solid: [[12, 11.5, 1.5]],
});

export const Fingerprint = dotIcon('Fingerprint', {
  d: `M4.5 10A8.5 8.5 0 0 1 19.5 10M6.5 19V13A5.5 5.5 0 0 1 17.5 13V15M9.5 21V13.5A2.5 2.5 0 0 1 14.5 13.5V17.5${dot(17.5, 19, 14.5, 21)}`,
});

export const ScanFace = dotIcon('ScanFace', {
  d: `M3.5 8V6A2.5 2.5 0 0 1 6 3.5H8M16 3.5H18A2.5 2.5 0 0 1 20.5 6V8M20.5 16V18A2.5 2.5 0 0 1 18 20.5H16M8 20.5H6A2.5 2.5 0 0 1 3.5 18V16${dot(9, 10, 15, 10)}M9 14.5A4 4 0 0 0 15 14.5`,
});

/* ── 7. Finance & contracts ── */

export const DollarSign = dotIcon('DollarSign', {
  d: `${dot(12, 3.5, 12, 20.5)}M16 8.5A3.5 2 0 0 0 12.5 7H11A2.5 2.5 0 0 0 11 12H13A2.5 2.5 0 0 1 13 17H11.5A3.5 2 0 0 1 8 15.5`,
});

export const Euro = dotIcon('Euro', { d: 'M17.5 6.5A7 7 0 1 0 17.5 17.5M3.5 10H11M3.5 14H11' });

export const PoundSterling = dotIcon('PoundSterling', { d: 'M17 6.5A3.5 3.5 0 0 0 10 7.5V19.5M6 19.5H18M6 12.5H14' });

export const SwissFranc = dotIcon('SwissFranc', { d: 'M17.5 4.5H10V19.5M10 11.5H16M6 15.5H14' });

export const Wallet = dotIcon('Wallet', {
  d:
    open(
      [
        [3, 6.5],
        [21, 6.5],
        [21, 20],
        [3, 20],
      ],
      true,
      3,
    ) + 'M6 3.5H15.5',
  solid: [[16.5, 13.25, 1.5]],
});

export const Receipt = dotIcon('Receipt', {
  d: `M5 5.5V18M19 5.5V18M8 2.5H16${dot(5, 21.5, 9.67, 21.5, 14.33, 21.5, 19, 21.5)}M8.5 7H15.5M8.5 11H15.5M8.5 15H12.5`,
});

export const BarChart3 = dotIcon('BarChart3', {
  d: `M6 20V15M12 20V9M18 20V13${dot(6, 11.5, 12, 5.5, 18, 9.5)}`,
});

export const TrendingUp = dotIcon('TrendingUp', { d: 'M3 17.5L8.5 12L12.5 16L17.5 11M15 6.5H21V12.5' });
export const TrendingDown = dotIcon('TrendingDown', { d: 'M3 6.5L8.5 12L12.5 8L17.5 13M15 17.5H21V11.5' });

export const FileSignature = dotIcon('FileSignature', {
  d: `${DOC}M8.5 16.5C9.5 14 10.5 14 11 16.5S12.5 19 13.5 16.5${dot(16, 16.5)}`,
});

export const FileText = dotIcon('FileText', { d: `${DOC}M9 11H15M9 14.5H15M9 18H12` });

export const ScrollText = dotIcon('ScrollText', {
  d: `${DOC}${dot(9, 10, 9, 13.5, 9, 17)}M12 10H15M12 13.5H15M12 17H14`,
});

/* ── 8. Status & feedback ── */

export const AlertCircle = dotIcon('AlertCircle', { d: `${RING}M12 7.5V12.5${dot(12, 16.25)}` });

export const AlertTriangle = dotIcon('AlertTriangle', {
  d:
    open(
      [
        [12, 3],
        [21.5, 20],
        [2.5, 20],
      ],
      true,
      2.75,
    ) + `M12 9.5V13.5${dot(12, 17)}`,
});

export const Info = dotIcon('Info', { d: `${RING}M12 11V16.5${dot(12, 7.75)}` });

export const HelpCircle = dotIcon('HelpCircle', {
  d: `${RING}M9.25 9.25A2.75 2.75 0 1 1 13.5 11.6C12.6 12.2 12 12.8 12 13.75${dot(12, 17)}`,
});

export const Star = dotIcon('Star', { shape: star(12, 12.75, 9.5, 4.25) });

export const Sparkles = dotIcon('Sparkles', {
  d: `M10 4.5C10.6 9.6 12.4 11.4 17.5 12C12.4 12.6 10.6 14.4 10 19.5C9.4 14.4 7.6 12.6 2.5 12C7.6 11.4 9.4 9.6 10 4.5Z${dot(19, 4.5, 20, 18.5)}`,
});

export const Heart = dotIcon('Heart', {
  shape:
    'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
});

export const Zap = dotIcon('Zap', { shape: 'M13 2.5L4.5 13.5H11.5L10.5 21.5L19.5 10.5H12.5Z' });

export const Activity = dotIcon('Activity', { d: `${dot(2.5, 12, 21.5, 12)}M6 12L9.5 4.5L14.5 19.5L18 12` });

/* ── 9. Weather ── */

export const Sun = dotIcon('Sun', { d: ring(12, 12, 9, 8), solid: [[12, 12, 3]] });

export const Moon = dotIcon('Moon', {
  d: `M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z${dot(17.5, 3.5, 20.5, 6.5)}`,
});

export const Cloud = dotIcon('Cloud', { d: CLOUD });

export const Cloudy = dotIcon('Cloudy', [
  { d: CLOUD, transform: 'translate(0.5 3.5) scale(0.85)', strokeScale: 0.85 },
  { d: arcDots(17, 6, 3.75, -170, 10, 4) },
]);

const UP = 'translate(1.8 -2) scale(0.85)';
const SMALL = { d: CLOUD, transform: UP, strokeScale: 0.85 };
export const CloudRain = dotIcon('CloudRain', [
  SMALL,
  { d: dot(8, 18.5, 16, 18.5, 12, 21.5) },
]);
export const CloudDrizzle = dotIcon('CloudDrizzle', [
  SMALL,
  { d: dot(8, 18, 12, 18, 16, 18, 10, 21.5, 14, 21.5) },
]);
export const CloudSnow = dotIcon('CloudSnow', [
  SMALL,
  { d: `M8 17.5V21.5M6 19.5H10M16 17.5V21.5M14 19.5H18${dot(12, 19.5)}` },
]);
export const CloudLightning = dotIcon('CloudLightning', [
  SMALL,
  { d: 'M12.5 16.5L10.5 19.5H13.5L11.5 22.5' },
]);

export const Droplet = dotIcon('Droplet', {
  d: `M12 3C8 8 5.5 11 5.5 14.5A6.5 6.5 0 0 0 18.5 14.5C18.5 11 16 8 12 3Z${dot(9.5, 15)}`,
});

export const Wind = dotIcon('Wind', {
  d: `M3 8.5H13.5A2.5 2.5 0 1 0 11 6M3 15.5H16.5A2.5 2.5 0 1 1 14 18${dot(3, 12, 7, 12, 11, 12)}`,
});

/* ── 10. Devices, files & system ── */

export const Smartphone = dotIcon('Smartphone', {
  d: `M5.5 5.5V18.5M18.5 5.5V18.5M8.5 2.5H15.5M8.5 21.5H15.5${dot(12, 18)}`,
});

export const Monitor = dotIcon('Monitor', { d: 'M2.5 6.5V13M21.5 6.5V13M5.5 3.5H18.5M5.5 16H18.5M8 20H16' });

export const Globe = dotIcon('Globe', {
  d: `${ring(12, 12, 9.5, 16, -78.75)}M12 5.5C9.8 7.5 8.5 9.5 8.5 12S9.8 16.5 12 18.5M12 5.5C14.2 7.5 15.5 9.5 15.5 12S14.2 16.5 12 18.5M5 12H19`,
});

const CUBE_EDGES: [number, number, number, number][] = [
  [12, 2.5, 3.5, 7],
  [12, 2.5, 20.5, 7],
  [3.5, 7, 12, 11.5],
  [20.5, 7, 12, 11.5],
  [3.5, 7, 3.5, 17],
  [20.5, 7, 20.5, 17],
  [12, 11.5, 12, 21.5],
  [3.5, 17, 12, 21.5],
  [20.5, 17, 12, 21.5],
];
const CUBE = CUBE_EDGES.map(([a, b, c, d]) => seg(a, b, c, d, 2)).join('');
export const Package = dotIcon('Package', { d: CUBE });
export const Box = Package;

export const Wrench = dotIcon('Wrench', {
  d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
});

export const LayoutGrid = dotIcon('LayoutGrid', {
  solid: [
    [7, 7, 2.75],
    [17, 7, 2.75],
    [7, 17, 2.75],
    [17, 17, 2.75],
  ],
});

export const LayoutTemplate = dotIcon('LayoutTemplate', {
  d: 'M11 12.5H19M11 18.5H19',
  bold: 'M5 5.5H19M5 12.5V18.5',
});

export const Layers = dotIcon('Layers', {
  d:
    open(
      [
        [12, 2.5],
        [21.5, 7.5],
        [12, 12.5],
        [2.5, 7.5],
      ],
      true,
      2.5,
    ) + 'M2.5 12L12 17L21.5 12M2.5 16.5L12 21.5L21.5 16.5',
});

export const Infinity = dotIcon('Infinity', {
  d: 'M12 12C10.5 9.5 9 8 7 8A4 4 0 0 0 7 16C9 16 10.5 14.5 12 12C13.5 9.5 15 8 17 8A4 4 0 0 1 17 16C15 16 13.5 14.5 12 12Z',
});

export const Link = dotIcon('Link', {
  d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
});

export const File = dotIcon('File', { d: DOC });

const FOLDER_BACK = 'M5.5 4.5H8.5M12 7H18.5';
export const Folder = dotIcon('Folder', { d: `M2.5 8V16.5${FOLDER_BACK}M21.5 10V16.5M5.5 19.5H18.5` });
export const FolderOpen = dotIcon('FolderOpen', {
  d:
    'M2.5 8V12.5M5.5 4.5H8.5M12 7H17.5' +
    open(
      [
        [3, 19.5],
        [6.5, 11.5],
        [21.5, 11.5],
        [18, 19.5],
      ],
      true,
      2.25,
    ),
});

export const StickyNote = dotIcon('StickyNote', {
  d: 'M3 6.5V17.5M6.5 3H17.5M21 6.5V12M6.5 21H12M15.5 20.5L20.5 15.5',
});

export const BookOpen = dotIcon('BookOpen', {
  d: 'M10.25 6.5C8.5 5 6.5 4.5 2.5 4.5V18C6.5 18 8.5 18.5 10.25 20M13.75 6.5C15.5 5 17.5 4.5 21.5 4.5V18C17.5 18 15.5 18.5 13.75 20',
});

export const Camera = dotIcon('Camera', {
  d: 'M2.5 9V17.5M21.5 9V17.5M5.5 20.5H18.5M5.5 6H7M17 6H18.5M9.5 3.5H14.5M16 13A4 4 0 1 1 8 13A4 4 0 1 1 16 13Z',
});

export const Image = dotIcon('Image', {
  d: `${box(3, 3, 18, 18)}M6.5 17.5L10.5 13.5L14.5 17.5M15 14L17.5 16.5`,
  solid: [[8.5, 8.5, 1.5]],
});

/** Video link (YouTube): a wide screen with open corners around the Play
 *  triangle, so it sits in the dot set like every other icon. */
export const Youtube = dotIcon('Youtube', {
  d: 'M2.5 8.5V15.5M21.5 8.5V15.5M5.5 5H18.5M5.5 19H18.5M10 9.25v5.5l4.75-2.75z',
  fill: 'M10 9.25v5.5l4.75-2.75z',
});

const WIFI = `M2.5 9A13.5 13.5 0 0 1 21.5 9M5.5 12.5A9 9 0 0 1 18.5 12.5M8.5 16A4.5 4.5 0 0 1 15.5 16${dot(12, 19.5)}`;
export const Wifi = dotIcon('Wifi', { d: WIFI });
export const WifiOff = dotIcon('WifiOff', { d: `${WIFI}M3 3L21 21` });

/* Lists, filters and switches (also in Figma › Components › Icons). */
export const List = dotIcon('List', { d: `${dot(4.5, 6, 4.5, 12, 4.5, 18)}M9 6H20M9 12H20M9 18H20` });
export const ListChecks = dotIcon('ListChecks', {
  d: `M3 6L5 8L8.5 4.5M3 12L5 14L8.5 10.5${dot(5.5, 18)}M12 6.5H21M12 12.5H21M12 18H21`,
});
export const Filter = dotIcon('Filter', { d: 'M3.5 6H20.5M7 12H17M10.5 18H13.5' });
export const ArrowLeftRight = dotIcon('ArrowLeftRight', {
  d: 'M4 8H19M16 5L19 8L16 11M20 16H5M8 13L5 16L8 19',
});
/** Poll results: three answers, the leading one marked. */
export const Poll = dotIcon('Poll', { d: `M3.5 6H15.5M3.5 12H10M3.5 18H13${dot(20, 6)}` });
