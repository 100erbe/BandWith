import React from 'react';
import { createIcon } from './IconBase';

/* ═══════════════════════════════════════════════════════════════════════════
   BandWith Studio Vector System — Core UI & Domain Iconography
   • Grid: 24×24 (2px optical safe zone)
   • Stroke: 2.0px uniform, round caps & round joins
   • DNA: Architectural squircle radii (rx=3), sculpted rounded vertices,
          studio audio hardware precision, zero visual noise at 14px–28px
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── 1. Music, Audio & Repertoire ── */

export const Music = createIcon('Music', () => (
  <>
    <circle cx="6.5" cy="18" r="2.75" />
    <circle cx="17.5" cy="16" r="2.75" />
    <path d="M9.25 18V5.5l11-2v12.5" />
  </>
));

export const Music2 = createIcon('Music2', () => (
  <>
    <circle cx="6.5" cy="18" r="2.75" />
    <circle cx="17.5" cy="16" r="2.75" />
    <path d="M9.25 18V5.5l11-2v12.5" />
    <path d="M9.25 9.25l11-2" />
  </>
));

export const ListMusic = createIcon('ListMusic', () => (
  <>
    <path d="M3.5 6.5h12" />
    <path d="M3.5 12h8.5" />
    <path d="M3.5 17.5h8.5" />
    <circle cx="17" cy="17.5" r="2.5" />
    <path d="M19.5 17.5V7l2 .5" />
  </>
));

export const FileMusic = createIcon('FileMusic', () => (
  <>
    <path d="M14 2.5H6.5a2.5 2.5 0 0 0-2.5 2.5v14a2.5 2.5 0 0 0 2.5 2.5h11a2.5 2.5 0 0 0 2.5-2.5V8.5L14 2.5Z" />
    <path d="M13.5 2.5V7a2 2 0 0 0 2 2H20" />
    <circle cx="10.25" cy="16.75" r="1.75" />
    <path d="M12 16.75V11.5l3-.6" />
  </>
));

export const Disc3 = createIcon('Disc3', () => (
  <>
    <circle cx="12" cy="12" r="9.5" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M6.5 12A5.5 5.5 0 0 1 12 6.5" />
    <path d="M17.5 12A5.5 5.5 0 0 1 12 17.5" />
  </>
));

export const Guitar = createIcon('Guitar', () => (
  <>
    <path d="M11.6 12.4c-2.1-.9-4.6-.4-6.2 1.2a4.4 4.4 0 0 0 6.2 6.2c1.6-1.6 2.1-4.1 1.2-6.2" />
    <circle cx="9.2" cy="14.8" r="1.2" />
    <path d="M12.4 11.6 18.5 5.5" />
    <path d="M17.5 3.5l3 3" />
  </>
));

export const Mic2 = createIcon('Mic2', () => (
  <>
    <circle cx="16.5" cy="7.5" r="4" />
    <path d="M13.7 4.7l5.6 5.6" />
    <path d="M13.3 8 4.7 16.6a2.1 2.1 0 0 0 2.7 2.7L16 10.7" />
    <path d="M3 21l2-2" />
  </>
));

export const Mic = createIcon('Mic', () => (
  <>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </>
));

export const Drum = createIcon('Drum', () => (
  <>
    <ellipse cx="12" cy="8" rx="8" ry="3.5" />
    <path d="M4 8v7c0 1.93 3.58 3.5 8 3.5s8-1.57 8-3.5V8" />
    <path d="m5 16 3-3" />
    <path d="m19 16-3-3" />
  </>
));

export const Sliders = createIcon('Sliders', () => (
  <>
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </>
));

export const Volume2 = createIcon('Volume2', () => (
  <>
    <path d="M11 5.5 6.5 9H3.75A1.75 1.75 0 0 0 2 10.75v2.5C2 14.22 2.78 15 3.75 15H6.5L11 18.5V5.5Z" />
    <path d="M15.5 8.8a4.8 4.8 0 0 1 0 6.4" />
    <path d="M18.8 5.6a9.2 9.2 0 0 1 0 12.8" />
  </>
));

export const VolumeX = createIcon('VolumeX', () => (
  <>
    <path d="M11 5.5 6.5 9H3.75A1.75 1.75 0 0 0 2 10.75v2.5C2 14.22 2.78 15 3.75 15H6.5L11 18.5V5.5Z" />
    <path d="m16.5 9.5 5 5" />
    <path d="m21.5 9.5-5 5" />
  </>
));

export const Play = createIcon('Play', () => (
  <path d="M6 4.8a1.25 1.25 0 0 1 1.9-1.06l11.2 7.2a1.25 1.25 0 0 1 0 2.12l-11.2 7.2A1.25 1.25 0 0 1 6 19.2V4.8Z" />
));

export const Pause = createIcon('Pause', () => (
  <>
    <rect x="6" y="4" width="4.25" height="16" rx="1.75" />
    <rect x="13.75" y="4" width="4.25" height="16" rx="1.75" />
  </>
));

export const Repeat = createIcon('Repeat', () => (
  <>
    <path d="m17 3 3.5 3.5L17 10" />
    <path d="M3.5 11v-1A3.5 3.5 0 0 1 7 6.5h13.5" />
    <path d="M7 21 3.5 17.5 7 14" />
    <path d="M20.5 13v1A3.5 3.5 0 0 1 17 17.5H3.5" />
  </>
));

export const SkipForward = createIcon('SkipForward', () => (
  <>
    <path d="M5.25 5.2a1 1 0 0 1 1.54-.84l9.5 6.8a1 1 0 0 1 0 1.68l-9.5 6.8a1 1 0 0 1-1.54-.84V5.2Z" />
    <path d="M19 5v14" />
  </>
));

export const Radio = createIcon('Radio', () => (
  <>
    <circle cx="12" cy="12" r="2.25" />
    <path d="M8.1 15.9a5.5 5.5 0 0 1 0-7.8" />
    <path d="M15.9 8.1a5.5 5.5 0 0 1 0 7.8" />
    <path d="M5.2 18.8a9.6 9.6 0 0 1 0-13.6" />
    <path d="M18.8 5.2a9.6 9.6 0 0 1 0 13.6" />
  </>
));

/* ── 2. Events, Logistics & Stage Timeline ── */

export const Calendar = createIcon('Calendar', () => (
  <>
    <rect x="3" y="4" width="18" height="17" rx="3" />
    <path d="M8 2.5v3" />
    <path d="M16 2.5v3" />
    <path d="M3 9.5h18" />
  </>
));

export const CalendarPlus = createIcon('CalendarPlus', () => (
  <>
    <rect x="3" y="4" width="18" height="17" rx="3" />
    <path d="M8 2.5v3" />
    <path d="M16 2.5v3" />
    <path d="M3 9.5h18" />
    <path d="M9.5 15.25h5" />
    <path d="M12 12.75v5" />
  </>
));

export const Clock = createIcon('Clock', () => (
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 6.75V12l3.75 2.25" />
  </>
));

export const Timer = createIcon('Timer', () => (
  <>
    <path d="M9.5 2.5h5" />
    <path d="M12 2.5v2" />
    <circle cx="12" cy="13.5" r="8" />
    <path d="M12 13.5V9.25" />
  </>
));

export const History = createIcon('History', () => (
  <>
    <path d="M3.2 12a9 9 0 1 0 2.3-6L3 8.5" />
    <path d="M3 3.5v5h5" />
    <path d="M12 7.5V12l3.25 2" />
  </>
));

export const MapPin = createIcon('MapPin', () => (
  <>
    <path d="M19.5 10c0 5-5.25 9.75-6.9 11.25a.9.9 0 0 1-1.2 0C9.75 19.75 4.5 15 4.5 10a7.5 7.5 0 0 1 15 0Z" />
    <circle cx="12" cy="10" r="2.75" />
  </>
));

export const Truck = createIcon('Truck', () => (
  <>
    <path d="M14 17.5V6.5A2.5 2.5 0 0 0 11.5 4h-7A2.5 2.5 0 0 0 2 6.5v9.5a1.5 1.5 0 0 0 1.5 1.5H5" />
    <path d="M9 17.5h6" />
    <path d="M19 17.5h1.5A1.5 1.5 0 0 0 22 16v-3.4a1.5 1.5 0 0 0-.35-.96l-2.9-3.5A1.5 1.5 0 0 0 17.6 7.5H14v10" />
    <circle cx="7" cy="17.5" r="2" />
    <circle cx="17" cy="17.5" r="2" />
  </>
));

export const Briefcase = createIcon('Briefcase', () => (
  <>
    <rect x="2.5" y="6.5" width="19" height="14" rx="3" />
    <path d="M8.5 6.5V4.5A2 2 0 0 1 10.5 2.5h3a2 2 0 0 1 2 2v2" />
    <path d="M2.5 12h19" />
  </>
));

export const Hotel = createIcon('Hotel', () => (
  <>
    <rect x="4" y="2.5" width="16" height="19" rx="2.5" />
    <path d="M8.5 7h2" />
    <path d="M13.5 7h2" />
    <path d="M8.5 11.5h2" />
    <path d="M13.5 11.5h2" />
    <path d="M10 21.5v-4.5a2 2 0 0 1 4 0v4.5" />
  </>
));

export const Plane = createIcon('Plane', () => (
  <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z" />
));

export const Utensils = createIcon('Utensils', () => (
  <>
    <path d="M4 3v6a3.5 3.5 0 0 0 7 0V3" />
    <path d="M7.5 3v18" />
    <path d="M19 3v18" />
    <path d="M19 3c-2.5 0-4 2.2-4 5.5V12h4" />
  </>
));

export const UtensilsCrossed = createIcon('UtensilsCrossed', () => (
  <>
    <path d="m16 2.5-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8.5Z" />
    <path d="M15 15 3.5 3.5a4 4 0 0 0 0 5.7l7.3 7.3a2 2 0 0 0 2.8 0L15 15Zm0 0 6.5 6.5" />
    <path d="m2.5 21.5 6.2-6.2" />
    <path d="m19 5.5-6.5 6.5" />
  </>
));

export const Wine = createIcon('Wine', () => (
  <>
    <path d="M8 21.5h8" />
    <path d="M12 15v6.5" />
    <path d="M7.2 9.5h9.6" />
    <path d="M12 15a5 5 0 0 0 5-5c0-2-.6-4.2-1.8-7.5H8.8C7.6 5.8 7 8 7 10a5 5 0 0 0 5 5Z" />
  </>
));

export const Navigation = createIcon('Navigation', () => (
  <path d="M3.6 10.8 20.2 3.1a.8.8 0 0 1 1.07 1.07L13.6 20.8a.8.8 0 0 1-1.5-.12L10.4 14a1 1 0 0 0-.7-.7l-6.08-1.7a.8.8 0 0 1-.02-1.5Z" />
));

/* ── 3. Wayfinding, Disclosure & Arrows ── */

export const ArrowLeft = createIcon('ArrowLeft', () => (
  <>
    <path d="M19 12H5" />
    <path d="m11.5 18.5-6.5-6.5 6.5-6.5" />
  </>
));

export const ArrowRight = createIcon('ArrowRight', () => (
  <>
    <path d="M5 12h14" />
    <path d="m12.5 5.5 6.5 6.5-6.5 6.5" />
  </>
));

export const ArrowUpRight = createIcon('ArrowUpRight', () => (
  <>
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </>
));

export const ArrowDownLeft = createIcon('ArrowDownLeft', () => (
  <>
    <path d="M17 7 7 17" />
    <path d="M16 17H7V8" />
  </>
));

export const ChevronDown = createIcon('ChevronDown', () => (
  <path d="m6 9 6 6 6-6" />
));

export const ChevronUp = createIcon('ChevronUp', () => (
  <path d="m18 15-6-6-6 6" />
));

export const ChevronLeft = createIcon('ChevronLeft', () => (
  <path d="m15 18-6-6 6-6" />
));

export const ChevronRight = createIcon('ChevronRight', () => (
  <path d="m9 18 6-6-6-6" />
));

export const Home = createIcon('Home', () => (
  <>
    <path d="M3.5 10.2 10.7 3.8a2 2 0 0 1 2.6 0l7.2 6.4a2 2 0 0 1 .68 1.5V19a2.5 2.5 0 0 1-2.5 2.5H5.32A2.5 2.5 0 0 1 2.82 19v-7.3a2 2 0 0 1 .68-1.5Z" />
    <path d="M9.5 21.5V14a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v7.5" />
  </>
));

export const PanelLeft = createIcon('PanelLeft', () => (
  <>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M9 3v18" />
  </>
));

/* ── 4. Core Actions, Editing & Controls ── */

export const Plus = createIcon('Plus', () => (
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>
));

export const Minus = createIcon('Minus', () => (
  <path d="M5 12h14" />
));

export const X = createIcon('X', () => (
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>
));

export const XCircle = createIcon('XCircle', () => (
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="m14.75 9.25-5.5 5.5" />
    <path d="m9.25 9.25 5.5 5.5" />
  </>
));

export const Check = createIcon('Check', () => (
  <path d="M20 6.5 9.25 17.25 4.5 12.5" />
));

export const CheckCheck = createIcon('CheckCheck', () => (
  <>
    <path d="M17.5 6.5 7.25 16.75 2.75 12.25" />
    <path d="m21.5 9.5-8 8-1.75-1.75" />
  </>
));

export const CheckCircle = createIcon('CheckCircle', () => (
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="m8.5 12.25 2.35 2.35 4.9-5.1" />
  </>
));

export const CheckCircle2 = createIcon('CheckCircle2', () => (
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="m8.5 12.25 2.35 2.35 4.9-5.1" />
  </>
));

export const CheckSquare = createIcon('CheckSquare', () => (
  <>
    <rect x="3" y="3" width="18" height="18" rx="3.5" />
    <path d="m8.5 12.25 2.35 2.35 4.9-5.1" />
  </>
));

export const Circle = createIcon('Circle', () => (
  <circle cx="12" cy="12" r="9.5" />
));

export const Square = createIcon('Square', () => (
  <rect x="3" y="3" width="18" height="18" rx="3.5" />
));

export const Edit = createIcon('Edit', () => (
  <>
    <path d="M11 4H5.5A2.5 2.5 0 0 0 3 6.5v12A2.5 2.5 0 0 0 5.5 21h12a2.5 2.5 0 0 0 2.5-2.5V13" />
    <path d="M17.8 3.2a2.2 2.2 0 0 1 3.1 3.1L12 15.2l-4 .8.8-4 9-8.8Z" />
  </>
));

export const Edit2 = createIcon('Edit2', () => (
  <>
    <path d="M16.8 3.4a2.4 2.4 0 0 1 3.4 3.4L7.8 19.2 3 20.5l1.3-4.8L16.8 3.4Z" />
    <path d="m14.5 5.7 3.4 3.4" />
  </>
));

export const Edit3 = createIcon('Edit3', () => (
  <>
    <path d="M12.5 20.5h8.5" />
    <path d="M16.5 3.5a2.25 2.25 0 0 1 3.2 3.2L7.5 18.9l-4.2 1 1-4.2L16.5 3.5Z" />
  </>
));

export const Pencil = createIcon('Pencil', () => (
  <>
    <path d="M16.8 3.4a2.4 2.4 0 0 1 3.4 3.4L7.8 19.2 3 20.5l1.3-4.8L16.8 3.4Z" />
    <path d="m14.5 5.7 3.4 3.4" />
  </>
));

export const Trash2 = createIcon('Trash2', () => (
  <>
    <path d="M3.5 6.5h17" />
    <path d="M8.5 6.5V4.5A1.5 1.5 0 0 1 10 3h4a1.5 1.5 0 0 1 1.5 1.5v2" />
    <path d="M18.5 6.5v12A2.5 2.5 0 0 1 16 21H8a2.5 2.5 0 0 1-2.5-2.5v-12" />
    <path d="M10 11v5.5" />
    <path d="M14 11v5.5" />
  </>
));

export const Save = createIcon('Save', () => (
  <>
    <path d="M18.5 21h-13A2.5 2.5 0 0 1 3 18.5v-13A2.5 2.5 0 0 1 5.5 3h10.1a2.5 2.5 0 0 1 1.77.73l2.9 2.9A2.5 2.5 0 0 1 21 8.4v10.1a2.5 2.5 0 0 1-2.5 2.5Z" />
    <path d="M7.5 21v-6.5A1.5 1.5 0 0 1 9 13h6a1.5 1.5 0 0 1 1.5 1.5V21" />
    <path d="M7.5 3v4a1 1 0 0 0 1 1h5.5" />
  </>
));

export const Copy = createIcon('Copy', () => (
  <>
    <rect x="8.5" y="8.5" width="13" height="13" rx="2.75" />
    <path d="M4.5 15.5h-.25A1.75 1.75 0 0 1 2.5 13.75v-9.5C2.5 3.28 3.28 2.5 4.25 2.5h9.5c.97 0 1.75.78 1.75 1.75v.25" />
  </>
));

export const Download = createIcon('Download', () => (
  <>
    <path d="M20.5 15v3a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18v-3" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    <path d="M12 15V3.5" />
  </>
));

export const Upload = createIcon('Upload', () => (
  <>
    <path d="M20.5 15v3a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18v-3" />
    <path d="M16.5 8 12 3.5 7.5 8" />
    <path d="M12 3.5V15" />
  </>
));

export const UploadCloud = createIcon('UploadCloud', () => (
  <>
    <path d="M4.2 15A6.8 6.8 0 1 1 15.6 8.2h1.65a4.4 4.4 0 0 1 2.35 8.12" />
    <path d="M12 12.5v8.5" />
    <path d="m15.5 16-3.5-3.5L8.5 16" />
  </>
));

export const RefreshCw = createIcon('RefreshCw', () => (
  <>
    <path d="M3.2 12a8.8 8.8 0 0 1 15.1-6.1L20.5 8" />
    <path d="M20.5 3.5V8H16" />
    <path d="M20.8 12a8.8 8.8 0 0 1-15.1 6.1L3.5 16" />
    <path d="M8 16H3.5v4.5" />
  </>
));

export const RotateCcw = createIcon('RotateCcw', () => (
  <>
    <path d="M3.2 12a9 9 0 1 0 2.35-6L3 8.5" />
    <path d="M3 3.5v5h5" />
  </>
));

export const RotateCw = createIcon('RotateCw', () => (
  <>
    <path d="M20.8 12a9 9 0 1 1-2.35-6L21 8.5" />
    <path d="M21 3.5v5h-5" />
  </>
));

export const MoreHorizontal = createIcon('MoreHorizontal', () => (
  <>
    <circle cx="5.5" cy="12" r="1.25" fill="currentColor" />
    <circle cx="12" cy="12" r="1.25" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.25" fill="currentColor" />
  </>
));

export const GripVertical = createIcon('GripVertical', () => (
  <>
    <circle cx="9" cy="5.5" r="1.15" fill="currentColor" />
    <circle cx="9" cy="12" r="1.15" fill="currentColor" />
    <circle cx="9" cy="18.5" r="1.15" fill="currentColor" />
    <circle cx="15" cy="5.5" r="1.15" fill="currentColor" />
    <circle cx="15" cy="12" r="1.15" fill="currentColor" />
    <circle cx="15" cy="18.5" r="1.15" fill="currentColor" />
  </>
));

export const Eye = createIcon('Eye', () => (
  <>
    <path d="M2.2 12S5.5 5.25 12 5.25 21.8 12 21.8 12 18.5 18.75 12 18.75 2.2 12 2.2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>
));

export const EyeOff = createIcon('EyeOff', () => (
  <>
    <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
    <path d="M10.7 5.38A9.8 9.8 0 0 1 12 5.25c6.5 0 9.8 6.75 9.8 6.75a14.4 14.4 0 0 1-1.9 2.85" />
    <path d="M6.5 6.65A14.2 14.2 0 0 0 2.2 12s3.3 6.75 9.8 6.75a9.6 9.6 0 0 0 5.35-1.6" />
    <path d="m2.5 2.5 19 19" />
  </>
));

export const Search = createIcon('Search', () => (
  <>
    <circle cx="11" cy="11" r="7.5" />
    <path d="m20.5 20.5-4.15-4.15" />
  </>
));

export const Loader2 = createIcon('Loader2', () => (
  <path d="M21 12a9 9 0 1 1-6.22-8.56" />
));

/* ── 5. Communication, Messaging & Collaboration ── */

export const Mail = createIcon('Mail', () => (
  <>
    <rect x="2.5" y="4.5" width="19" height="15" rx="3" />
    <path d="m3 7 7.85 5.1a2.1 2.1 0 0 0 2.3 0L21 7" />
  </>
));

export const MessageCircle = createIcon('MessageCircle', () => (
  <path d="M20.5 11.5a8.5 8.5 0 0 1-12.5 7.5L3 20.5l1.6-4.8A8.5 8.5 0 1 1 20.5 11.5Z" />
));

export const MessageSquare = createIcon('MessageSquare', () => (
  <path d="M20.5 14.5a2.5 2.5 0 0 1-2.5 2.5H7.5L3.5 21V6A2.5 2.5 0 0 1 6 3.5h12A2.5 2.5 0 0 1 20.5 6v8.5Z" />
));

export const Phone = createIcon('Phone', () => (
  <path d="M21.5 16.8v2.7a2 2 0 0 1-2.18 2 19.6 19.6 0 0 1-8.55-3.05 19.3 19.3 0 0 1-5.95-5.95A19.6 19.6 0 0 1 1.77 3.92 2 2 0 0 1 3.75 1.75h2.7a2 2 0 0 1 2 1.72c.12.92.35 1.82.68 2.68a2 2 0 0 1-.45 2.1L7.5 9.43a15.8 15.8 0 0 0 5.82 5.82l1.18-1.18a2 2 0 0 1 2.1-.45c.86.33 1.76.56 2.68.68a2 2 0 0 1 1.72 2.5Z" />
));

export const Send = createIcon('Send', () => (
  <>
    <path d="M21.2 2.8 11 13" />
    <path d="M21.2 2.8 14.8 20.8a.75.75 0 0 1-1.4-.04L11 13l-7.76-2.4a.75.75 0 0 1-.04-1.4L21.2 2.8Z" />
  </>
));

export const Reply = createIcon('Reply', () => (
  <>
    <path d="m9 16.5-5-4.5 5-4.5" />
    <path d="M20 18v-1.5A4.5 4.5 0 0 0 15.5 12H4" />
  </>
));

export const Share2 = createIcon('Share2', () => (
  <>
    <circle cx="18" cy="5" r="2.75" />
    <circle cx="6" cy="12" r="2.75" />
    <circle cx="18" cy="19" r="2.75" />
    <path d="m8.4 13.4 7.2 4.2" />
    <path d="m15.6 6.4-7.2 4.2" />
  </>
));

export const Bell = createIcon('Bell', () => (
  <>
    <path d="M6 8.5a6 6 0 0 1 12 0c0 6.5 2.5 8.5 2.5 8.5h-17S6 15 6 8.5" />
    <path d="M10.25 20.5a2 2 0 0 0 3.5 0" />
  </>
));

export const BellOff = createIcon('BellOff', () => (
  <>
    <path d="M8.7 3.2A6 6 0 0 1 18 8.5c0 1.9.3 3.4.7 4.5" />
    <path d="M17 17H3.5S6 15 6 8.5c0-.6.08-1.2.24-1.75" />
    <path d="M10.25 20.5a2 2 0 0 0 3.5 0" />
    <path d="m2.5 2.5 19 19" />
  </>
));

export const Paperclip = createIcon('Paperclip', () => (
  <path d="m21.2 11.2-8.9 8.9a5.75 5.75 0 0 1-8.13-8.13l8.6-8.6a3.85 3.85 0 0 1 5.44 5.44l-8.55 8.55a1.92 1.92 0 0 1-2.72-2.72l8.1-8.1" />
));

export const ThumbsUp = createIcon('ThumbsUp', () => (
  <>
    <path d="M7 10.5V21" />
    <path d="M14.8 5.8 13.8 10h5.4a2 2 0 0 1 1.94 2.48l-2.1 8A2 2 0 0 1 17.1 22H4.5A2 2 0 0 1 2.5 20v-7.5a2 2 0 0 1 2-2H7l3.3-5.8a1.9 1.9 0 0 1 3.5 1.1Z" />
  </>
));

export const ThumbsDown = createIcon('ThumbsDown', () => (
  <>
    <path d="M17 13.5V3" />
    <path d="M9.2 18.2 10.2 14H4.8a2 2 0 0 1-1.94-2.48l2.1-8A2 2 0 0 1 6.9 2h12.6a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2H17l-3.3 5.8a1.9 1.9 0 0 1-3.5-1.1Z" />
  </>
));

/* ── 6. Users, Band Roles & Access Security ── */

export const User = createIcon('User', () => (
  <>
    <circle cx="12" cy="7.5" r="4" />
    <path d="M19.5 20.5v-1.5a4.5 4.5 0 0 0-4.5-4.5H9a4.5 4.5 0 0 0-4.5 4.5v1.5" />
  </>
));

export const Users = createIcon('Users', () => (
  <>
    <circle cx="9" cy="7.5" r="3.75" />
    <path d="M16 20.5v-1.5a4.25 4.25 0 0 0-4.25-4.25h-5.5A4.25 4.25 0 0 0 2 19v1.5" />
    <path d="M15.75 3.85a3.75 3.75 0 0 1 0 7.3" />
    <path d="M22 20.5V19a4.25 4.25 0 0 0-3-4.05" />
  </>
));

export const UserPlus = createIcon('UserPlus', () => (
  <>
    <circle cx="9" cy="7.5" r="3.75" />
    <path d="M16 20.5v-1.5a4.25 4.25 0 0 0-4.25-4.25h-5.5A4.25 4.25 0 0 0 2 19v1.5" />
    <path d="M19 8v6" />
    <path d="M16 11h6" />
  </>
));

export const UserCheck = createIcon('UserCheck', () => (
  <>
    <circle cx="9" cy="7.5" r="3.75" />
    <path d="M16 20.5v-1.5a4.25 4.25 0 0 0-4.25-4.25h-5.5A4.25 4.25 0 0 0 2 19v1.5" />
    <path d="m16 11.25 2 2 4-4" />
  </>
));

export const UserCog = createIcon('UserCog', () => (
  <>
    <circle cx="9" cy="7.5" r="3.75" />
    <path d="M10.5 14.75H6.25A4.25 4.25 0 0 0 2 19v1.5" />
    <circle cx="18.5" cy="14.5" r="2.25" />
    <path d="M18.5 11v1.25" />
    <path d="M18.5 16.75V18" />
    <path d="m21.5 12.75-1.1.65" />
    <path d="m16.6 15.6-1.1.65" />
    <path d="m21.5 16.25-1.1-.65" />
    <path d="m16.6 13.4-1.1-.65" />
  </>
));

export const Crown = createIcon('Crown', () => (
  <>
    <path d="M3.2 6.2a.6.6 0 0 1 1-.52l4 3.52 3.3-4.6a.6.6 0 0 1 1 0l3.3 4.6 4-3.52a.6.6 0 0 1 1 .52L19 16.5H5L3.2 6.2Z" />
    <path d="M5 20h14" />
  </>
));

export const Lock = createIcon('Lock', () => (
  <>
    <rect x="3.5" y="10.5" width="17" height="10.5" rx="3" />
    <path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />
  </>
));

export const Unlock = createIcon('Unlock', () => (
  <>
    <rect x="3.5" y="10.5" width="17" height="10.5" rx="3" />
    <path d="M7.5 10.5V7a4.5 4.5 0 0 1 8.75-1.4" />
  </>
));

export const LogOut = createIcon('LogOut', () => (
  <>
    <path d="M9.5 20.5H5.5A2.5 2.5 0 0 1 3 18V6a2.5 2.5 0 0 1 2.5-2.5h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </>
));

export const Shield = createIcon('Shield', () => (
  <path d="M12 21.5s7.5-3.75 7.5-9.75V5.6a1.5 1.5 0 0 0-1.03-1.42l-6-2a1.5 1.5 0 0 0-.94 0l-6 2A1.5 1.5 0 0 0 4.5 5.6v6.15c0 6 7.5 9.75 7.5 9.75Z" />
));

export const Fingerprint = createIcon('Fingerprint', () => (
  <>
    <path d="M4.5 11a7.5 7.5 0 0 1 15 0c0 2.5-.4 5-1.2 7" />
    <path d="M7.5 11.5a4.5 4.5 0 0 1 9 0c0 3-.7 6.2-2.1 8.5" />
    <path d="M10.5 12a1.5 1.5 0 0 1 3 0c0 3.2-.9 6.6-2.5 9" />
    <path d="M7.7 15.5c-.3 1.5-.8 3-1.5 4.2" />
  </>
));

export const ScanFace = createIcon('ScanFace', () => (
  <>
    <path d="M3.5 7.5V5.5a2 2 0 0 1 2-2h2" />
    <path d="M16.5 3.5h2a2 2 0 0 1 2 2v2" />
    <path d="M20.5 16.5v2a2 2 0 0 1-2 2h-2" />
    <path d="M7.5 20.5h-2a2 2 0 0 1-2-2v-2" />
    <path d="M8.5 14.5s1.4 1.75 3.5 1.75 3.5-1.75 3.5-1.75" />
    <path d="M9 9.5v.5" />
    <path d="M15 9.5v.5" />
  </>
));

/* ── 7. Financials, Quotes & Contracts ── */

export const DollarSign = createIcon('DollarSign', () => (
  <>
    <path d="M12 2.5v19" />
    <path d="M16.75 5.5H9.75a3.25 3.25 0 0 0 0 6.5h4.5a3.25 3.25 0 0 1 0 6.5H6.5" />
  </>
));

export const Euro = createIcon('Euro', () => (
  <>
    <path d="M4.5 10h11" />
    <path d="M4.5 14h8.5" />
    <path d="M18.8 6.2a7.75 7.75 0 0 0-5.1-1.95A7.75 7.75 0 0 0 6 12a7.75 7.75 0 0 0 7.7 7.75c2 0 3.75-.75 5.1-1.95" />
  </>
));

export const Wallet = createIcon('Wallet', () => (
  <>
    <path d="M19.5 7V5a2 2 0 0 0-2-2H5.5a2.5 2.5 0 0 0 0 5h14A1.5 1.5 0 0 1 21 9.5v9A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5v-13" />
    <path d="M21 12.5h-4a2 2 0 0 0 0 4h4" />
  </>
));

export const Receipt = createIcon('Receipt', () => (
  <>
    <path d="M5 3.5A1.5 1.5 0 0 1 6.5 2h11A1.5 1.5 0 0 1 19 3.5v17.5l-2.35-1.5L14.3 21 12 19.5 9.7 21l-2.35-1.5L5 21V3.5Z" />
    <path d="M8.5 7.5h7" />
    <path d="M8.5 11.5h7" />
    <path d="M8.5 15.5h4" />
  </>
));

export const BarChart3 = createIcon('BarChart3', () => (
  <>
    <path d="M3.5 3.5V19a1.5 1.5 0 0 0 1.5 1.5h15.5" />
    <path d="M8.5 16.5V13" />
    <path d="M13.25 16.5V6.5" />
    <path d="M18 16.5v-7" />
  </>
));

export const TrendingUp = createIcon('TrendingUp', () => (
  <>
    <path d="m21.5 7-8.25 8.25-4.75-4.75L2.5 16.5" />
    <path d="M15.5 7h6v6" />
  </>
));

export const TrendingDown = createIcon('TrendingDown', () => (
  <>
    <path d="m21.5 17-8.25-8.25-4.75 4.75-6-6" />
    <path d="M15.5 17h6v-6" />
  </>
));

export const FileSignature = createIcon('FileSignature', () => (
  <>
    <path d="M20 11V8.5L14 2.5H6.5A2.5 2.5 0 0 0 4 5v14a2.5 2.5 0 0 0 2.5 2.5H10" />
    <path d="M13.5 2.5V7a2 2 0 0 0 2 2H20" />
    <path d="M18.2 15.2a1.85 1.85 0 0 1 2.6 2.6L15.5 23H13v-2.5l5.2-5.3Z" />
  </>
));

export const FileText = createIcon('FileText', () => (
  <>
    <path d="M14 2.5H6.5A2.5 2.5 0 0 0 4 5v14a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 19V8.5L14 2.5Z" />
    <path d="M13.5 2.5V7a2 2 0 0 0 2 2H20" />
    <path d="M8 13h8" />
    <path d="M8 17h5.5" />
  </>
));

export const ScrollText = createIcon('ScrollText', () => (
  <>
    <path d="M8 21h10.5a2.5 2.5 0 0 0 2.5-2.5V17H10.5v1.5a2.5 2.5 0 0 1-5 0V5.5a2.5 2.5 0 0 0-2.5-2.5 2.5 2.5 0 0 0-2.5 2.5V8H5.5" />
    <path d="M19 17V5.5A2.5 2.5 0 0 0 16.5 3H3" />
    <path d="M9.5 8h5.5" />
    <path d="M9.5 12h5.5" />
  </>
));

/* ── 8. Feedback, Status & Intelligence ── */

export const AlertCircle = createIcon('AlertCircle', () => (
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 8v4.25" />
    <circle cx="12" cy="16" r="0.6" fill="currentColor" />
  </>
));

export const AlertTriangle = createIcon('AlertTriangle', () => (
  <>
    <path d="M10.35 3.9a1.9 1.9 0 0 1 3.3 0l7.85 13.75a1.9 1.9 0 0 1-1.65 2.85H4.15a1.9 1.9 0 0 1-1.65-2.85L10.35 3.9Z" />
    <path d="M12 9.25v4" />
    <circle cx="12" cy="16.75" r="0.6" fill="currentColor" />
  </>
));

export const Info = createIcon('Info', () => (
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 16v-4.25" />
    <circle cx="12" cy="8.25" r="0.6" fill="currentColor" />
  </>
));

export const HelpCircle = createIcon('HelpCircle', () => (
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M9.3 9.2a2.85 2.85 0 0 1 5.5.95c0 1.85-2.8 2.6-2.8 3.6" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" />
  </>
));

export const Star = createIcon('Star', () => (
  <path d="M11.48 3.5a.58.58 0 0 1 1.04 0l2.12 4.3a.58.58 0 0 0 .44.32l4.75.69a.58.58 0 0 1 .32.99l-3.44 3.35a.58.58 0 0 0-.16.51l.81 4.73a.58.58 0 0 1-.84.61l-4.25-2.23a.58.58 0 0 0-.54 0l-4.25 2.23a.58.58 0 0 1-.84-.61l.81-4.73a.58.58 0 0 0-.16-.51L2.85 9.8a.58.58 0 0 1 .32-.99l4.75-.69a.58.58 0 0 0 .44-.32l2.12-4.3Z" />
));

export const Sparkles = createIcon('Sparkles', () => (
  <>
    <path d="M11.5 3.2 9.8 8.3a2 2 0 0 1-1.27 1.27L3.4 11.3l5.13 1.73A2 2 0 0 1 9.8 14.3l1.7 5.1 1.7-5.1a2 2 0 0 1 1.27-1.27l5.13-1.73-5.13-1.73A2 2 0 0 1 13.2 8.3l-1.7-5.1Z" />
    <path d="M19 3v3.5" />
    <path d="M17.25 4.75h3.5" />
  </>
));

export const Heart = createIcon('Heart', () => (
  <path d="M19 14c1.5-1.45 3-3.2 3-5.5A5.4 5.4 0 0 0 16.6 3c-1.75 0-3 .6-4.6 2.1C10.4 3.6 9.15 3 7.4 3A5.4 5.4 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 6.8 7-6.8Z" />
));

export const Zap = createIcon('Zap', () => (
  <path d="M13.15 2.6a.65.65 0 0 1 1.15.5l-.85 7.4h6.15a.65.65 0 0 1 .5 1.07l-9.25 9.83a.65.65 0 0 1-1.15-.5l.85-7.4H4.4a.65.65 0 0 1-.5-1.07l9.25-9.83Z" />
));

export const Activity = createIcon('Activity', () => (
  <path d="M21.5 12h-3.75l-2.75 8.5L9 3.5 6.25 12H2.5" />
));

/* ── 9. Weather Engine ── */

export const Sun = createIcon('Sun', () => (
  <>
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </>
));

export const Moon = createIcon('Moon', () => (
  <path d="M12.2 3a6.5 6.5 0 0 0 8.8 8.8A9 9 0 1 1 12.2 3Z" />
));

export const Cloud = createIcon('Cloud', () => (
  <path d="M17.5 19H8.8a6.8 6.8 0 1 1 6.6-8.6h2.1a4.3 4.3 0 1 1 0 8.6Z" />
));

export const Cloudy = createIcon('Cloudy', () => (
  <>
    <path d="M17.5 19H8.8a6.8 6.8 0 1 1 6.6-8.6h2.1a4.3 4.3 0 1 1 0 8.6Z" />
    <path d="M21.8 10.2A3 3 0 0 0 19 7.5h-2.1A5.4 5.4 0 0 0 7.8 6" />
  </>
));

export const CloudRain = createIcon('CloudRain', () => (
  <>
    <path d="M4.2 14.8A6.8 6.8 0 1 1 15.6 8.2h1.65a4.4 4.4 0 0 1 2.35 8.12" />
    <path d="M8.5 14.5v5" />
    <path d="M12 16.5v5" />
    <path d="M15.5 14.5v5" />
  </>
));

export const CloudDrizzle = createIcon('CloudDrizzle', () => (
  <>
    <path d="M4.2 14.8A6.8 6.8 0 1 1 15.6 8.2h1.65a4.4 4.4 0 0 1 2.35 8.12" />
    <path d="M8.5 14.5v1.2" />
    <path d="M8.5 19v1.2" />
    <path d="M12 16v1.2" />
    <path d="M12 20.5v1.2" />
    <path d="M15.5 14.5v1.2" />
    <path d="M15.5 19v1.2" />
  </>
));

export const CloudSnow = createIcon('CloudSnow', () => (
  <>
    <path d="M4.2 14.8A6.8 6.8 0 1 1 15.6 8.2h1.65a4.4 4.4 0 0 1 2.35 8.12" />
    <circle cx="8.5" cy="15.5" r="0.6" fill="currentColor" />
    <circle cx="8.5" cy="19.5" r="0.6" fill="currentColor" />
    <circle cx="12" cy="17.5" r="0.6" fill="currentColor" />
    <circle cx="12" cy="21" r="0.6" fill="currentColor" />
    <circle cx="15.5" cy="15.5" r="0.6" fill="currentColor" />
    <circle cx="15.5" cy="19.5" r="0.6" fill="currentColor" />
  </>
));

export const CloudLightning = createIcon('CloudLightning', () => (
  <>
    <path d="M5.8 16.2A6.8 6.8 0 1 1 15.6 8.2h1.65a4.4 4.4 0 0 1 .45 8.78" />
    <path d="m13 12-3 4.8h4l-3 4.8" />
  </>
));

export const Droplet = createIcon('Droplet', () => (
  <path d="M12 21.5a6.8 6.8 0 0 0 6.8-6.8c0-2-1-3.8-2.9-5.4S12.5 5.4 12 3c-.5 2.4-2 4.7-3.9 6.3S5.2 12.7 5.2 14.7a6.8 6.8 0 0 0 6.8 6.8Z" />
));

export const Wind = createIcon('Wind', () => (
  <>
    <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
    <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
    <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
  </>
));

/* ── 10. Hardware, System & Content ── */

export const Smartphone = createIcon('Smartphone', () => (
  <>
    <rect x="5.5" y="2.5" width="13" height="19" rx="3" />
    <path d="M10.5 18h3" />
  </>
));

export const Monitor = createIcon('Monitor', () => (
  <>
    <rect x="2.5" y="3.5" width="19" height="13.5" rx="2.75" />
    <path d="M8.5 20.5h7" />
    <path d="M12 17v3.5" />
  </>
));

export const Globe = createIcon('Globe', () => (
  <>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M2.5 12h19" />
    <path d="M12 2.5a14.8 14.8 0 0 1 3.8 9.5 14.8 14.8 0 0 1-3.8 9.5 14.8 14.8 0 0 1-3.8-9.5A14.8 14.8 0 0 1 12 2.5Z" />
  </>
));

export const Box = createIcon('Box', () => (
  <>
    <path d="M20.5 8.2a2.2 2.2 0 0 0-1.1-1.9l-6.3-3.6a2.2 2.2 0 0 0-2.2 0L4.6 6.3A2.2 2.2 0 0 0 3.5 8.2v7.6a2.2 2.2 0 0 0 1.1 1.9l6.3 3.6a2.2 2.2 0 0 0 2.2 0l6.3-3.6a2.2 2.2 0 0 0 1.1-1.9V8.2Z" />
    <path d="M3.8 7.2 12 12l8.2-4.8" />
    <path d="M12 21.6V12" />
  </>
));

export const Package = createIcon('Package', () => (
  <>
    <path d="M20.5 8.2a2.2 2.2 0 0 0-1.1-1.9l-6.3-3.6a2.2 2.2 0 0 0-2.2 0L4.6 6.3A2.2 2.2 0 0 0 3.5 8.2v7.6a2.2 2.2 0 0 0 1.1 1.9l6.3 3.6a2.2 2.2 0 0 0 2.2 0l6.3-3.6a2.2 2.2 0 0 0 1.1-1.9V8.2Z" />
    <path d="m7.75 4.5 8.5 4.9" />
    <path d="M3.8 7.2 12 12l8.2-4.8" />
    <path d="M12 21.6V12" />
  </>
));

export const Wrench = createIcon('Wrench', () => (
  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.6-3.6a5.8 5.8 0 0 1-7.7 7.7L6.8 20.2a2.1 2.1 0 0 1-3-3l6.8-6.8a5.8 5.8 0 0 1 7.7-7.7l-3.6 3.6Z" />
));

export const Settings = createIcon('Settings', () => (
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12.2 2.5h-.4a1.8 1.8 0 0 0-1.8 1.6l-.15.9a1.5 1.5 0 0 1-.88 1.18l-.82.34a1.5 1.5 0 0 1-1.46-.18l-.72-.52a1.8 1.8 0 0 0-2.36.2l-.28.28a1.8 1.8 0 0 0-.2 2.36l.52.72a1.5 1.5 0 0 1 .18 1.46l-.34.82a1.5 1.5 0 0 1-1.18.88l-.9.15a1.8 1.8 0 0 0-1.6 1.8v.4a1.8 1.8 0 0 0 1.6 1.8l.9.15a1.5 1.5 0 0 1 1.18.88l.34.82a1.5 1.5 0 0 1-.18 1.46l-.52.72a1.8 1.8 0 0 0 .2 2.36l.28.28a1.8 1.8 0 0 0 2.36.2l.72-.52a1.5 1.5 0 0 1 1.46-.18l.82.34a1.5 1.5 0 0 1 .88 1.18l.15.9a1.8 1.8 0 0 0 1.8 1.6h.4a1.8 1.8 0 0 0 1.8-1.6l.15-.9a1.5 1.5 0 0 1 .88-1.18l.82-.34a1.5 1.5 0 0 1 1.46.18l.72.52a1.8 1.8 0 0 0 2.36-.2l.28-.28a1.8 1.8 0 0 0 .2-2.36l-.52-.72a1.5 1.5 0 0 1-.18-1.46l.34-.82a1.5 1.5 0 0 1 1.18-.88l.9-.15a1.8 1.8 0 0 0 1.6-1.8v-.4a1.8 1.8 0 0 0-1.6-1.8l-.9-.15a1.5 1.5 0 0 1-1.18-.88l-.34-.82a1.5 1.5 0 0 1 .18-1.46l.52-.72a1.8 1.8 0 0 0-.2-2.36l-.28-.28a1.8 1.8 0 0 0-2.36-.2l-.72.52a1.5 1.5 0 0 1-1.46.18l-.82-.34a1.5 1.5 0 0 1-.88-1.18l-.15-.9a1.8 1.8 0 0 0-1.8-1.6Z" />
  </>
));

export const LayoutGrid = createIcon('LayoutGrid', () => (
  <>
    <rect x="3" y="3" width="7.25" height="7.25" rx="2" />
    <rect x="13.75" y="3" width="7.25" height="7.25" rx="2" />
    <rect x="13.75" y="13.75" width="7.25" height="7.25" rx="2" />
    <rect x="3" y="13.75" width="7.25" height="7.25" rx="2" />
  </>
));

export const LayoutTemplate = createIcon('LayoutTemplate', () => (
  <>
    <rect x="3" y="3" width="18" height="6.5" rx="2" />
    <rect x="3" y="13" width="5.5" height="8" rx="2" />
    <rect x="12" y="13" width="9" height="8" rx="2" />
  </>
));

export const Layers = createIcon('Layers', () => (
  <>
    <path d="M11.2 2.4a1.8 1.8 0 0 1 1.6 0l8.2 4.1a.9.9 0 0 1 0 1.6l-8.2 4.1a1.8 1.8 0 0 1-1.6 0L3 8.1a.9.9 0 0 1 0-1.6l8.2-4.1Z" />
    <path d="m2.75 12.25 8.45 4.2a1.8 1.8 0 0 0 1.6 0l8.45-4.2" />
    <path d="m2.75 16.75 8.45 4.2a1.8 1.8 0 0 0 1.6 0l8.45-4.2" />
  </>
));

export const Infinity = createIcon('Infinity', () => (
  <path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" />
));

export const Link = createIcon('Link', () => (
  <>
    <path d="M10 13a4.8 4.8 0 0 0 7.25.52l2.85-2.85a4.8 4.8 0 0 0-6.8-6.8L11.65 5.5" />
    <path d="M14 11a4.8 4.8 0 0 0-7.25-.52L3.9 13.33a4.8 4.8 0 0 0 6.8 6.8l1.65-1.63" />
  </>
));

export const File = createIcon('File', () => (
  <>
    <path d="M14 2.5H6.5A2.5 2.5 0 0 0 4 5v14a2.5 2.5 0 0 0 2.5 2.5h11A2.5 2.5 0 0 0 20 19V8.5L14 2.5Z" />
    <path d="M13.5 2.5V7a2 2 0 0 0 2 2H20" />
  </>
));

export const Folder = createIcon('Folder', () => (
  <path d="M19.5 20H4.5A2.5 2.5 0 0 1 2 17.5V6A2.5 2.5 0 0 1 4.5 3.5h3.4a2 2 0 0 1 1.66.89l.88 1.32A2 2 0 0 0 12.1 6.6h7.4A2.5 2.5 0 0 1 22 9.1v8.4a2.5 2.5 0 0 1-2.5 2.5Z" />
));

export const FolderOpen = createIcon('FolderOpen', () => (
  <path d="m5.5 14 1.4-2.8A2 2 0 0 1 8.7 10h11a1.8 1.8 0 0 1 1.72 2.34l-1.5 5A2.2 2.2 0 0 1 17.8 19H4.5A2.5 2.5 0 0 1 2 16.5V6A2.5 2.5 0 0 1 4.5 3.5h3.3a2 2 0 0 1 1.66.89l.84 1.25a2 2 0 0 0 1.66.86H17.5A2.5 2.5 0 0 1 20 9v1" />
));

export const StickyNote = createIcon('StickyNote', () => (
  <>
    <path d="M15 3.5H5.5A2.5 2.5 0 0 0 3 6v12.5A2.5 2.5 0 0 0 5.5 21h12A2.5 2.5 0 0 0 20 18.5V8.5L15 3.5Z" />
    <path d="M14.5 3.5V7a2 2 0 0 0 2 2H20" />
  </>
));

export const BookOpen = createIcon('BookOpen', () => (
  <>
    <path d="M2.5 4.5A1.5 1.5 0 0 1 4 3h4.5A3.5 3.5 0 0 1 12 6.5V20a2.75 2.75 0 0 0-2.75-2.75H4A1.5 1.5 0 0 1 2.5 15.75V4.5Z" />
    <path d="M21.5 4.5A1.5 1.5 0 0 0 20 3h-4.5A3.5 3.5 0 0 0 12 6.5V20a2.75 2.75 0 0 1 2.75-2.75H20a1.5 1.5 0 0 0 1.5-1.5V4.5Z" />
  </>
));

export const Camera = createIcon('Camera', () => (
  <>
    <path d="M14.5 4h-5L7.3 6.8H4.5A2.5 2.5 0 0 0 2 9.3v8.7A2.5 2.5 0 0 0 4.5 20.5h15A2.5 2.5 0 0 0 22 18V9.3a2.5 2.5 0 0 0-2.5-2.5h-2.8L14.5 4Z" />
    <circle cx="12" cy="13.25" r="3.25" />
  </>
));

export const Image = createIcon('Image', () => (
  <>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="8.75" cy="8.75" r="1.75" />
    <path d="m21 15.25-3.2-3.2a2 2 0 0 0-2.83 0L6.25 20.8" />
  </>
));

export const Youtube = createIcon('Youtube', () => (
  <>
    <rect x="2.25" y="5" width="19.5" height="14" rx="4" />
    <path d="M10.25 9.25 15 12l-4.75 2.75v-5.5Z" />
  </>
));
