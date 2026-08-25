import type { CapacitorConfig } from '@capacitor/cli';

// Dark surfaces match the app dark background token
// (src/styles/theme.css: .dark { --bg: #121212 }). Avoid pure black.
const DARK_BACKGROUND = '#121212';

const config: CapacitorConfig = {
  appId: 'com.bandwith.app',
  appName: 'BandWith',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: ['*.supabase.co']
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: DARK_BACKGROUND,
      showSpinner: false
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: DARK_BACKGROUND
    },
    Keyboard: {
      resize: 'body',
      style: 'dark'
    }
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: DARK_BACKGROUND
  },
  android: {
    allowMixedContent: true,
    captureInput: false,
    webContentsDebuggingEnabled: true
  }
};

export default config;
