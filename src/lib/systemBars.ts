import { registerPlugin, Capacitor } from '@capacitor/core';

interface SystemBarsPluginInterface {
  setAppearance(options: { isLight: boolean }): Promise<void>;
}

export const SystemBars = registerPlugin<SystemBarsPluginInterface>('SystemBars');

/**
 * Syncs the phone's soft navigation bar buttons (black on light mode, white on dark mode)
 * and status bar styling with the current app theme.
 */
export async function syncSystemBarsAppearance(resolvedTheme: 'light' | 'dark'): Promise<void> {
  const isLight = resolvedTheme === 'light';

  // 1. Update theme-color meta tag (used by Android Chrome / WebViews)
  if (typeof document !== 'undefined') {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isLight ? '#E6E5E1' : '#050505');
    }
  }

  // 2. If running inside native Capacitor, invoke Android SystemBars & StatusBar
  if (Capacitor.isNativePlatform()) {
    try {
      await SystemBars.setAppearance({ isLight });
    } catch (_) {
      // SystemBars custom plugin may not be available on iOS or fallback
    }

    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setStyle({ style: isLight ? Style.Light : Style.Dark });
      await StatusBar.setBackgroundColor({ color: isLight ? '#E6E5E1' : '#050505' });
    } catch (_) {}
  }
}
