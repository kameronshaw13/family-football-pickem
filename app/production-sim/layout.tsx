import type { Metadata, Viewport } from "next";
import "./production-sim.css";

export const metadata: Metadata = {
  title: "Football Pick'em",
  description: "Create and run a custom football pick'em league.",
  applicationName: "Football Pick'em",
  appleWebApp: { capable: true, title: "Football Pick'em", statusBarStyle: "black-translucent" },
  icons: { icon: "/friends-app-icon-navy.png?v=3", apple: "/friends-app-icon-navy.png?v=3" }
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#20282d" };

export default function ProductionSimLayout({ children }: { children: React.ReactNode }) {
  return children;
}
