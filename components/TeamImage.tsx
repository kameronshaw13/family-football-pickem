"use client";

import { useState } from "react";
import NextImage, { type ImageProps } from "next/image";
import { ncaaSvgLogo } from "@/lib/teamLogoSource";

/** Prefer verified NCAA vectors, keeping the original image as a load fallback. */
export default function TeamImage({ src, onError, ...props }: ImageProps) {
  const [failedSvg, setFailedSvg] = useState<string | null>(null);
  const svg = typeof src === "string" ? ncaaSvgLogo(src) : null;
  const useSvg = Boolean(svg && failedSvg !== svg);
  return <NextImage {...props} src={useSvg ? svg! : src} unoptimized={Boolean(svg) || props.unoptimized}
    onError={event => {
      if (useSvg) setFailedSvg(svg);
      else onError?.(event);
    }} />;
}
