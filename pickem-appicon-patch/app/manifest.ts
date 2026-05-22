import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shaw Family Football Pick'em",
    short_name: "Shaw Pick'em",
    description: "Private football pick'em app for the Shaw family.",
    start_url: "/",
    display: "standalone",
    background_color: "#dceeff",
    theme_color: "#dceeff",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/apple-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      }
    ]
  };
}
