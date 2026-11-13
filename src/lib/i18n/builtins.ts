/**
 * Texts the app writes for the band (starter to-do lists, default quote
 * packages and services, gear checklists, venue shortcuts…). They are saved
 * in English, so they are translated when shown, and only while they are
 * still exactly the built-in text: anything the band wrote or edited is
 * shown as written. English is returned unchanged.
 */
import { getLocale, translate, type Locale } from './index';

export const BUILTIN_TEXTS = [
  // Starter to-do lists (services/taskTemplates.ts STARTER_TEMPLATES)
  'Wedding gig checklist',
  'Complete checklist for wedding performances',
  'Prepare contract and get it signed',
  'Confirm final setlist with the couple',
  'Check venue access and load-in times',
  'Confirm sound check time',
  'Pack equipment checklist',
  'Send final invoice',
  'Corporate event',
  'Standard corporate gig preparation',
  'Review event brief',
  'Confirm dress code',
  'Check AV requirements',
  'Prepare invoice',
  'Sound check',
  'Festival set',
  'Festival and outdoor event checklist',
  'Submit tech rider',
  'Confirm stage time',
  'Arrange transport',
  'Pack weather gear',
  'Collect artist passes',
  'Rehearsal session',
  'Pre-rehearsal preparation',
  'Book rehearsal room',
  'Share setlist with the band',
  'Prepare charts and lyrics',
  'Check equipment',
  // Quote lineup packages (services/pricing.ts DEFAULT_LINEUP_PACKAGES)
  'Solo',
  'Solo performance',
  'Duo',
  'Vocals + instrument duo',
  'Trio',
  '3-piece compact lineup',
  'Full Band',
  'Full live band show',
  // Quote services (WEDDING / CLUB_ROCK / CORPORATE_JAZZ presets)
  'Ceremony Live Music',
  'Entrance, ceremony highlights & exit (30-45 mins)',
  'Cocktail / Aperitif Set',
  'Welcome drinks acoustic/lounge set (60 mins)',
  'Dinner Background Set',
  'Soft background music during dinner',
  'After-Party DJ Set',
  'DJ music after the live band sets',
  'Secondary Audio Zone',
  'Extra speaker + wireless mic for outdoor/garden area',
  'Extra 45m Live Set',
  'Additional 45-minute live performance set',
  'Acoustic Opening Set',
  'Warm-up acoustic set before main show',
  'Dedicated FOH Sound Engineer',
  'Professional sound technician for the event',
  'Full Backline & Drum Kit Rental',
  'Band provides full backline and drum kit',
  'Networking / Welcome Reception Set',
  'Elegant instrumental background set (60 mins)',
  'Speech & Awards Wireless Mic Package',
  'PA coverage + 2 wireless microphones for speeches',
  'Early Load-In / Idle Waiting Time',
  'Setup prior to corporate doors opening',
  'Custom Line Item',
  // Rehearsal gear checklists (RehearsalCreationWizard)
  'Instrument',
  'Cables',
  'Tuner',
  'Power Supply',
  'Spare Strings/Sticks',
  'Earplugs',
  'PA System Check',
  'Extension Cords',
  'Backup Cables',
  'First Aid Kit',
  // Venue shortcuts and default names saved with events
  'Main Stage',
  'Private Venue',
  'Band HQ',
  'Studio A',
  'Home Studio',
  'Band Practice Space',
  'Rehearsal Setlist',
  'New Setlist',
] as const;

const BUILTIN = new Set<string>(BUILTIN_TEXTS);

export const isBuiltinText = (s: string | null | undefined): boolean => !!s && BUILTIN.has(s);

/** The text in language `l` (default: the app language) when it is a built-in text, else as written. */
export function builtinText(s: string, l?: Locale): string;
export function builtinText(s: string | null | undefined, l?: Locale): string | null | undefined;
export function builtinText(s: string | null | undefined, l: Locale = getLocale()): string | null | undefined {
  if (!s || l === 'en' || !BUILTIN.has(s)) return s;
  return translate(l, s);
}
