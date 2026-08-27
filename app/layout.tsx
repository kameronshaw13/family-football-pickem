import "./globals.css";
import "./spatial-layout.css";
import "./experience-enhancements.css";
import "./profile-enhancements.css";
import "./group-themes.css";
import "./requested-fixes.css";
import "./pending-side-bets.css";
import "./dog-card-optical-spacing.css";
import "./stable-font-metrics.css";
import "./friends-eight-player.css";
import "./universal-card-dividers.css";
import type { Metadata, Viewport } from "next";
import AppExperienceEnhancements from "@/components/AppExperienceEnhancements";
import AppUiCoordinator from "@/components/AppUiCoordinator";
import DogPickAdjustmentAlerts from "@/components/DogPickAdjustmentAlerts";
import PlayerProfiles from "@/components/PlayerProfiles";

export const metadata: Metadata = {
  title: "Family Football Pick'em",
  description: "Private Shaw Family football pick'em.",
  applicationName: "Family Pick'em",
  appleWebApp: { capable: true, title: "Family Pick'em", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.png", apple: "/icon.png" }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#20282d"
};

const SESSION_RECOVERY_SCRIPT = `
(() => {
  try {
    const tokenKey = "pickem_session_token";
    const cookieName = "pickem_session";
    const cookieToken = document.cookie
      .split("; ")
      .find((part) => part.startsWith(cookieName + "="))
      ?.slice(cookieName.length + 1);
    const storedToken = window.localStorage.getItem(tokenKey);

    if (storedToken) {
      document.cookie = cookieName + "=" + encodeURIComponent(storedToken) + "; Max-Age=31536000; Path=/; SameSite=Lax; Secure";
    } else if (cookieToken) {
      window.localStorage.setItem(tokenKey, decodeURIComponent(cookieToken));
    }
  } catch {
    // If storage is unavailable, normal sign-in remains available.
  }
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: SESSION_RECOVERY_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preload" href="/header-wordmark.png" as="image" type="image/png" />
        <link rel="preload" href="/football-pickem-wordmark.png" as="image" type="image/png" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;500;600;700;800;900&display=swap" />
      </head>
      <body>{children}<AppExperienceEnhancements /><AppUiCoordinator /><DogPickAdjustmentAlerts /><PlayerProfiles /></body>
    </html>
  );
}
