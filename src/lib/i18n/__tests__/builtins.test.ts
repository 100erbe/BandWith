/**
 * Built-in texts (starter to-do lists, default quote packages and services,
 * checklists, venue shortcuts) show in the app or document language while
 * unchanged; English and anything the band wrote stay as they are.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { DICTIONARIES, setLocalePref } from '../index';
import { BUILTIN_TEXTS, builtinText } from '../builtins';
import { STARTER_TEMPLATES, normalizeTemplate } from '../../services/taskTemplates';
import {
  DEFAULT_LINEUP_PACKAGES,
  WEDDING_SERVICE_PRESETS,
  CLUB_ROCK_SERVICE_PRESETS,
  CORPORATE_JAZZ_PRESETS,
  bankDetailParts,
} from '../../services/pricing';
import { rehearsalCadence } from '../../../app/components/event/format';

afterEach(() => setLocalePref('en'));

describe('built-in texts', () => {
  it('cover every starter list, package and service text', () => {
    const sources = [
      ...STARTER_TEMPLATES.flatMap((tpl) => [tpl.name, tpl.description ?? '', ...tpl.tasks.map((task) => task.title)]),
      ...DEFAULT_LINEUP_PACKAGES.flatMap((p) => [p.name, p.description ?? '']),
      ...[...WEDDING_SERVICE_PRESETS, ...CLUB_ROCK_SERVICE_PRESETS, ...CORPORATE_JAZZ_PRESETS].flatMap((s) => [s.name, s.description ?? '']),
    ].filter(Boolean);
    const known = new Set<string>(BUILTIN_TEXTS);
    expect(sources.filter((s) => !known.has(s))).toEqual([]);
  });

  for (const [locale, dict] of Object.entries(DICTIONARIES)) {
    it(`${locale}: every built-in text is translated`, () => {
      expect(BUILTIN_TEXTS.filter((s) => !dict[s])).toEqual([]);
    });
  }

  it('translates only unchanged built-in texts', () => {
    expect(builtinText('Wedding gig checklist')).toBe('Wedding gig checklist');
    setLocalePref('it');
    expect(builtinText('Wedding gig checklist')).not.toBe('Wedding gig checklist');
    expect(builtinText('Wedding gig checklist (ours)')).toBe('Wedding gig checklist (ours)');
    expect(builtinText('Full Band', 'en')).toBe('Full Band');
    expect(builtinText(null)).toBeNull();
  });

  it('shows saved starter lists in the app language', () => {
    const row = { id: 'x', band_id: 'b', ...STARTER_TEMPLATES[0], is_default: true };
    expect(normalizeTemplate(row).name).toBe('Wedding gig checklist');
    setLocalePref('de');
    const de = normalizeTemplate(row);
    expect(de.name).toBe(DICTIONARIES.de['Wedding gig checklist']);
    expect(de.tasks[0].title).toBe(DICTIONARIES.de['Prepare contract and get it signed']);
  });
});

describe('bank details on the quote PDF', () => {
  const s = { bank_account_holder: 'Velvet Srl', bank_iban: 'IT60X0542811101000000123456', bank_bic_swift: 'BPMOIT22', bank_name: 'Banca X' };
  it('keeps English as before and follows the document language', () => {
    expect(bankDetailParts(s)).toEqual([
      'Beneficiary: Velvet Srl',
      'IBAN: IT60X0542811101000000123456',
      'BIC: BPMOIT22',
      'Bank: Banca X',
    ]);
    const it_ = bankDetailParts(s, 'it');
    expect(it_[1]).toBe('IBAN: IT60X0542811101000000123456');
    expect(it_[0]).toContain('Velvet Srl');
    expect(it_[0]).not.toContain('Beneficiary');
  });
});

describe('rehearsal cadence chip', () => {
  it('stays English by default and translates otherwise', () => {
    expect(rehearsalCadence(false, null as never)).toBe('ONCE');
    expect(rehearsalCadence(true, { freq: 'weekly', interval: 1 }, '2026-11-14')).toBe('EVERY SATURDAY');
    setLocalePref('it');
    expect(rehearsalCadence(true, { freq: 'weekly', interval: 1 }, '2026-11-10')).toBe('OGNI MARTEDÌ');
    setLocalePref('pt');
    expect(rehearsalCadence(true, { freq: 'weekly', interval: 1 }, '2026-11-14')).toMatch(/^TODO /);
    expect(rehearsalCadence(true, { freq: 'weekly', interval: 1 }, '2026-11-10')).toMatch(/^TODA /);
  });
});
