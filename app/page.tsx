import type { Metadata } from "next";
import PickemApp from "@/components/PickemApp";
import RouteAppBootstrap from "@/components/RouteAppBootstrap";
import ShawResumeErrorGuard from "@/components/ShawResumeErrorGuard";

export const metadata: Metadata = {
  manifest: "/shaw-manifest.webmanifest"
};

export default function Home() {
  return <><RouteAppBootstrap slug="shaw-family" /><ShawResumeErrorGuard /><PickemApp appSlug="shaw-family" /></>;
}
