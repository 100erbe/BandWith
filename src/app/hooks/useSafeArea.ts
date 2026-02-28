import { useMemo } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Hook to get platform-aware safe area values
 * Android doesn't properly support env(safe-area-inset-*), so we provide fallbacks
 */
export function useSafeArea() {
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();
  const isAndroid = platform === 'android';
  const isIOS = platform === 'ios';

  const safeArea = useMemo(() => {
    if (isAndroid && isNative) {
      // Match iOS visual spacing for consistency
      // iOS has generous safe area, we replicate that feel on Android
      return {
        top: 48,
        bottom: 24,
        left: 0,
        right: 0,
        // CSS-ready values with extra padding (matching iOS feel)
        paddingTop: '56px',       // Match iOS safe area spacing
        paddingBottom: '24px',    // nav bar area
        // For modals/overlays that need full safe area
        modalPaddingTop: '60px',
        // CSS values for inline styles
        cssTop: '48px',
        cssBottom: '24px',
      };
    }
    
    // iOS and web use CSS env() variables
    return {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      modalPaddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
      cssTop: 'env(safe-area-inset-top, 0px)',
      cssBottom: 'env(safe-area-inset-bottom, 0px)',
    };
  }, [isAndroid, isNative]);

  return {
    ...safeArea,
    isAndroid,
    isIOS,
    isNative,
    platform,
  };
}

/**
 * Get safe area style for a container
 */
export function getSafeAreaStyle(position: 'top' | 'bottom' | 'both' = 'both') {
  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform();
  const isAndroid = platform === 'android' && isNative;

  const styles: React.CSSProperties = {};

  if (position === 'top' || position === 'both') {
    styles.paddingTop = isAndroid 
      ? '56px'  // Match iOS safe area feel
      : 'max(env(safe-area-inset-top, 0px), 12px)';
  }

  if (position === 'bottom' || position === 'both') {
    styles.paddingBottom = isAndroid 
      ? '24px' 
      : 'env(safe-area-inset-bottom, 0px)';
  }

  return styles;
}
