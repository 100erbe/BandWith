/**
 * Safe-area values as CSS strings. They resolve through the --safe-* tokens in
 * theme.css, which read Capacitor's injected --safe-area-inset-* variables on
 * Android and env(safe-area-inset-*) on iOS and the web.
 */
const SAFE = {
  paddingTop: 'max(var(--safe-top), 12px)',
  paddingBottom: 'var(--safe-bottom)',
  modalPaddingTop: 'calc(var(--safe-top) + 12px)',
  cssTop: 'var(--safe-top)',
  cssBottom: 'var(--safe-bottom)',
} as const;

export function useSafeArea() {
  return SAFE;
}

export function getSafeAreaStyle(position: 'top' | 'bottom' | 'both' = 'both') {
  const styles: React.CSSProperties = {};
  if (position === 'top' || position === 'both') styles.paddingTop = SAFE.paddingTop;
  if (position === 'bottom' || position === 'both') styles.paddingBottom = SAFE.paddingBottom;
  return styles;
}
