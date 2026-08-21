import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Family Pick'em",
    short_name: "Family Pick'em",
    description: "Private Caleb Family confidence pick'em.",
    start_url: "/other-family",
    scope: "/other-family",
    display: "standalone",
    background_color: "#20282d",
    theme_color: "#20282d",
    icons: [{ src: "/other-family-app-icon.png", sizes: "512x512", type: "image/png" }]
  };
}
