import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/caleb-family",
    name: "Family Pick'em",
    short_name: "Family Pick'em",
    description: "Private Caleb Family confidence pick'em.",
    start_url: "/caleb-family",
    scope: "/caleb-family/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#20282d",
    theme_color: "#20282d",
    icons: [{ src: "/other-family-app-icon.png", sizes: "512x512", type: "image/png", purpose: "any" }]
  };
}