import type { CapacitorConfig } from '@capacitor/cli';

// Debug-only native settings. Enable them for local builds with
//   CAP_DEBUG=true npx cap sync
// Release builds must NOT allow WebView debugging (anyone with USB access could
// read the session tokens) or mixed http content.
const isDebugBuild = process.env.CAP_DEBUG === 'true';

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
      backgroundColor: '#000000',
      showSpinner: false
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#000000'
    },
    Keyboard: {
      resize: 'body',
      style: 'dark'
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    LocalNotifications: {
      smallIcon: "ic_stat_notification",
      iconColor: "#050505",
      sound: "default"
    }
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#000000'
  },
  android: {
    allowMixedContent: isDebugBuild,
    captureInput: false,
    webContentsDebuggingEnabled: isDebugBuild
  }
};

export default config;
