import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Development Pick'em",
  description: "Development football pick'em league.",
  applicationName: "Football Pick'em",
  appleWebApp: { capable: true, title: "Development Pick'em", statusBarStyle: "black-translucent" },
  icons: { icon: "/friends-app-icon-navy.png?v=3", apple: "/friends-app-icon-navy.png?v=3" },
  manifest: "/development-manifest.webmanifest"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#20282d"
};

export default function ProductionSimLayout({ children }: { children: React.ReactNode }) {
  return children;
}
