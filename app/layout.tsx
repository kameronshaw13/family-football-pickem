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
import "./final-polish.css";
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

const APP_DATA_STARTUP_GUARD_SCRIPT = `
(() => {
  try {
    if (window.__pickemAppDataFetchGuardInstalled) return;
    window.__pickemAppDataFetchGuardInstalled = true;
    const nativeFetch = window.fetch.bind(window);
    const transientStatuses = new Set([408, 425, 429, 500, 502, 503, 504]);
    const maxAge = 24 * 60 * 60 * 1000;

    function cacheKey(input, init) {
      try {
        const raw = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
        const url = new URL(raw, window.location.origin);
        if (url.pathname !== "/api/app-data") return "";
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        const group = headers.get("x-pickem-group") || document.documentElement.dataset.pickemGroup || "shaw-family";
        return "pickem_app_data_response_v1:" + group + ":" + (url.searchParams.get("week") || "default");
      } catch {
        return "";
      }
    }

    function readCachedResponse(key) {
      if (!key) return null;
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        const entry = JSON.parse(raw);
        if (!entry || !entry.body || Date.now() - Number(entry.cachedAt || 0) > maxAge) {
          window.localStorage.removeItem(key);
          return null;
        }
        const profile = JSON.parse(window.localStorage.getItem("pickem_profile") || "null");
        const payload = JSON.parse(entry.body);
        if (!profile?.id || !payload?.currentUser?.id || profile.id !== payload.currentUser.id) {
          window.localStorage.removeItem(key);
          return null;
        }
        return new Response(entry.body, { status: 200, headers: { "Content-Type": "application/json", "x-pickem-startup-cache": "1" } });
      } catch {
        try { window.localStorage.removeItem(key); } catch {}
        return null;
      }
    }

    window.fetch = async function guardedFetch(input, init) {
      const key = cacheKey(input, init);
      if (!key) return nativeFetch(input, init);
      try {
        const response = await nativeFetch(input, init);
        if (response.ok) {
          response.clone().text().then((body) => {
            try { window.localStorage.setItem(key, JSON.stringify({ cachedAt: Date.now(), body })); } catch {}
          }).catch(() => undefined);
          return response;
        }
        if (!transientStatuses.has(response.status)) return response;
        return readCachedResponse(key) || response;
      } catch (error) {
        const cached = readCachedResponse(key);
        if (cached) return cached;
        throw error;
      }
    };
  } catch {
    // The normal live request path remains available if this startup guard cannot install.
  }
})();`;

declare global {
  interface Window {
    __pickemAppDataFetchGuardInstalled?: boolean;
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: SESSION_RECOVERY_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: APP_DATA_STARTUP_GUARD_SCRIPT }} />
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
