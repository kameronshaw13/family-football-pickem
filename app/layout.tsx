import "./globals.css";
import "./spatial-layout.css";
import "./profile-enhancements.css";
import type { Metadata, Viewport } from "next";
import AppExperienceEnhancements from "@/components/AppExperienceEnhancements";
import DogPickAdjustmentAlerts from "@/components/DogPickAdjustmentAlerts";
import PlayerProfiles from "@/components/PlayerProfiles";
import ReceivedSideBetPresentation from "@/components/ReceivedSideBetPresentation";
import SideBetSelfLabels from "@/components/SideBetSelfLabels";
import TestIncomingOfferPreview from "@/components/TestIncomingOfferPreview";

export const metadata: Metadata = {
  title: "Family Football Pick'em",
  description: "Private record-based football pick'em app with hidden locked picks and spread snapshots.",
  applicationName: "Family Pick'em",
  appleWebApp: {
    capable: true,
    title: "Family Pick'em",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png"
  },
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
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400;500;600;700;800;900&display=swap" />
      </head>
      <body>{children}<AppExperienceEnhancements /><ReceivedSideBetPresentation /><SideBetSelfLabels /><DogPickAdjustmentAlerts /><PlayerProfiles /><TestIncomingOfferPreview /></body>
    </html>
  );
}
