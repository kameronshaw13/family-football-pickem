"use client";

import { useState } from "react";
import NextImage, { type ImageProps } from "next/image";
import { teamVectorFallbackLogo, teamVectorLogo } from "@/lib/teamLogoSource";
import type { League } from "@/lib/types";

type Props = ImageProps & {
  scoreboardLeague?: League;
  logoBackground?: string;
  onLogoPalette?: (colors: string[]) => void;
};

/** One CBS GameTracker artwork variant across the app, not mixed league assets. */
export default function TeamImage({
  src, onError, scoreboardLeague: _scoreboardLeague,
  logoBackground: _logoBackground, onLogoPalette: _onLogoPalette, ...props
}: Props) {
  const [failedGameTracker, setFailedGameTracker] = useState<string | null>(null);
  const [failedStandard, setFailedStandard] = useState<string | null>(null);
  const original = typeof src === "string" ? src : "";
  const gameTracker = original ? teamVectorLogo(original) : null;
  const standard = original ? teamVectorFallbackLogo(original) : null;
  const preferred = gameTracker && failedGameTracker !== gameTracker ? gameTracker : null;
  const fallback = standard && failedStandard !== standard ? standard : null;
  const selected = preferred || fallback || src;

  return <NextImage {...props} key={typeof selected === "string" ? selected : undefined}
    src={selected} unoptimized={Boolean(preferred || fallback) || props.unoptimized}
    onError={event => {
      if (preferred) setFailedGameTracker(preferred);
      else if (fallback) setFailedStandard(fallback);
      else onError?.(event);
    }} />;
}
