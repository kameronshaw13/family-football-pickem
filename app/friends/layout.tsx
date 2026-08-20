import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Friends Pick'em",
  description: "Private Friends football pick'em.",
  applicationName: "Friends Pick'em",
  appleWebApp: { capable: true, title: "Friends Pick'em", statusBarStyle: "black-translucent" },
  icons: { icon: "/friends-app-icon.png", apple: "/friends-app-icon.png" },
  manifest: "/friends/manifest.webmanifest"
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
