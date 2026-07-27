import "./globals.css";
import "./spatial-layout.css";
import "./family-ui-refresh.css";
import "./family-ui-refresh-phase2.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Shaw Family Pick'em",
  description: "The private Shaw family football pick'em league.",
  applicationName: "Shaw Pick'em",
  appleWebApp: {
    capable: true,
    title: "Shaw Pick'em",
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
  themeColor: "#17242f"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
