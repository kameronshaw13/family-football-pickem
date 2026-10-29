/* eslint-disable @next/next/no-img-element -- ImageResponse renders its own PNG. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/** The installed-app cover uses the approved artwork with a slightly fuller 1.06x crop. */
export async function renderHubAppIcon(size: number) {
  const image = await readFile(path.join(process.cwd(), "public", "unified-pickem-cover.png"));
  const scaled = Math.round(size * 1.06);
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "#2058b9" }}>
      <img alt="" src={`data:image/png;base64,${image.toString("base64")}`} width={scaled} height={scaled} style={{ flexShrink: 0, width: scaled, height: scaled }} />
    </div>,
    { width: size, height: size }
  );
}
