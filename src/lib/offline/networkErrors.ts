/**
 * Network / connectivity error detection shared by the offline layer.
 * Kept free of React and queue imports so syncQueue and useNetworkStatus can
 * both depend on it without a circular import.
 */
export const isOfflineError = (err: any): boolean => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (!err) return false;
  const msg = String(err?.message || err?.error_description || err || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('offline') ||
    msg.includes('fetch error') ||
    msg.includes('err_internet_disconnected') ||
    msg.includes('err_network')
  );
};
