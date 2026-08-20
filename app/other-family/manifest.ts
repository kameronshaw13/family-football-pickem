import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Caleb Family Pick'em",
    short_name: "Caleb Family",
    description: "Private Caleb Family confidence pick'em.",
    start_url: "/other-family",
    scope: "/other-family",
    display: "standalone",
    background_color: "#0b0b0b",
    theme_color: "#0b0b0b",
    icons: [{ src: "/caleb-family-icon.png", sizes: "128x128", type: "image/png" }]
  };
}
