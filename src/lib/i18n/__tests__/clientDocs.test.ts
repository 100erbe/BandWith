/**
 * Client documents (contract / rider PDF and message) are written in the
 * client's language; English stays exactly as before.
 */
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { setLocalePref, translate } from '../index';
import { docLanguageFor, rememberDocLanguage } from '../docLanguage';
import { buildContractPdfBytes, buildSendMessage, standardTerms, STANDARD_TERMS, type Contract } from '../../services/contracts';

const contract = (over: Partial<Contract> = {}): Contract => ({
  id: 'c1',
  band_id: 'b1',
  title: 'Gala',
  type: 'contract',
  status: 'sent',
  event_name: 'Villa Rossi',
  event_date: '2027-03-20',
  client_name: 'Giulia',
  client_email: 'g@x.it',
  content: 'Notes',
  created_at: '2026-11-01T10:00:00Z',
  ...over,
});

const ascii = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('');

beforeEach(() => localStorage.clear());
afterEach(() => setLocalePref('en'));

describe('contract message', () => {
  it('keeps English as before by default', () => {
    expect(buildSendMessage(contract(), 'The Band').body).toBe(
      'Hi Giulia,\n\nPlease find attached the contract "Gala" for Villa Rossi on 20 Mar 2027.\nPlease review it and send it back signed.\n\nBest regards,\nThe Band',
    );
  });

  it('is written in the client language', () => {
    expect(buildSendMessage(contract(), 'The Band', 'it').body).toBe(
      'Gentile Giulia,\n\nin allegato trovate il contratto "Gala" per Villa Rossi del 20 mar 2027.\nVi preghiamo di verificarlo e di rimandarcelo firmato.\n\nCordiali saluti,\nThe Band',
    );
    expect(buildSendMessage(contract({ type: 'rider', event_name: null }), null, 'fr').body).toContain(
      'Veuillez trouver ci-joint la fiche technique « Gala » pour l’événement du 20 mars 2027.'.replace('’', "'"),
    );
  });
});

describe('contract PDF', () => {
  it('translates headings, labels and footer (WinAnsi accents)', () => {
    const de = ascii(buildContractPdfBytes(contract(), { bandName: 'The Band', lang: 'de', now: new Date(2026, 10, 10) }));
    expect(de).toContain('(VERTRAG)');
    expect(de).toContain('Seite 1 von 1');
    expect(de).toContain('(F\xfcr Giulia)');
    const es = ascii(buildContractPdfBytes(contract({ type: 'rider' }), { lang: 'es' }));
    expect(es).toContain('RIDER T\xc9CNICO');
    expect(es).toContain('P\xe1gina 1 de 1');
  });
});

describe('standard terms', () => {
  it('English constant unchanged, other languages translated', () => {
    expect(STANDARD_TERMS.contract).toBe(standardTerms('contract'));
    expect(STANDARD_TERMS.contract.startsWith('Performance: the band performs live')).toBe(true);
    expect(standardTerms('rider', 'it').startsWith('Palco: minimo 6 × 4 m')).toBe(true);
    expect(standardTerms('contract', 'pt').split('\n\n')).toHaveLength(8);
  });
});

describe('document language', () => {
  it('starts from the app language and is remembered per client', () => {
    setLocalePref('es');
    expect(docLanguageFor('new@client.com')).toBe('es');
    rememberDocLanguage('Anna@Client.com ', 'de');
    expect(docLanguageFor('anna@client.com')).toBe('de');
    expect(docLanguageFor(null)).toBe('es');
  });

  it('translate() ignores the app language', () => {
    setLocalePref('it');
    expect(translate('en', 'Best regards,')).toBe('Best regards,');
    expect(translate('pt', 'Best regards,')).toBe('Atenciosamente,');
  });
});
