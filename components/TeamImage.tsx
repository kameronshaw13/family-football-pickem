"use client";

import { useState } from "react";
import NextImage, { type ImageProps } from "next/image";
import { ncaaSvgLogo } from "@/lib/teamLogoSource";
import type { League } from "@/lib/types";

type Props = ImageProps & {
  scoreboardLeague?: League;
  logoBackground?: string;
  onLogoPalette?: (colors: string[]) => void;
};

/**
 * All supported college logos resolve through the verified NCAA SVG directory.
 * Keep the original URL only as a fallback when NCAA has no artwork or fails.
 * Pro leagues keep their original saved logos; CBS overrides are never used.
 */
export default function TeamImage({
  src, onError, scoreboardLeague: _scoreboardLeague,
  logoBackground: _logoBackground, onLogoPalette: _onLogoPalette, ...props
}: Props) {
  const [failedSvg, setFailedSvg] = useState<string | null>(null);
  const svg = typeof src === "string" ? ncaaSvgLogo(src) : null;
  const useSvg = Boolean(svg && failedSvg !== svg);
  return <NextImage {...props} key={useSvg ? svg! : String(src)}
    src={useSvg ? svg! : src} unoptimized={Boolean(svg) || props.unoptimized}
    onError={event => {
      if (useSvg) setFailedSvg(svg);
      else onError?.(event);
    }} />;
}
