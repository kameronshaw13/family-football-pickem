import "./globals.css";
import type { Metadata, Viewport } from "next";

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
  themeColor: "#442512"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
