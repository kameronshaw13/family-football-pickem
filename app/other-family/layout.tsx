import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Caleb Family Pick'em",
  description: "Private Caleb Family football confidence pick'em.",
  applicationName: "Caleb Family Pick'em",
  appleWebApp: { capable: true, title: "Caleb Family Pick'em", statusBarStyle: "black-translucent" },
  icons: { icon: "/caleb-family-icon.png", apple: "/caleb-family-icon.png" },
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
