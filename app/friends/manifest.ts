import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/friends",
    name: "Football Pick'em",
    short_name: "Football Pick'em",
    description: "Private Friends football pick'em.",
    start_url: "/friends",
    scope: "/friends/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#20282d",
    theme_color: "#20282d",
    icons: [{ src: "/friends-app-icon.png", sizes: "512x512", type: "image/png", purpose: "any" }]
  };
}