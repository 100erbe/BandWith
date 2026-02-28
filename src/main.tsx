import { createRoot } from "react-dom/client";
import { AuthProvider } from "./lib/AuthContext";
import { BandProvider } from "./lib/BandContext";
import { OnboardingProvider } from "./lib/OnboardingContext";
import App from "./app/App";

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/inter/900.css";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <OnboardingProvider>
      <BandProvider>
        <App />
      </BandProvider>
    </OnboardingProvider>
  </AuthProvider>
);

requestAnimationFrame(() => {
  const splash = document.getElementById("css-splash");
  if (splash) {
    splash.style.opacity = "0";
    splash.style.transition = "opacity 0.4s ease";
    setTimeout(() => splash.remove(), 500);
  }
});
