import "./globals.css";
import "./spatial-layout.css";
import "./experience-enhancements.css";
import "./profile-enhancements.css";
import "./group-themes.css";
import type { Metadata, Viewport } from "next";
import AppExperienceEnhancements from "@/components/AppExperienceEnhancements";
import AppUiCoordinator from "@/components/AppUiCoordinator";
import DogPickAdjustmentAlerts from "@/components/DogPickAdjustmentAlerts";
import PlayerProfiles from "@/components/PlayerProfiles";
import TestIncomingOfferPreview from "@/components/TestIncomingOfferPreview";

export const metadata: Metadata = {
  title: "Family Football Pick'em",
  description: "Private Shaw Family football pick'em.",
  applicationName: "Family Pick'em",
  appleWebApp: { capable: true, title: "Family Pick'em", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.png", apple: "/icon.png" },
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#20282d"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preload" href="/header-wordmark.png" as="image" type="image/png" />
        <link rel="preload" href="/football-pickem-wordmark.png" as="image" type="image/png" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;500;600;700;800;900&display=swap" />
      </head>
      <body>{children}<AppExperienceEnhancements /><AppUiCoordinator /><DogPickAdjustmentAlerts /><PlayerProfiles /><TestIncomingOfferPreview /></body>
    </html>
  );
}
