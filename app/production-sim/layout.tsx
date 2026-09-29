import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Commissioner Setup Simulation",
  description: "Prototype commissioner onboarding for Football Pick'em.",
  applicationName: "Football Pick'em"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#11171b"
};

export default function ProductionSimLayout({ children }: { children: React.ReactNode }) {
  return children;
}
