import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pick'em | My Leagues",
  description: "One Pick'em home for all your leagues.",
  applicationName: "Pick'em",
  appleWebApp: { capable: true, title: "Pick'em", statusBarStyle: "black-translucent" },
  icons: { icon: "/unified-pickem-cover.png", apple: "/unified-pickem-cover.png" },
  manifest: "/pickem-hub-manifest.webmanifest"
};

export default function MyLeaguesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
