"use client";

import { useState } from "react";
import NextImage, { type ImageProps } from "next/image";
import { teamSvgLogo } from "@/lib/teamLogoSource";

/** Prefer verified CBS vectors, keeping the original image as a load fallback. */
export default function TeamImage({ src, onError, basketballScoreboard, ...props }: ImageProps & { basketballScoreboard?: boolean }) {
  const [failedSvg, setFailedSvg] = useState<string | null>(null);
  const svg = typeof src === "string" ? teamSvgLogo(src, basketballScoreboard) : null;
  const useSvg = Boolean(svg && failedSvg !== svg);
  return <NextImage {...props} src={useSvg ? svg! : src} unoptimized={Boolean(svg) || props.unoptimized}
    onError={event => {
      if (useSvg) setFailedSvg(svg);
      else onError?.(event);
    }} />;
}
