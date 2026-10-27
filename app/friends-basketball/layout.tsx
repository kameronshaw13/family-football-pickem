import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Friends Basketball Pick'em",
  description: "Private Friends basketball pick'em.",
  applicationName: "Basketball Pick'em",
  appleWebApp: { capable: true, title: "Basketball Pick'em", statusBarStyle: "black-translucent" },
  icons: { icon: "/basketball-pickem-logo.png?v=1", apple: "/basketball-pickem-logo.png?v=1" },
  manifest: "/friends-basketball-manifest.webmanifest"
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
