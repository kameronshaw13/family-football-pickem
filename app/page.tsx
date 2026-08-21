import type { Metadata } from "next";
import PickemApp from "@/components/PickemApp";
import RouteAppBootstrap from "@/components/RouteAppBootstrap";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest"
};

export default function Home() {
  return <><RouteAppBootstrap slug="shaw-family" /><PickemApp appSlug="shaw-family" /></>;
}
