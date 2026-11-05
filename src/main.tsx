import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { AuthProvider } from "./lib/AuthContext";
import { BandProvider } from "./lib/BandContext";
import { OnboardingProvider } from "./lib/OnboardingContext";
import { ThemeProvider } from "./lib/ThemeContext";
import App from "./app/App";

// Detect native platform and set safe margin attributes
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add("is-native");
  if (Capacitor.getPlatform() === "android") {
    document.documentElement.classList.add("is-android");
    document.documentElement.setAttribute("data-platform", "android");
  }
}

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/inter/900.css";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <AuthProvider>
      <OnboardingProvider>
        <BandProvider>
          <App />
        </BandProvider>
      </OnboardingProvider>
    </AuthProvider>
  </ThemeProvider>
);

function removeSplash() {
  const splash = document.getElementById("css-splash");
  if (splash) {
    splash.style.opacity = "0";
    splash.style.transition = "opacity 0.4s ease";
    setTimeout(() => splash.remove(), 500);
  }
}

requestAnimationFrame(removeSplash);
setTimeout(removeSplash, 150);
