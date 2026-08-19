import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Other Family Pick'em",
  description: "Private Other Family football confidence pick'em.",
  applicationName: "Other Family Pick'em",
  appleWebApp: { capable: true, title: "Other Family Pick'em", statusBarStyle: "black-translucent" },
  icons: { icon: "/football-icon.svg", apple: "/football-icon.svg" },
  manifest: "/other-family/manifest.webmanifest"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b0b0b"
};

export default function OtherFamilyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
