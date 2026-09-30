import type { Metadata, Viewport } from "next";
import "./production-sim.css";

export const metadata: Metadata = {
  title: "Commissioner Setup Preview",
  description: "Production-style commissioner onboarding prototype for Football Pick'em.",
  applicationName: "Football Pick'em"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#07131f"
};

export default function ProductionSimLayout({ children }: { children: React.ReactNode }) {
  return children;
}
