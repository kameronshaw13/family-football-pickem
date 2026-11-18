"use client";

import { useState } from "react";
import NextImage, { type ImageProps } from "next/image";
import { teamVectorLogo } from "@/lib/teamLogoSource";
import type { League } from "@/lib/types";

type Props = ImageProps & {
  scoreboardLeague?: League;
  logoBackground?: string;
  onLogoPalette?: (colors: string[]) => void;
};

/**
 * All leagues resolve to a single SVG provider per league.
 * Keep the saved URL as a fallback if vector artwork fails to load.
 */
export default function TeamImage({
  src, onError, scoreboardLeague: _scoreboardLeague,
  logoBackground: _logoBackground, onLogoPalette: _onLogoPalette, ...props
}: Props) {
  const [failedSvg, setFailedSvg] = useState<string | null>(null);
  const svg = typeof src === "string" ? teamVectorLogo(src) : null;
  const useSvg = Boolean(svg && failedSvg !== svg);
  return <NextImage {...props} key={useSvg ? svg! : String(src)}
    src={useSvg ? svg! : src} unoptimized={Boolean(svg) || props.unoptimized}
    onError={event => {
      if (useSvg) setFailedSvg(svg);
      else onError?.(event);
    }} />;
}
