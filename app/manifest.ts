import type { MetadataRoute } from "next";
import { cookies } from "next/headers";

export default function manifest(): MetadataRoute.Manifest {
  const group = cookies().get("pickem_group")?.value || "shaw-family";
  const otherFamily = group === "other-family";
  const friends = group === "friends";
  const companion = otherFamily || friends;
  const name = otherFamily ? "Other Family Pick'em" : friends ? "Friends Pick'em" : "Family Football Pick'em";
  const shortName = otherFamily ? "Other Family" : friends ? "Friends Pick'em" : "Pick'em";
  const startUrl = otherFamily ? "/other-family" : friends ? "/friends" : "/";

  return {
    id: startUrl,
    name,
    short_name: shortName,
    description: "Private football pick'em app.",
    start_url: startUrl,
    scope: startUrl === "/" ? "/" : `${startUrl}/`,
    display: "standalone",
    orientation: "portrait-primary",
    background_color: otherFamily ? "#0b0b0b" : "#20282d",
    theme_color: otherFamily ? "#0b0b0b" : "#20282d",
    icons: companion
      ? [{ src: "/football-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }]
      : [
          { src: "/icon.png", sizes: "any", type: "image/png" },
          { src: "/apple-icon.png", sizes: "180x180", type: "image/png", purpose: "any" }
        ]
  };
}
