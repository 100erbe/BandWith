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
    // Edge-to-edge: the web view draws under transparent system bars and the
    // app pads its own content with --safe-top / --safe-bottom (theme.css).
    StatusBar: {
      overlaysWebView: true,
      style: 'DEFAULT'
    },
    SystemBars: {
      // Android: inject correct --safe-area-inset-* CSS variables
      insetsHandling: 'css',
      style: 'DEFAULT'
    },
    Keyboard: {
      // 'native' shrinks the web view itself, so full-screen `fixed inset-0`
      // panels (chat composer, wizards) stay above the keyboard. 'body' only
      // resized <body> and, with contentInset 'never', left inputs hidden.
      resize: 'native',
      style: 'dark'
    },
    PushNotifications: {
      // No "alert"/"sound": with the app open the OS would show every push
      // before JS can skip the chat the user is reading. pushNotifications.ts
      // shows a local notification for everything else.
      presentationOptions: ["badge"]
    },
    LocalNotifications: {
      smallIcon: "ic_stat_notification",
      iconColor: "#050505",
      sound: "default"
    }
  },
  ios: {
    contentInset: 'never',
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
