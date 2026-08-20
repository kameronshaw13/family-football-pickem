import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Friends Pick'em",
    short_name: "Friends Pick'em",
    description: "Private Friends football pick'em.",
    start_url: "/friends",
    scope: "/friends",
    display: "standalone",
    background_color: "#20282d",
    theme_color: "#20282d",
    icons: [{ src: "/friends-app-icon.png", sizes: "512x512", type: "image/png" }]
  };
}
