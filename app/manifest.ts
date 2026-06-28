import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Family Football Pick'em",
    short_name: "Pick'em",
    description: "Private family football pick'em app.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#f8fafc",
    icons: [
      { src: "/icon.png", sizes: "any", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" }
    ]
  };
}
