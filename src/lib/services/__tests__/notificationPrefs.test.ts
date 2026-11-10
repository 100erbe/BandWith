/**
 * Notification prefs: batch save for the identity hub master toggle.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();
const selectResults: Array<{ data: unknown; error: unknown }> = [];
const updateMock = vi.fn();

vi.mock('@/lib/supabase', () => {
  const from = () => ({
    select: () => {
      const chain: any = {
        eq: () => chain,
        maybeSingle: () => Promise.resolve(selectResults.shift() ?? { data: null, error: null }),
      };
      return chain;
    },
    update: (values: unknown) => ({
      eq: () => Promise.resolve(updateMock(values) ?? { error: null }),
    }),
  });
  return { supabase: { from }, getSafeUser: () => mockGetUser() };
});

import { saveNotificationPrefs, saveNotificationPref, readLocalPref } from '../notificationPrefs';

beforeEach(() => {
  selectResults.length = 0;
  updateMock.mockReset();
  localStorage.clear();
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
});

describe('saveNotificationPrefs', () => {
  it('saves push and email in one update, keeping other keys', async () => {
    selectResults.push({ data: { notification_preferences: { sms: false, push: true, email: true } }, error: null });
    const res = await saveNotificationPrefs({ push: false, email: false });
    expect(res.error).toBeNull();
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({ notification_preferences: { sms: false, push: false, email: false } });
    expect(readLocalPref('push')).toBe(false);
    expect(readLocalPref('email')).toBe(false);
  });

  it('leaves the local cache untouched when the server rejects', async () => {
    selectResults.push({ data: { notification_preferences: {} }, error: null });
    updateMock.mockReturnValueOnce({ error: { message: 'permission denied' } });
    const res = await saveNotificationPrefs({ push: false, email: false });
    expect(res.error?.message).toBe('permission denied');
    expect(readLocalPref('push')).toBe(true);
    expect(readLocalPref('email')).toBe(true);
  });

  it('single-key helper still works', async () => {
    selectResults.push({ data: { notification_preferences: { push: true } }, error: null });
    await saveNotificationPref('email', false);
    expect(updateMock).toHaveBeenCalledWith({ notification_preferences: { push: true, email: false } });
  });
});
