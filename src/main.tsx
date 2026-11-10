import { createRoot } from "react-dom/client";
import { MotionConfig } from "motion/react";
import { Capacitor } from "@capacitor/core";
import { AuthProvider } from "./lib/AuthContext";
import { BandProvider } from "./lib/BandContext";
import { OnboardingProvider } from "./lib/OnboardingContext";
import { ThemeProvider } from "./lib/ThemeContext";
import App from "./app/App";
import { enableEdgeToEdge } from "./lib/systemBars";
import { installDuoLayout } from "./lib/deviceRegions";
import { installKeyboardInsets } from "./lib/keyboardInsets";

// Detect native platform and set safe margin attributes
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add("is-native");
  if (Capacitor.getPlatform() === "android") {
    document.documentElement.classList.add("is-android");
    document.documentElement.setAttribute("data-platform", "android");
  }
  void enableEdgeToEdge();
  installDuoLayout();
  installKeyboardInsets();
}

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/inter/900.css";
import "./styles/index.css";
import "./styles/duo-panes.css";

createRoot(document.getElementById("root")!).render(
  <MotionConfig reducedMotion="user">
    <ThemeProvider>
      <AuthProvider>
        <OnboardingProvider>
          <BandProvider>
            <App />
          </BandProvider>
        </OnboardingProvider>
      </AuthProvider>
    </ThemeProvider>
  </MotionConfig>
);

// The launch splash (#bw-splash in index.html) plays and removes itself; it does
// not wait for React, so the app keeps booting underneath it.
