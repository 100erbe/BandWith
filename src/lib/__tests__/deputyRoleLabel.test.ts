import { describe, expect, it } from 'vitest';
import { roleLabel } from '../../deputy/strings';
import { instrumentKeys } from '../instruments';

describe('deputy page role', () => {
  it('shows known instruments in the deputy language', () => {
    expect(roleLabel('bass', 'it', instrumentKeys)).toBe('Basso');
    expect(roleLabel('Basso', 'en', instrumentKeys)).toBe('Bass');
    expect(roleLabel('Guitar / Backing vocals', 'es', instrumentKeys)).toBe('Guitarra · Voz');
    expect(roleLabel('Double bass', 'fr', instrumentKeys)).toBe('Contrebasse');
  });
  it('keeps anything else as written', () => {
    expect(roleLabel('Harp', 'it', instrumentKeys)).toBe('Harp');
    expect(roleLabel('Bass · Band leader', 'it', instrumentKeys)).toBe('Bass · Band leader');
    expect(roleLabel('  ', 'it', instrumentKeys)).toBeNull();
    expect(roleLabel(null, 'it', instrumentKeys)).toBeNull();
  });
});
