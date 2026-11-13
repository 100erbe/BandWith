import { describe, it, expect, vi } from 'vitest';
import sql079 from '../../../../supabase/migrations/079_band_member_fees_revoke.sql?raw';
import sql080 from '../../../../supabase/migrations/080_band_private_revoke.sql?raw';
import sql081 from '../../../../supabase/migrations/081_event_private_revoke.sql?raw';

vi.mock('@/lib/supabase', () => ({ supabase: {}, getSafeUser: async () => ({ data: { user: null } }) }));

import { BAND_MEMBER_COLUMNS } from '../bandMemberFees';
import { BAND_PUBLIC_COLUMNS } from '../bandPrivate';
import { EVENT_PUBLIC_COLUMNS } from '../eventPrivate';

/** Columns granted by `GRANT SELECT (...) ON public.<table>` in a migration. */
const granted = (sql: string, table: string): string[] => {
  const m = sql.match(new RegExp(`GRANT SELECT \\(([^)]+)\\)\\s+ON public\\.${table} TO authenticated`));
  if (!m) throw new Error(`no column GRANT on ${table}`);
  return m[1].split(',').map((c: string) => c.trim()).sort();
};
const cols = (list: string) => list.split(',').map((c: string) => c.trim()).sort();

// After the step-2 revokes the app may read only the granted columns: a
// column added to a list in code but not to the GRANT would fail every load.
describe('column grants match what the app reads (079-081)', () => {
  it('band_members', () => expect(granted(sql079, 'band_members')).toEqual(cols(BAND_MEMBER_COLUMNS)));
  it('bands', () => expect(granted(sql080, 'bands')).toEqual(cols(BAND_PUBLIC_COLUMNS)));
  it('events', () => expect(granted(sql081, 'events')).toEqual(cols(EVENT_PUBLIC_COLUMNS)));
});
