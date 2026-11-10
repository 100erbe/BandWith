import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

/**
 * Marks <html data-keyboard="open"> while the software keyboard is up.
 *
 * Keyboard resize is 'native' (capacitor.config.ts), so the web view already
 * ends at the top of the keyboard. The home-indicator / navigation-bar inset
 * in --safe-bottom then only adds dead space above the keyboard; theme.css
 * zeroes it while this attribute is set.
 */
export function installKeyboardInsets(): void {
  if (typeof document === 'undefined') return;
  try {
    if (!Capacitor.isNativePlatform()) return;
    const root = document.documentElement;
    const open = () => root.setAttribute('data-keyboard', 'open');
    const close = () => root.removeAttribute('data-keyboard');
    void Keyboard.addListener('keyboardWillShow', open).catch(() => {});
    void Keyboard.addListener('keyboardWillHide', close).catch(() => {});
  } catch {
    // Plugin missing on this build: keep the default insets.
  }
}
