import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Caleb Family Pick'em",
  description: "Private Caleb Family football confidence pick'em.",
  applicationName: "Family Pick'em",
  appleWebApp: { capable: true, title: "Family Pick'em", statusBarStyle: "black-translucent" },
  icons: { icon: "/caleb-app-icon-gold.png?v=3", apple: "/caleb-app-icon-gold.png?v=3" },
  manifest: "/caleb-family-manifest.webmanifest"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#20282d"
};

export default function CalebFamilyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
