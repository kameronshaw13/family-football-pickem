import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Other Family Pick'em",
    short_name: "Other Family",
    description: "Private Other Family confidence pick'em.",
    start_url: "/other-family",
    scope: "/other-family",
    display: "standalone",
    background_color: "#0b0b0b",
    theme_color: "#0b0b0b",
    icons: [{ src: "/football-icon.svg", sizes: "any", type: "image/svg+xml" }]
  };
}
