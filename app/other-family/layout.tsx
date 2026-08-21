import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Caleb Family Pick'em",
  description: "Private Caleb Family football confidence pick'em.",
  applicationName: "Family Pick'em",
  appleWebApp: { capable: true, title: "Family Pick'em", statusBarStyle: "black-translucent" },
  icons: { icon: "/other-family-app-icon.png", apple: "/other-family-app-icon.png" },
  manifest: "/caleb-family/manifest.webmanifest"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#20282d"
};

export default function OtherFamilyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
