import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Friends Pick'em",
  description: "Private Friends football pick'em.",
  applicationName: "Football Pick'em",
  appleWebApp: { capable: true, title: "Football Pick'em", statusBarStyle: "black-translucent" },
  icons: { icon: "/friends-app-icon-navy.png?v=2", apple: "/friends-app-icon-navy.png?v=2" },
  manifest: "/friends-manifest.webmanifest"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#20282d"
};

export default function FriendsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
