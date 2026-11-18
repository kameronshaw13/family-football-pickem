"use client";

import { useState } from "react";
import NextImage, { type ImageProps } from "next/image";
import type { League } from "@/lib/types";

type Props = ImageProps & {
  scoreboardLeague?: League;
  logoBackground?: string;
  onLogoPalette?: (colors: string[]) => void;
};

/**
 * Render the original saved ESPN team artwork everywhere. The CBS-ID mapping
 * introduced alternate logos for the same club, so there must be no implicit
 * provider swap or secondary CDN fallback.
 */
export default function TeamImage({ src, onError, scoreboardLeague: _scoreboardLeague, logoBackground: _logoBackground, onLogoPalette: _onLogoPalette, ...props }: Props) {
  const [failed, setFailed] = useState<string | null>(null);
  const source = typeof src === "string" ? src : "";
  if (source && failed === source) {
    return <span className={["team-artwork-fallback", props.className].filter(Boolean).join(" ")}
      aria-label={props.alt || "Team logo unavailable"} role="img"
      style={{ ...props.style, width: props.width, height: props.height }}>
      {props.alt?.slice(0, 2).toUpperCase() || "—"}
    </span>;
  }

  return <NextImage {...props} src={src} unoptimized
    onError={event => {
      if (source) setFailed(source);
      onError?.(event);
    }} />;
}
