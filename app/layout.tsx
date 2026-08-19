import "./globals.css";
import "./spatial-layout.css";
import "./experience-enhancements.css";
import "./profile-enhancements.css";
import "./group-themes.css";
import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import AppExperienceEnhancements from "@/components/AppExperienceEnhancements";
import AppUiCoordinator from "@/components/AppUiCoordinator";
import DogPickAdjustmentAlerts from "@/components/DogPickAdjustmentAlerts";
import GroupExperience from "@/components/GroupExperience";
import PlayerProfiles from "@/components/PlayerProfiles";
import TestIncomingOfferPreview from "@/components/TestIncomingOfferPreview";

function activeGroupSlug() {
  return cookies().get("pickem_group")?.value || "shaw-family";
}

function groupMetadata(slug: string) {
  if (slug === "other-family") return { title: "Other Family Pick'em", appName: "Other Family", icon: "/football-icon.svg" };
  if (slug === "friends") return { title: "Friends Pick'em", appName: "Friends Pick'em", icon: "/football-icon.svg" };
  return { title: "Family Football Pick'em", appName: "Family Pick'em", icon: "/icon.png" };
}

export function generateMetadata(): Metadata {
  const meta = groupMetadata(activeGroupSlug());
  return {
    title: meta.title,
    description: "Private record-based football pick'em app with hidden locked picks and spread snapshots.",
    applicationName: meta.appName,
    appleWebApp: { capable: true, title: meta.appName, statusBarStyle: "black-translucent" },
    icons: { icon: meta.icon, apple: meta.icon },
    manifest: "/manifest.webmanifest"
  };
}

export function generateViewport(): Viewport {
  return {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    themeColor: activeGroupSlug() === "other-family" ? "#0b0b0b" : "#20282d"
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preload" href="/header-wordmark.png" as="image" type="image/png" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;500;600;700;800;900&display=swap" />
      </head>
      <body>{children}<AppExperienceEnhancements /><AppUiCoordinator /><DogPickAdjustmentAlerts /><PlayerProfiles /><TestIncomingOfferPreview /><GroupExperience /></body>
    </html>
  );
}
